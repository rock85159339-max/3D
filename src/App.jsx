import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import helvetikerFont from 'three/examples/fonts/helvetiker_regular.typeface.json';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import {
  Box,
  Circle,
  Copy,
  Cylinder,
  Download,
  Layers3,
  Move3D,
  RotateCw,
  Scale,
  Smartphone,
  Square,
  Trash2,
  Type,
} from 'lucide-react';
import './styles.css';
import LeftPanel from './components/LeftPanel.jsx';
import RightPanel from './components/RightPanel.jsx';
import TopToolbar from './components/TopToolbar.jsx';

const font = new FontLoader().parse(helvetikerFont);
const evaluator = new Evaluator();

const PRINTERS = {
  a1mini: { label: 'Bambu A1 mini', size: { x: 180, y: 180, z: 180 } },
  h2d: { label: 'Bambu H2D', size: { x: 256, y: 256, z: 256 } },
  custom: { label: '自訂尺寸', size: { x: 256, y: 256, z: 256 } },
};

const SHAPES = {
  cube: { label: 'Cube', icon: Box, size: { x: 20, y: 20, z: 20 } },
  sphere: { label: 'Sphere', icon: Circle, size: { x: 20, y: 20, z: 20 } },
  cylinder: { label: 'Cylinder', icon: Cylinder, size: { x: 20, y: 20, z: 30 } },
};

const TEMPLATES = [
  { type: 'phoneStand', label: '手機支架', icon: Smartphone },
  { type: 'roundBase', label: '圓形底座', icon: Circle },
  { type: 'storageBox', label: '方形收納盒', icon: Square },
  { type: 'figureBase', label: '公仔底座', icon: Layers3 },
  { type: 'textPlate', label: '文字牌', icon: Type },
];

const MODE_BUTTONS = [
  { mode: 'translate', label: '移動', icon: Move3D },
  { mode: 'rotate', label: '旋轉', icon: RotateCw },
  { mode: 'scale', label: '縮放', icon: Scale },
];

const palette = [0x22c55e, 0x38bdf8, 0xf97316, 0xe879f9, 0xfacc15, 0xa78bfa];
const axes = ['x', 'y', 'z'];

function roundNumber(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function makeMaterial(color, mode = 'solid') {
  return new THREE.MeshStandardMaterial({
    color: mode === 'hole' ? 0xef4444 : color,
    metalness: 0.04,
    roughness: 0.55,
    transparent: mode === 'hole',
    opacity: mode === 'hole' ? 0.34 : 1,
    depthWrite: mode !== 'hole',
  });
}

function getPrimaryColor(object) {
  let color = '#38bdf8';
  object.traverse((child) => {
    if (child.isMesh && child.material?.color && !child.userData.helper && color === '#38bdf8') {
      color = `#${child.material.color.getHexString()}`;
    }
  });
  return color;
}

function applyModeAndColor(object, mode = object.userData.mode || 'solid', color = object.userData.color || '#38bdf8') {
  object.userData.mode = mode;
  object.userData.color = color;
  object.traverse((child) => {
    if (!child.isMesh || child.userData.helper) return;
    child.material?.dispose?.();
    child.material = makeMaterial(new THREE.Color(color), mode);
  });
}

function makeBox(name, size, color, position = { x: 0, y: 0, z: 0 }, options = {}) {
  const geometry = options.bevelRadius > 0
    ? new RoundedBoxGeometry(size.x, size.y, size.z, Math.max(1, options.bevelSegments || 2), Math.min(options.bevelRadius, size.x / 2, size.y / 2, size.z / 2))
    : new THREE.BoxGeometry(size.x, size.y, size.z);
  const mesh = new THREE.Mesh(geometry, makeMaterial(color));
  mesh.name = name;
  mesh.position.set(position.x, position.y, position.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeCylinder(name, radius, height, color, position = { x: 0, y: 0, z: 0 }, segments = 64) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, makeMaterial(color));
  mesh.name = name;
  mesh.position.set(position.x, position.y, position.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeTextMesh(textSettings, color) {
  const { text, size, depth, align } = textSettings;
  const geometry = new TextGeometry(text || 'TEXT', {
    font,
    size,
    depth,
    curveSegments: 6,
    bevelEnabled: false,
  });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const width = box.max.x - box.min.x;
  const offsetX = align === 'center' ? -width / 2 : align === 'right' ? -width : 0;
  geometry.translate(offsetX, 0, depth / 2);
  const mesh = new THREE.Mesh(geometry, makeMaterial(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function markPrintObject(object, name, type, options = {}) {
  object.name = name;
  object.userData.printObject = true;
  object.userData.shapeType = type;
  object.userData.mode = options.mode || 'solid';
  object.userData.color = options.color || '#38bdf8';
  object.userData.bevelRadius = options.bevelRadius || 0;
  object.userData.bevelSegments = options.bevelSegments || 2;
  object.userData.textSettings = options.textSettings || null;
  object.userData.templateSettings = options.templateSettings || null;
  applyModeAndColor(object, object.userData.mode, object.userData.color);
  return object;
}

function getObjectBounds(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return { box, size, center };
}

function getPrintableMeshes(object) {
  const meshes = [];
  object.traverse((child) => {
    if (child.isMesh && !child.userData.helper) meshes.push(child);
  });
  return meshes;
}

function createShape(type, index = 0) {
  const def = SHAPES[type];
  const color = `#${palette[index % palette.length].toString(16).padStart(6, '0')}`;
  let object;

  if (type === 'sphere') {
    object = new THREE.Mesh(new THREE.SphereGeometry(def.size.x / 2, 48, 28), makeMaterial(new THREE.Color(color)));
  } else if (type === 'cylinder') {
    object = makeCylinder(def.label, def.size.x / 2, def.size.z, new THREE.Color(color));
  } else {
    object = makeBox(def.label, def.size, new THREE.Color(color));
  }

  object.castShadow = true;
  object.receiveShadow = true;
  object.position.set((index % 5) * 8 - 16, 0, def.size.z / 2);
  return markPrintObject(object, `${def.label} ${index + 1}`, type, { color });
}

function createTextObject(index = 0, settings = { text: 'TEXT', size: 18, depth: 4, align: 'center' }) {
  const color = '#f8fafc';
  const mesh = makeTextMesh(settings, new THREE.Color(color));
  mesh.position.set((index % 5) * 8 - 16, 0, settings.depth / 2);
  return markPrintObject(mesh, `文字 ${index + 1}`, 'text', { color, textSettings: { ...settings } });
}

function createTextPlateGeometry() {
  const group = new THREE.Group();
  group.add(makeBox('Plate', { x: 80, y: 24, z: 3 }, 0x38bdf8, { x: 0, y: 0, z: 1.5 }));
  group.add(makeBox('I', { x: 4, y: 14, z: 3 }, 0xf8fafc, { x: -22, y: 0, z: 4.5 }));
  group.add(makeBox('D', { x: 14, y: 14, z: 3 }, 0xf8fafc, { x: -5, y: 0, z: 4.5 }));
  group.add(makeBox('3', { x: 14, y: 14, z: 3 }, 0xf8fafc, { x: 15, y: 0, z: 4.5 }));
  return markPrintObject(group, '文字牌', 'template', { color: '#38bdf8' });
}

function createTemplate(type, index) {
  const group = new THREE.Group();
  const color = palette[index % palette.length];
  const colorHex = `#${color.toString(16).padStart(6, '0')}`;

  if (type === 'phoneStand') {
    group.add(makeBox('底板', { x: 70, y: 45, z: 5 }, color, { x: 0, y: 0, z: 2.5 }));
    const back = makeBox('背板', { x: 70, y: 6, z: 60 }, 0x38bdf8, { x: 0, y: 16, z: 32 });
    back.rotation.x = THREE.MathUtils.degToRad(-15);
    group.add(back);
    group.add(makeBox('止滑唇', { x: 70, y: 8, z: 9 }, 0xf97316, { x: 0, y: -17, z: 7 }));
    markPrintObject(group, '手機支架', 'template', { color: colorHex });
  } else if (type === 'roundBase') {
    group.add(makeCylinder('圓盤', 35, 6, color, { x: 0, y: 0, z: 3 }));
    markPrintObject(group, '圓形底座', 'template', { color: colorHex });
  } else if (type === 'storageBox') {
    group.add(makeBox('底板', { x: 70, y: 50, z: 4 }, color, { x: 0, y: 0, z: 2 }));
    group.add(makeBox('左壁', { x: 4, y: 50, z: 30 }, color, { x: -33, y: 0, z: 17 }));
    group.add(makeBox('右壁', { x: 4, y: 50, z: 30 }, color, { x: 33, y: 0, z: 17 }));
    group.add(makeBox('前壁', { x: 70, y: 4, z: 30 }, color, { x: 0, y: -23, z: 17 }));
    group.add(makeBox('後壁', { x: 70, y: 4, z: 30 }, color, { x: 0, y: 23, z: 17 }));
    markPrintObject(group, '方形收納盒', 'template', { color: colorHex });
  } else if (type === 'figureBase') {
    group.add(makeCylinder('主底座', 32, 8, color, { x: 0, y: 0, z: 4 }));
    group.add(makeCylinder('上層圓台', 24, 5, 0xa78bfa, { x: 0, y: 0, z: 10.5 }));
    group.add(makeBox('名牌', { x: 40, y: 6, z: 8 }, 0xf97316, { x: 0, y: -29, z: 8 }));
    markPrintObject(group, '公仔底座', 'template', { color: colorHex });
  } else {
    const plate = createTextPlateGeometry();
    plate.position.set((index % 4) * 10 - 15, 0, 0);
    return plate;
  }

  group.position.set((index % 4) * 10 - 15, 0, 0);
  return group;
}

function createBuildPlate(size) {
  const group = new THREE.Group();
  group.name = '列印平台';

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x, size.y),
    new THREE.MeshBasicMaterial({
      color: 0x1f9fd1,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  plate.userData.helper = true;
  group.add(plate);

  const minor = new THREE.LineBasicMaterial({ color: 0x355062, transparent: true, opacity: 0.55 });
  const major = new THREE.LineBasicMaterial({ color: 0x77c7e7, transparent: true, opacity: 0.9 });
  const halfX = size.x / 2;
  const halfY = size.y / 2;

  for (let x = -halfX; x <= halfX + 0.001; x += 5) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, -halfY, 0.08), new THREE.Vector3(x, halfY, 0.08)]),
      Math.abs(Math.round(x)) % 10 === 0 ? major : minor,
    );
    line.userData.helper = true;
    group.add(line);
  }

  for (let y = -halfY; y <= halfY + 0.001; y += 5) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-halfX, y, 0.08), new THREE.Vector3(halfX, y, 0.08)]),
      Math.abs(Math.round(y)) % 10 === 0 ? major : minor,
    );
    line.userData.helper = true;
    group.add(line);
  }

  const border = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfX, -halfY, 0.12),
      new THREE.Vector3(halfX, -halfY, 0.12),
      new THREE.Vector3(halfX, halfY, 0.12),
      new THREE.Vector3(-halfX, halfY, 0.12),
      new THREE.Vector3(-halfX, -halfY, 0.12),
    ]),
    new THREE.LineBasicMaterial({ color: 0x38bdf8 }),
  );
  border.userData.helper = true;
  group.add(border);
  return group;
}

function createParamTemplate(type, index, settings = {}) {
  const group = new THREE.Group();
  const color = palette[index % palette.length];
  const colorHex = `#${color.toString(16).padStart(6, '0')}`;

  if (type === 'phoneStand') {
    const cfg = { width: 70, depth: 45, backHeight: 60, angle: 15, lipHeight: 9, ...settings.phoneStand };
    group.add(makeBox('Base', { x: cfg.width, y: cfg.depth, z: 5 }, color, { x: 0, y: 0, z: 2.5 }));
    const back = makeBox('Back', { x: cfg.width, y: 6, z: cfg.backHeight }, 0x38bdf8, { x: 0, y: cfg.depth / 2 - 6, z: cfg.backHeight / 2 + 2 });
    back.rotation.x = THREE.MathUtils.degToRad(-cfg.angle);
    group.add(back);
    group.add(makeBox('Lip', { x: cfg.width, y: 8, z: cfg.lipHeight }, 0xf97316, { x: 0, y: -cfg.depth / 2 + 6, z: 5 + cfg.lipHeight / 2 }));
    markPrintObject(group, '手機支架', 'template', { color: colorHex, templateSettings: cfg });
  } else if (type === 'roundBase') {
    const cfg = { diameter: 70, height: 6, ...settings.roundBase };
    group.add(makeCylinder('Round base', cfg.diameter / 2, cfg.height, color, { x: 0, y: 0, z: cfg.height / 2 }));
    markPrintObject(group, '圓形底座', 'template', { color: colorHex, templateSettings: cfg });
  } else if (type === 'storageBox') {
    const cfg = { width: 70, depth: 50, height: 30, wall: 4, ...settings.storageBox };
    group.add(makeBox('Base', { x: cfg.width, y: cfg.depth, z: cfg.wall }, color, { x: 0, y: 0, z: cfg.wall / 2 }));
    group.add(makeBox('Left wall', { x: cfg.wall, y: cfg.depth, z: cfg.height }, color, { x: -cfg.width / 2 + cfg.wall / 2, y: 0, z: cfg.height / 2 + cfg.wall }));
    group.add(makeBox('Right wall', { x: cfg.wall, y: cfg.depth, z: cfg.height }, color, { x: cfg.width / 2 - cfg.wall / 2, y: 0, z: cfg.height / 2 + cfg.wall }));
    group.add(makeBox('Front wall', { x: cfg.width, y: cfg.wall, z: cfg.height }, color, { x: 0, y: -cfg.depth / 2 + cfg.wall / 2, z: cfg.height / 2 + cfg.wall }));
    group.add(makeBox('Back wall', { x: cfg.width, y: cfg.wall, z: cfg.height }, color, { x: 0, y: cfg.depth / 2 - cfg.wall / 2, z: cfg.height / 2 + cfg.wall }));
    markPrintObject(group, '方形收納盒', 'template', { color: colorHex, templateSettings: cfg });
  } else if (type === 'figureBase') {
    const cfg = { diameter: 64, height: 8, nameplate: true, ...settings.figureBase };
    const topHeight = Math.max(3, cfg.height * 0.55);
    group.add(makeCylinder('Figure base', cfg.diameter / 2, cfg.height, color, { x: 0, y: 0, z: cfg.height / 2 }));
    group.add(makeCylinder('Top disc', cfg.diameter * 0.38, topHeight, 0xa78bfa, { x: 0, y: 0, z: cfg.height + topHeight / 2 }));
    if (cfg.nameplate) group.add(makeBox('Nameplate', { x: cfg.diameter * 0.62, y: 6, z: cfg.height }, 0xf97316, { x: 0, y: -cfg.diameter / 2 + 3, z: cfg.height }));
    markPrintObject(group, '公仔底座', 'template', { color: colorHex, templateSettings: cfg });
  } else {
    return createTemplate(type, index);
  }

  group.position.set((index % 4) * 10 - 15, 0, 0);
  return group;
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}

function clonePrintable(source) {
  const clone = source.clone(true);
  clone.traverse((child) => {
    if (child.isMesh) {
      child.geometry = child.geometry.clone();
      child.material = child.material.clone();
    }
  });
  clone.name = `${source.name} Copy`;
  clone.position.x += 8;
  clone.position.y += 8;
  clone.userData = structuredClone(source.userData);
  return clone;
}

function readTransform(object) {
  if (!object) return null;
  const { size } = getObjectBounds(object);
  return {
    id: object.uuid,
    name: object.name,
    mode: object.userData.mode || 'solid',
    color: object.userData.color || getPrimaryColor(object),
    shapeType: object.userData.shapeType || 'custom',
    bevelRadius: object.userData.bevelRadius || 0,
    bevelSegments: object.userData.bevelSegments || 2,
    textSettings: object.userData.textSettings || null,
    position: {
      x: roundNumber(object.position.x),
      y: roundNumber(object.position.y),
      z: roundNumber(object.position.z),
    },
    rotation: {
      x: roundNumber(THREE.MathUtils.radToDeg(object.rotation.x)),
      y: roundNumber(THREE.MathUtils.radToDeg(object.rotation.y)),
      z: roundNumber(THREE.MathUtils.radToDeg(object.rotation.z)),
    },
    dimensions: {
      x: roundNumber(size.x),
      y: roundNumber(size.y),
      z: roundNumber(size.z),
    },
  };
}

function printCheck(object, printerSize) {
  if (!object) return null;
  const { box, size } = getObjectBounds(object);
  const halfX = printerSize.x / 2;
  const halfY = printerSize.y / 2;
  const outside = box.min.x < -halfX || box.max.x > halfX || box.min.y < -halfY || box.max.y > halfY || box.min.z < -0.05 || box.max.z > printerSize.z;
  const floating = box.min.z > 0.15;
  const tooThin = size.x < 1 || size.y < 1 || size.z < 1;
  return {
    outside,
    belowPlatform: box.min.z < -0.01,
    floating,
    tooThin,
    dimensions: { x: roundNumber(size.x), y: roundNumber(size.y), z: roundNumber(size.z) },
  };
}

function getPrintStats(objects, printerSize) {
  const sceneBox = new THREE.Box3();
  const sceneSize = new THREE.Vector3();
  let hasGeometry = false;
  let solidCount = 0;
  let holeCount = 0;
  let outsideCount = 0;
  let belowPlatformCount = 0;
  let floatingCount = 0;
  let thinCount = 0;
  const halfX = printerSize.x / 2;
  const halfY = printerSize.y / 2;

  objects.forEach((object) => {
    const { box, size } = getObjectBounds(object);
    if (!box.isEmpty()) {
      sceneBox.union(box);
      hasGeometry = true;
    }
    if (object.userData.mode === 'hole') holeCount += 1;
    else solidCount += 1;
    if (box.min.z < -0.01) belowPlatformCount += 1;
    if (box.min.z > 0.15) floatingCount += 1;
    if (size.x < 1 || size.y < 1 || size.z < 1) thinCount += 1;
    if (box.min.x < -halfX || box.max.x > halfX || box.min.y < -halfY || box.max.y > halfY || box.max.z > printerSize.z) outsideCount += 1;
  });

  if (hasGeometry) sceneBox.getSize(sceneSize);
  return {
    objectCount: objects.length,
    solidCount,
    holeCount,
    outsideCount,
    belowPlatformCount,
    floatingCount,
    thinCount,
    totalSize: { x: roundNumber(sceneSize.x), y: roundNumber(sceneSize.y), z: roundNumber(sceneSize.z) },
  };
}

function snapObjectDimensions(object) {
  const { size } = getObjectBounds(object);
  axes.forEach((axis) => {
    const current = size[axis];
    const target = Math.max(1, Math.round(current));
    if (current > 0 && Math.abs(current - target) > 0.001) object.scale[axis] *= target / current;
  });
}

function meshToWorldGeometry(mesh) {
  mesh.updateWorldMatrix(true, false);
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  return geometry;
}

function meshToBrush(mesh) {
  const brush = new Brush(meshToWorldGeometry(mesh), mesh.material?.clone?.() || makeMaterial(0x38bdf8));
  brush.updateMatrixWorld(true);
  return brush;
}

function csgCombine(meshes, operation) {
  if (!meshes.length) return null;
  let result = meshToBrush(meshes[0]);
  for (let i = 1; i < meshes.length; i += 1) {
    result = evaluator.evaluate(result, meshToBrush(meshes[i]), operation);
  }
  return result;
}

function createMeshFromGeometry(name, geometry, color = '#38bdf8') {
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, makeMaterial(new THREE.Color(color)));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return markPrintObject(mesh, name, 'custom', { color });
}

function getGeometryData(geometry) {
  const data = {
    position: Array.from(geometry.attributes.position.array),
    normal: geometry.attributes.normal ? Array.from(geometry.attributes.normal.array) : null,
    index: geometry.index ? Array.from(geometry.index.array) : null,
  };
  return data;
}

function geometryFromData(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.position, 3));
  if (data.normal) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normal, 3));
  if (data.index) geometry.setIndex(data.index);
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return geometry;
}

function objectToProjectData(object) {
  const bounds = getObjectBounds(object);
  const data = {
    name: object.name,
    kind: object.isGroup ? 'group' : 'mesh',
    type: object.userData.shapeType || 'custom',
    shapeType: object.userData.shapeType || 'custom',
    mode: object.userData.mode || 'solid',
    color: object.userData.color || getPrimaryColor(object),
    position: object.position.toArray(),
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: object.scale.toArray(),
    dimensions: {
      x: roundNumber(bounds.size.x),
      y: roundNumber(bounds.size.y),
      z: roundNumber(bounds.size.z),
    },
    bevelRadius: object.userData.bevelRadius || 0,
    bevelSegments: object.userData.bevelSegments || 2,
    textSettings: object.userData.textSettings || null,
    templateSettings: object.userData.templateSettings || null,
    children: [],
    geometry: null,
  };

  if (object.isGroup) {
    data.children = object.children.filter((child) => !child.userData.helper).map(objectToProjectData);
  } else if (object.geometry) {
    data.geometry = getGeometryData(object.geometry);
  }
  return data;
}

function objectFromProjectData(data) {
  let object;
  if (data.kind === 'group') {
    object = new THREE.Group();
    data.children.forEach((child) => object.add(objectFromProjectData(child)));
  } else if (data.shapeType === 'text' && data.textSettings) {
    object = makeTextMesh(data.textSettings, new THREE.Color(data.color || '#f8fafc'));
  } else if (data.geometry) {
    object = new THREE.Mesh(geometryFromData(data.geometry), makeMaterial(new THREE.Color(data.color || '#38bdf8')));
  } else {
    object = createShape(data.shapeType || 'cube');
  }

  object.position.fromArray(data.position || [0, 0, 0]);
  object.rotation.set(...(data.rotation || [0, 0, 0]));
  object.scale.fromArray(data.scale || [1, 1, 1]);
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return markPrintObject(object, data.name || 'Object', data.shapeType || 'custom', data);
}

export default function App() {
  const mountRef = useRef(null);
  const fileInputRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const orbitRef = useRef(null);
  const transformRef = useRef(null);
  const plateRef = useRef(null);
  const selectionHelpersRef = useRef([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const objectsRef = useRef([]);
  const selectedIdsRef = useRef([]);
  const selectedRef = useRef(null);
  const selectionGroupRef = useRef(null);
  const modeRef = useRef('translate');
  const snapRef = useRef(true);
  const multiSelectRef = useRef(false);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const toastTimerRef = useRef(null);
  const objectCountRef = useRef(0);
  const [objects, setObjects] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('translate');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [multiSelect, setMultiSelect] = useState(false);
  const [printerKey, setPrinterKey] = useState('h2d');
  const [customSize, setCustomSize] = useState({ x: 256, y: 256, z: 256 });
  const [templateSettings, setTemplateSettings] = useState({
    phoneStand: { width: 70, depth: 45, backHeight: 60, angle: 15, lipHeight: 9 },
    storageBox: { width: 70, depth: 50, height: 30, wall: 4 },
    roundBase: { diameter: 70, height: 6 },
    figureBase: { diameter: 64, height: 8, nameplate: true },
  });
  const [booleanMessage, setBooleanMessage] = useState('');
  const [toast, setToast] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);

  const printerSize = printerKey === 'custom' ? customSize : PRINTERS[printerKey].size;
  const selectedObjects = useMemo(() => objectsRef.current.filter((object) => selectedIds.includes(object.uuid)), [selectedIds, objects]);
  const primarySelected = selectedObjects[0] || null;
  const selectedCheck = primarySelected ? printCheck(primarySelected, printerSize) : null;
  const printStats = useMemo(() => getPrintStats(objectsRef.current, printerSize), [objects, printerSize.x, printerSize.y, printerSize.z]);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10151f);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 3000);
    camera.up.set(0, 0, 1);
    camera.position.set(220, -260, 180);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.target.set(0, 0, 25);
    orbitRef.current = orbit;

    const transform = new TransformControls(camera, renderer.domElement);
    transform.setMode(mode);
    transform.addEventListener('dragging-changed', (event) => {
      if (event.value) pushHistory('transform');
      orbit.enabled = !event.value;
    });
    transform.addEventListener('objectChange', () => {
      const active = transform.object;
      if (!active) return;
      if (snapRef.current && modeRef.current === 'scale') snapObjectDimensions(active);
      selectedRef.current = active;
      setSelected(readTransform(active));
    });
    scene.add(transform.getHelper());
    transformRef.current = transform;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x283244, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(120, -100, 220);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);

    const plate = createBuildPlate(printerSize);
    scene.add(plate);
    plateRef.current = plate;

    const onPointerDown = (event) => {
      if (transform.dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const meshes = objectsRef.current.flatMap((object) => getPrintableMeshes(object));
      const hits = raycasterRef.current.intersectObjects(meshes, false);
      const hitObject = hits[0]?.object;
      const root = hitObject ? objectsRef.current.find((object) => {
        let found = false;
        object.traverse((child) => { if (child === hitObject) found = true; });
        return found;
      }) : null;
      updateSelection(root, multiSelectRef.current || event.shiftKey);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', resize);

    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      orbit.update();
      selectionHelpersRef.current.forEach((helper) => helper.update());
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      transform.dispose();
      orbit.dispose();
      disposeObject(scene);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!event.ctrlKey) return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    multiSelectRef.current = multiSelect;
  }, [multiSelect]);

  useEffect(() => {
    modeRef.current = mode;
    transformRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    snapRef.current = snapEnabled;
    const transform = transformRef.current;
    if (!transform) return;
    transform.setTranslationSnap(snapEnabled ? 1 : null);
    transform.setRotationSnap(snapEnabled ? THREE.MathUtils.degToRad(15) : null);
    transform.setScaleSnap(null);
  }, [snapEnabled]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (plateRef.current) {
      scene.remove(plateRef.current);
      disposeObject(plateRef.current);
    }
    const nextPlate = createBuildPlate(printerSize);
    scene.add(nextPlate);
    plateRef.current = nextPlate;
  }, [printerSize.x, printerSize.y, printerSize.z]);

  function refreshObjects() {
    setObjects([...objectsRef.current]);
  }

  function showToast(message) {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2500);
  }

  function makeSnapshot() {
    return {
      printerKey,
      customSize,
      objects: objectsRef.current.map(objectToProjectData),
    };
  }

  function pushHistory(label = 'change') {
    historyRef.current.push(makeSnapshot());
    if (historyRef.current.length > 80) historyRef.current.shift();
    redoRef.current = [];
    setHistoryVersion((version) => version + 1);
    return label;
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot) return;
    detachSelectionGroup();
    clearSelectionHelpers();
    objectsRef.current.forEach((object) => {
      sceneRef.current.remove(object);
      disposeObject(object);
    });
    objectsRef.current = (snapshot.objects || []).map(objectFromProjectData);
    objectsRef.current.forEach((object) => sceneRef.current.add(object));
    if (snapshot.printerKey) setPrinterKey(snapshot.printerKey);
    if (snapshot.customSize) setCustomSize(snapshot.customSize);
    refreshObjects();
    attachTransformForSelection([]);
  }

  function undo() {
    const snapshot = historyRef.current.pop();
    if (!snapshot) {
      showToast('沒有可復原的操作');
      return;
    }
    redoRef.current.push(makeSnapshot());
    restoreSnapshot(snapshot);
    setHistoryVersion((version) => version + 1);
    showToast('已復原');
  }

  function redo() {
    const snapshot = redoRef.current.pop();
    if (!snapshot) {
      showToast('沒有可重做的操作');
      return;
    }
    historyRef.current.push(makeSnapshot());
    restoreSnapshot(snapshot);
    setHistoryVersion((version) => version + 1);
    showToast('已重做');
  }

  function detachSelectionGroup() {
    const scene = sceneRef.current;
    const group = selectionGroupRef.current;
    if (!scene || !group) return;
    const children = [...group.children];
    children.forEach((child) => scene.attach(child));
    scene.remove(group);
    selectionGroupRef.current = null;
  }

  function clearSelectionHelpers() {
    const scene = sceneRef.current;
    if (!scene) return;
    selectionHelpersRef.current.forEach((helper) => {
      scene.remove(helper);
      helper.geometry?.dispose?.();
      helper.material?.dispose?.();
    });
    selectionHelpersRef.current = [];
  }

  function updateSelectionHelpers(selectedItems) {
    const scene = sceneRef.current;
    if (!scene) return;
    clearSelectionHelpers();
    selectionHelpersRef.current = selectedItems.map((object) => {
      const color = object.userData.mode === 'hole' ? 0xff6b6b : 0xfacc15;
      const helper = new THREE.BoxHelper(object, color);
      helper.userData.helper = true;
      scene.add(helper);
      return helper;
    });
  }

  function attachTransformForSelection(ids) {
    const transform = transformRef.current;
    const scene = sceneRef.current;
    if (!transform || !scene) return;
    detachSelectionGroup();
    const selectedItems = objectsRef.current.filter((object) => ids.includes(object.uuid));
    selectedIdsRef.current = ids;
    setSelectedIds(ids);
    updateSelectionHelpers(selectedItems);

    if (!selectedItems.length) {
      transform.detach();
      selectedRef.current = null;
      setSelected(null);
      return;
    }

    if (selectedItems.length === 1) {
      selectedRef.current = selectedItems[0];
      transform.attach(selectedItems[0]);
      setSelected(readTransform(selectedItems[0]));
      return;
    }

    const box = new THREE.Box3();
    selectedItems.forEach((object) => box.union(getObjectBounds(object).box));
    const center = new THREE.Vector3();
    box.getCenter(center);
    const selectionGroup = new THREE.Group();
    selectionGroup.name = '多選控制';
    selectionGroup.position.copy(center);
    selectionGroup.userData.helper = true;
    scene.add(selectionGroup);
    selectedItems.forEach((object) => selectionGroup.attach(object));
    selectionGroupRef.current = selectionGroup;
    selectedRef.current = selectionGroup;
    transform.attach(selectionGroup);
    setSelected(readTransform(selectionGroup));
  }

  function updateSelection(object, additive = false) {
    if (!object) {
      attachTransformForSelection([]);
      return;
    }
    const current = selectedIdsRef.current;
    const next = additive
      ? current.includes(object.uuid)
        ? current.filter((id) => id !== object.uuid)
        : [...current, object.uuid]
      : [object.uuid];
    attachTransformForSelection(next);
  }

  function addObject(object) {
    detachSelectionGroup();
    objectsRef.current.push(object);
    sceneRef.current.add(object);
    refreshObjects();
    attachTransformForSelection([object.uuid]);
  }

  function addShape(type) {
    pushHistory('add shape');
    const object = createShape(type, objectCountRef.current);
    objectCountRef.current += 1;
    addObject(object);
    showToast(`已新增 ${SHAPES[type].label}`);
  }

  function addTemplate(type) {
    pushHistory('add template');
    const object = createParamTemplate(type, objectCountRef.current, templateSettings);
    objectCountRef.current += 1;
    addObject(object);
    showToast('已新增模板');
  }

  function updateTemplateSetting(template, key, value) {
    const nextValue = key === 'nameplate' ? value : Math.max(0.5, Number(value) || 0.5);
    setTemplateSettings((settings) => ({
      ...settings,
      [template]: {
        ...settings[template],
        [key]: nextValue,
      },
    }));
  }

  function addText() {
    pushHistory('add text');
    const object = createTextObject(objectCountRef.current);
    objectCountRef.current += 1;
    addObject(object);
    showToast('已新增 3D 文字');
  }

  function deleteSelected() {
    if (!selectedIdsRef.current.length) {
      showToast('沒有選取物件');
      return;
    }
    pushHistory('delete');
    detachSelectionGroup();
    const ids = selectedIdsRef.current;
    ids.forEach((id) => {
      const object = objectsRef.current.find((item) => item.uuid === id);
      if (!object) return;
      sceneRef.current.remove(object);
      disposeObject(object);
    });
    objectsRef.current = objectsRef.current.filter((item) => !ids.includes(item.uuid));
    refreshObjects();
    attachTransformForSelection([]);
    showToast('已刪除物件');
  }

  function duplicateSelected() {
    if (!selectedIdsRef.current.length) {
      showToast('沒有選取物件');
      return;
    }
    pushHistory('duplicate');
    detachSelectionGroup();
    const clones = selectedIdsRef.current.map((id) => objectsRef.current.find((item) => item.uuid === id)).filter(Boolean).map(clonePrintable);
    clones.forEach((clone) => {
      objectsRef.current.push(clone);
      sceneRef.current.add(clone);
    });
    refreshObjects();
    attachTransformForSelection(clones.map((clone) => clone.uuid));
    showToast('已複製物件');
  }

  function centerSelectedOnPlate() {
    const target = selectedRef.current;
    if (!target) {
      showToast('沒有選取物件');
      return;
    }
    pushHistory('center');
    const { center } = getObjectBounds(target);
    target.position.x -= center.x;
    target.position.y -= center.y;
    setSelected(readTransform(target));
    refreshObjects();
    showToast('已置中');
  }

  function dropSelectedToPlate() {
    const target = selectedRef.current;
    if (!target) {
      showToast('沒有選取物件');
      return;
    }
    pushHistory('drop');
    const { box } = getObjectBounds(target);
    target.position.z -= box.min.z;
    setSelected(readTransform(target));
    refreshObjects();
    showToast('已貼齊平台');
  }

  function mirrorSelected(axis) {
    const target = selectedRef.current;
    if (!target) {
      showToast('沒有選取物件');
      return;
    }
    pushHistory('mirror');
    target.scale[axis] *= -1;
    setSelected(readTransform(target));
    refreshObjects();
    showToast(`已鏡像 ${axis.toUpperCase()}`);
  }

  function resetCameraView() {
    const camera = cameraRef.current;
    const orbit = orbitRef.current;
    if (!camera || !orbit) return;
    camera.position.set(220, -260, 180);
    orbit.target.set(0, 0, 25);
    orbit.update();
  }

  function groupSelected() {
    const selectedItems = objectsRef.current.filter((object) => selectedIdsRef.current.includes(object.uuid));
    if (selectedItems.length < 2) {
      showToast('請至少選取 2 個物件才能群組');
      return;
    }
    pushHistory('group');
    detachSelectionGroup();
    const group = new THREE.Group();
    group.name = `群組 ${objectCountRef.current + 1}`;
    markPrintObject(group, group.name, 'group', { color: '#38bdf8' });
    sceneRef.current.add(group);
    selectedItems.forEach((object) => group.attach(object));
    objectsRef.current = objectsRef.current.filter((object) => !selectedItems.includes(object));
    objectsRef.current.push(group);
    refreshObjects();
    attachTransformForSelection([group.uuid]);
    showToast('已建立群組');
  }

  function ungroupSelected() {
    detachSelectionGroup();
    const groups = selectedIdsRef.current.map((id) => objectsRef.current.find((item) => item.uuid === id)).filter((object) => object?.isGroup);
    if (!groups.length) {
      showToast('請先選取群組');
      return;
    }
    pushHistory('ungroup');
    const released = [];
    groups.forEach((group) => {
      [...group.children].forEach((child) => {
        sceneRef.current.attach(child);
        child.userData.printObject = true;
        if (!child.userData.shapeType) child.userData.shapeType = child.isGroup ? 'group' : 'custom';
        released.push(child);
      });
      sceneRef.current.remove(group);
    });
    objectsRef.current = objectsRef.current.filter((object) => !groups.includes(object));
    objectsRef.current.push(...released);
    refreshObjects();
    attachTransformForSelection(released.map((object) => object.uuid));
    showToast('已取消群組');
  }

  function mergeSelected() {
    detachSelectionGroup();
    const solids = selectedIdsRef.current.map((id) => objectsRef.current.find((item) => item.uuid === id)).filter((object) => object?.userData.mode !== 'hole');
    const meshes = solids.flatMap(getPrintableMeshes);
    if (meshes.length < 2) {
      showToast('請至少選取 2 個物件才能合併');
      return;
    }
    pushHistory('merge');
    let geometry;
    try {
      geometry = csgCombine(meshes, ADDITION)?.geometry;
    } catch {
      geometry = mergeGeometries(meshes.map(meshToWorldGeometry), false);
    }
    if (!geometry) return;
    const merged = createMeshFromGeometry('合併物件', geometry, '#38bdf8');
    solids.forEach((object) => sceneRef.current.remove(object));
    objectsRef.current = objectsRef.current.filter((object) => !solids.includes(object));
    objectsRef.current.push(merged);
    sceneRef.current.add(merged);
    refreshObjects();
    attachTransformForSelection([merged.uuid]);
    showToast('已合併物件');
  }

  function applyHole() {
    detachSelectionGroup();
    const selectedItems = selectedIdsRef.current.map((id) => objectsRef.current.find((item) => item.uuid === id)).filter(Boolean);
    const solids = selectedItems.filter((object) => object.userData.mode !== 'hole').flatMap(getPrintableMeshes);
    const holes = selectedItems.filter((object) => object.userData.mode === 'hole').flatMap(getPrintableMeshes);
    if (!solids.length || !holes.length) {
      setBooleanMessage('請同時選取 Solid 與 Hole。');
      showToast('請同時選取 Solid 與 Hole');
      return;
    }

    try {
      pushHistory('boolean');
      const solidBrush = csgCombine(solids, ADDITION);
      const holeBrush = csgCombine(holes, ADDITION);
      const result = evaluator.evaluate(solidBrush, holeBrush, SUBTRACTION);
      const mesh = createMeshFromGeometry('打洞結果', result.geometry, '#38bdf8');
      selectedItems.forEach((object) => sceneRef.current.remove(object));
      objectsRef.current = objectsRef.current.filter((object) => !selectedItems.includes(object));
      objectsRef.current.push(mesh);
      sceneRef.current.add(mesh);
      refreshObjects();
      attachTransformForSelection([mesh.uuid]);
      setBooleanMessage('布林打洞完成。');
      showToast('已套用打洞');
    } catch (error) {
      setBooleanMessage(`布林運算失敗：${error.message}`);
      showToast('打洞失敗，請確認 Solid 和 Hole 有重疊');
    }
  }

  function setSelectedMode(nextMode) {
    if (!selectedIdsRef.current.length) {
      showToast('沒有選取物件');
      return;
    }
    pushHistory('mode');
    selectedIdsRef.current.forEach((id) => {
      const object = objectsRef.current.find((item) => item.uuid === id);
      if (object) applyModeAndColor(object, nextMode, object.userData.color || getPrimaryColor(object));
    });
    refreshObjects();
    if (selectedRef.current) setSelected(readTransform(selectedRef.current));
    showToast(nextMode === 'hole' ? '已設為洞' : '已設為實體');
  }

  function updateSelected(path, axis, value) {
    const target = selectedRef.current;
    const object = primarySelected;
    if (!target || !object) return;

    if (path === 'name') {
      pushHistory('name');
      object.name = value;
    } else if (path === 'mode') {
      setSelectedMode(value);
      return;
    } else if (path === 'color') {
      pushHistory('color');
      selectedIdsRef.current.forEach((id) => {
        const item = objectsRef.current.find((entry) => entry.uuid === id);
        if (item) applyModeAndColor(item, item.userData.mode || 'solid', value);
      });
      showToast('已更新顏色');
    } else if (path === 'bevelRadius' || path === 'bevelSegments') {
      pushHistory('bevel');
      object.userData[path] = Math.max(path === 'bevelSegments' ? 1 : 0, Number(value) || 0);
      rebuildCubeGeometry(object);
    } else if (path === 'textSettings') {
      pushHistory('text');
      object.userData.textSettings = { ...object.userData.textSettings, [axis]: axis === 'text' || axis === 'align' ? value : Number(value) || 1 };
      rebuildTextGeometry(object);
    } else {
      const next = Number(value);
      if (Number.isNaN(next)) return;
      pushHistory(path);
      if (path === 'rotation') target.rotation[axis] = THREE.MathUtils.degToRad(next);
      else if (path === 'position') target.position[axis] = next;
      else if (path === 'dimensions') {
        const current = getObjectBounds(target).size[axis];
        if (current > 0) target.scale[axis] *= Math.max(0.5, next) / current;
        const { box } = getObjectBounds(target);
        if (box.min.z < 0) target.position.z -= box.min.z;
      }
    }

    setSelected(readTransform(target));
    refreshObjects();
  }

  function rebuildCubeGeometry(object) {
    if (object.userData.shapeType !== 'cube' || !object.isMesh) return;
    const size = getObjectBounds(object).size;
    object.geometry.dispose();
    object.geometry = new RoundedBoxGeometry(
      Math.max(0.1, size.x / object.scale.x),
      Math.max(0.1, size.y / object.scale.y),
      Math.max(0.1, size.z / object.scale.z),
      Math.max(1, object.userData.bevelSegments || 1),
      Math.max(0, object.userData.bevelRadius || 0),
    );
  }

  function rebuildTextGeometry(object) {
    if (object.userData.shapeType !== 'text' || !object.isMesh) return;
    object.geometry.dispose();
    object.geometry = makeTextMesh(object.userData.textSettings, new THREE.Color(object.userData.color || '#f8fafc')).geometry;
  }

  function exportModel(format) {
    detachSelectionGroup();
    if (!objectsRef.current.length) return;
    const group = new THREE.Group();
    objectsRef.current.filter((object) => object.userData.mode !== 'hole').forEach((object) => group.add(object.clone(true)));
    group.updateMatrixWorld(true);
    const exporter = format === 'obj' ? new OBJExporter() : new STLExporter();
    const data = format === 'obj' ? exporter.parse(group) : exporter.parse(group, { binary: false });
    const blob = new Blob([data], { type: format === 'obj' ? 'text/plain' : 'model/stl' });
    downloadBlob(blob, `print-model.${format}`);
  }

  function saveProject() {
    detachSelectionGroup();
    const payload = {
      version: 2,
      printerKey,
      customSize,
      objects: objectsRef.current.map(objectToProjectData),
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'print-model-project.json');
  }

  function loadProjectFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        detachSelectionGroup();
        objectsRef.current.forEach((object) => {
          sceneRef.current.remove(object);
          disposeObject(object);
        });
        objectsRef.current = (data.objects || []).map(objectFromProjectData);
        objectsRef.current.forEach((object) => sceneRef.current.add(object));
        if (data.printerKey) setPrinterKey(data.printerKey);
        if (data.customSize) setCustomSize(data.customSize);
        refreshObjects();
        attachTransformForSelection([]);
      } catch (error) {
        setBooleanMessage(`載入失敗：${error.message}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <TopToolbar>
        <div className="toolbar-group">
          <button onClick={undo} disabled={!historyRef.current.length}>復原 Undo</button>
          <button onClick={redo} disabled={!redoRef.current.length}>重做 Redo</button>
          <button onClick={() => setMultiSelect((value) => !value)} className={multiSelect ? 'active' : ''}>多選</button>
          <button onClick={() => addShape('cube')}><Box size={18} />新增</button>
          <button onClick={duplicateSelected} disabled={!selectedIds.length}><Copy size={18} />複製</button>
          <button className="danger" onClick={deleteSelected} disabled={!selectedIds.length}><Trash2 size={18} />刪除</button>
          <button onClick={centerSelectedOnPlate} disabled={!selectedIds.length}>置中</button>
          <button onClick={dropSelectedToPlate} disabled={!selectedIds.length}>貼齊平台</button>
          <button onClick={() => mirrorSelected('x')} disabled={!selectedIds.length}>鏡像 X</button>
          <button onClick={() => mirrorSelected('y')} disabled={!selectedIds.length}>鏡像 Y</button>
          <button onClick={groupSelected} disabled={selectedIds.length < 2}>群組</button>
          <button onClick={ungroupSelected} disabled={!primarySelected?.isGroup}>取消群組</button>
          <button onClick={mergeSelected} disabled={selectedIds.length < 2}>合併</button>
          <button onClick={() => setSelectedMode('solid')} disabled={!selectedIds.length}>設為實體</button>
          <button onClick={() => setSelectedMode('hole')} disabled={!selectedIds.length}>設為洞</button>
          <button onClick={applyHole} disabled={selectedIds.length < 2}>套用打洞</button>
        </div>
        <div className="toolbar-group">
          <button onClick={() => exportModel('stl')} disabled={!objects.length}><Download size={18} />STL</button>
          <button onClick={() => exportModel('obj')} disabled={!objects.length}><Download size={18} />OBJ</button>
          <button onClick={saveProject}>儲存專案</button>
          <button onClick={() => fileInputRef.current?.click()}>載入專案</button>
          <input ref={fileInputRef} className="hidden-input" type="file" accept="application/json,.json" onChange={loadProjectFile} />
          <button onClick={resetCameraView}>重設視角</button>
        </div>
        <label className="switch-control">
          <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} />
          <span>{snapEnabled ? '啟用吸附' : '關閉吸附'}</span>
        </label>
        <label className="select-field">
          <span>列印機</span>
          <select value={printerKey} onChange={(event) => setPrinterKey(event.target.value)}>
            {Object.entries(PRINTERS).map(([key, printer]) => <option key={key} value={key}>{printer.label}</option>)}
          </select>
        </label>
      </TopToolbar>

      <LeftPanel>
        <div className="brand"><span className="brand-mark">mm</span><span>Print Modeler</span></div>
        <div className="tool-section">
          <span className="section-label">基本形狀</span>
          {Object.entries(SHAPES).map(([type, shape]) => {
            const Icon = shape.icon;
            return <button key={type} className="tool-button" onClick={() => addShape(type)}><Icon size={20} /><span>{shape.label}</span></button>;
          })}
          <button className="tool-button" onClick={addText}><Type size={20} /><span>文字</span></button>
        </div>
        <div className="tool-section">
          <span className="section-label">模板</span>
          {TEMPLATES.map((template) => {
            const Icon = template.icon;
            return <button key={template.type} className="tool-button" onClick={() => addTemplate(template.type)}><Icon size={20} /><span>{template.label}</span></button>;
          })}
        </div>
        <TemplateSettings settings={templateSettings} onChange={updateTemplateSetting} />
        <div className="tool-section">
          <span className="section-label">變形工具</span>
          <div className="segmented">
            {MODE_BUTTONS.map((item) => {
              const Icon = item.icon;
              return <button key={item.mode} className={mode === item.mode ? 'active' : ''} onClick={() => setMode(item.mode)} title={item.label}><Icon size={18} /></button>;
            })}
          </div>
        </div>
      </LeftPanel>

      <section className="viewport-wrap">
        <div className="viewport-topbar">
          <span>{objects.length} objects</span>
          <span>{selectedIds.length} selected</span>
          <span>{printerSize.x} x {printerSize.y} x {printerSize.z} mm</span>
          <span>{selected ? selected.name : '未選取物件'}</span>
        </div>
        <div ref={mountRef} className="three-viewport" />
      </section>

      <RightPanel>
        <div className="panel-header">
          <h1>屬性</h1>
          <span>{selectedIds.length} selected</span>
        </div>
        <div className="printer-card">
          <div className="card-title">列印平台</div>
          <div className="platform-size">{printerSize.x} x {printerSize.y} x {printerSize.z} mm</div>
          {printerKey === 'custom' && (
            <TransformFields title="自訂尺寸" unit="mm" data={customSize} onChange={(axis, value) => setCustomSize((size) => ({ ...size, [axis]: Math.max(10, Number(value) || 10) }))} step="1" />
          )}
        </div>

        <section className="printer-card">
          <div className="card-title">物件清單</div>
          <div className="object-list">
            {objects.length ? objects.map((object) => (
              <button
                key={object.uuid}
                className={selectedIds.includes(object.uuid) ? 'selected' : ''}
                onClick={() => updateSelection(object, multiSelect)}
              >
                <span>{object.name}</span>
                <small>{object.userData.mode === 'hole' ? 'Hole' : 'Solid'}</small>
              </button>
            )) : <span className="muted">尚無物件</span>}
          </div>
        </section>

        {selected ? (
          <div className="property-stack">
            <label className="field"><span>名稱</span><input value={primarySelected?.name || selected.name} onChange={(event) => updateSelected('name', null, event.target.value)} /></label>
            <div className="row-fields">
              <label className="field"><span>物件模式</span><select value={primarySelected?.userData.mode || 'solid'} onChange={(event) => updateSelected('mode', null, event.target.value)}><option value="solid">Solid</option><option value="hole">Hole</option></select></label>
              <label className="field"><span>顏色</span><input type="color" value={primarySelected?.userData.color || '#38bdf8'} onChange={(event) => updateSelected('color', null, event.target.value)} /></label>
            </div>
            <TransformFields title="位置" unit="mm" data={selected.position} onChange={(axis, value) => updateSelected('position', axis, value)} />
            <TransformFields title="旋轉" unit="deg" data={selected.rotation} onChange={(axis, value) => updateSelected('rotation', axis, value)} step="15" />
            <TransformFields title="實際尺寸" unit="mm" data={selected.dimensions} onChange={(axis, value) => updateSelected('dimensions', axis, value)} step="1" labels={{ x: '寬 X', y: '深 Y', z: '高 Z' }} />
            {selected.shapeType === 'cube' && <BevelFields selected={selected} onChange={updateSelected} />}
            {selected.shapeType === 'text' && <TextFields selected={selected} onChange={updateSelected} />}
            {booleanMessage && <div className="notice">{booleanMessage}</div>}
            <PrintCheckPanel check={selectedCheck} stats={printStats} />
          </div>
        ) : (
          <div className="empty-state"><Move3D size={32} /><p>請選取物件</p></div>
        )}
      </RightPanel>
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function TransformFields({ title, data, onChange, step = '0.1', unit, labels = { x: 'X', y: 'Y', z: 'Z' } }) {
  return (
    <fieldset className="transform-group">
      <legend>{title}</legend>
      {axes.map((axis) => (
        <label key={axis} className="axis-field">
          <span>{labels[axis]} {unit}</span>
          <input type="number" step={step} value={data[axis]} onChange={(event) => onChange(axis, event.target.value)} />
        </label>
      ))}
    </fieldset>
  );
}

function BevelFields({ selected, onChange }) {
  return (
    <section className="printer-card">
      <div className="card-title">倒角 / 圓角</div>
      <div className="row-fields">
        <label className="field"><span>倒角半徑 mm</span><input type="number" step="0.5" min="0" value={selected.bevelRadius} onChange={(event) => onChange('bevelRadius', null, event.target.value)} /></label>
        <label className="field"><span>倒角段數</span><input type="number" step="1" min="1" value={selected.bevelSegments} onChange={(event) => onChange('bevelSegments', null, event.target.value)} /></label>
      </div>
    </section>
  );
}

function TextFields({ selected, onChange }) {
  const settings = selected.textSettings || { text: 'TEXT', size: 18, depth: 4, align: 'center' };
  return (
    <section className="printer-card">
      <div className="card-title">文字設定</div>
      <label className="field"><span>文字內容</span><input value={settings.text} onChange={(event) => onChange('textSettings', 'text', event.target.value)} /></label>
      <div className="row-fields">
        <label className="field"><span>字體大小 mm</span><input type="number" value={settings.size} onChange={(event) => onChange('textSettings', 'size', event.target.value)} /></label>
        <label className="field"><span>厚度 mm</span><input type="number" value={settings.depth} onChange={(event) => onChange('textSettings', 'depth', event.target.value)} /></label>
      </div>
      <label className="field"><span>對齊方式</span><select value={settings.align} onChange={(event) => onChange('textSettings', 'align', event.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
    </section>
  );
}

function TemplateSettings({ settings, onChange }) {
  return (
    <section className="template-settings">
      <span className="section-label">模板設定</span>
      <details>
        <summary>手機支架</summary>
        <MiniNumber label="寬度" value={settings.phoneStand.width} onChange={(value) => onChange('phoneStand', 'width', value)} />
        <MiniNumber label="深度" value={settings.phoneStand.depth} onChange={(value) => onChange('phoneStand', 'depth', value)} />
        <MiniNumber label="背板高度" value={settings.phoneStand.backHeight} onChange={(value) => onChange('phoneStand', 'backHeight', value)} />
        <MiniNumber label="背板角度" value={settings.phoneStand.angle} onChange={(value) => onChange('phoneStand', 'angle', value)} />
        <MiniNumber label="止滑唇高度" value={settings.phoneStand.lipHeight} onChange={(value) => onChange('phoneStand', 'lipHeight', value)} />
      </details>
      <details>
        <summary>方形收納盒</summary>
        <MiniNumber label="寬度" value={settings.storageBox.width} onChange={(value) => onChange('storageBox', 'width', value)} />
        <MiniNumber label="深度" value={settings.storageBox.depth} onChange={(value) => onChange('storageBox', 'depth', value)} />
        <MiniNumber label="高度" value={settings.storageBox.height} onChange={(value) => onChange('storageBox', 'height', value)} />
        <MiniNumber label="牆厚" value={settings.storageBox.wall} onChange={(value) => onChange('storageBox', 'wall', value)} />
      </details>
      <details>
        <summary>圓形底座</summary>
        <MiniNumber label="直徑" value={settings.roundBase.diameter} onChange={(value) => onChange('roundBase', 'diameter', value)} />
        <MiniNumber label="高度" value={settings.roundBase.height} onChange={(value) => onChange('roundBase', 'height', value)} />
      </details>
      <details>
        <summary>公仔底座</summary>
        <MiniNumber label="直徑" value={settings.figureBase.diameter} onChange={(value) => onChange('figureBase', 'diameter', value)} />
        <MiniNumber label="高度" value={settings.figureBase.height} onChange={(value) => onChange('figureBase', 'height', value)} />
        <label className="mini-check">
          <input type="checkbox" checked={settings.figureBase.nameplate} onChange={(event) => onChange('figureBase', 'nameplate', event.target.checked)} />
          <span>名牌</span>
        </label>
      </details>
    </section>
  );
}

function MiniNumber({ label, value, onChange }) {
  return (
    <label className="mini-field">
      <span>{label}</span>
      <input type="number" min="0.5" step="1" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function PrintCheckPanel({ check, stats }) {
  if (!check) return null;
  return (
    <section className="print-check">
      <div className="card-title">列印檢查</div>
      <StatusRow label="平台範圍" ok={!check.outside} badText="超出平台" goodText="未超出平台" />
      <StatusRow label="低於平台" ok={!check.belowPlatform} badText="Z < 0，低於平台" goodText="未低於平台" />
      <StatusRow label="接觸平台" ok={!check.floating} badText="物件懸空" goodText="已接觸平台" />
      <StatusRow label="薄件風險" ok={!check.tooThin} badText="太薄，可能無法列印" goodText="厚度正常" />
      <div className="dimension-readout">
        <span>寬度 X {check.dimensions.x} mm</span>
        <span>深度 Y {check.dimensions.y} mm</span>
        <span>高度 Z {check.dimensions.z} mm</span>
      </div>
      {stats && (
        <div className="dimension-readout warning-readout">
          <span>模型總尺寸 {stats.totalSize.x} x {stats.totalSize.y} x {stats.totalSize.z} mm</span>
          <span>物件數 {stats.objectCount} / Solid {stats.solidCount} / Hole {stats.holeCount}</span>
          <span>超出平台 {stats.outsideCount} / 低於平台 {stats.belowPlatformCount}</span>
          <span>懸空 {stats.floatingCount} / 小於 1mm {stats.thinCount}</span>
        </div>
      )}
    </section>
  );
}

function StatusRow({ label, ok, goodText, badText }) {
  return <div className={`status-row ${ok ? 'ok' : 'bad'}`}><span>{label}</span><strong>{ok ? goodText : badText}</strong></div>;
}

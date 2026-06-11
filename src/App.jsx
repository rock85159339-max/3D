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
  Move3D,
  RotateCw,
  Scale,
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
  torus: { label: 'Torus', icon: Circle, size: { x: 30, y: 30, z: 5 } },
  cone: { label: 'Cone', icon: Cylinder, size: { x: 25, y: 25, z: 35 } },
};

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

function makeEditableGeometry(mesh) {
  if (!mesh?.geometry) return null;
  if (mesh.geometry.index) {
    const nextGeometry = mesh.geometry.toNonIndexed();
    nextGeometry.computeVertexNormals();
    mesh.geometry.dispose();
    mesh.geometry = nextGeometry;
  }
  return mesh.geometry;
}

function readTriangle(geometry, faceIndex) {
  if (!geometry?.attributes?.position) return null;
  const position = geometry.attributes.position;
  const offset = faceIndex * 9;
  if (!position || offset + 8 >= position.array.length) return null;
  const a = new THREE.Vector3(position.array[offset], position.array[offset + 1], position.array[offset + 2]);
  const b = new THREE.Vector3(position.array[offset + 3], position.array[offset + 4], position.array[offset + 5]);
  const c = new THREE.Vector3(position.array[offset + 6], position.array[offset + 7], position.array[offset + 8]);
  const center = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
  const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  return { a, b, c, center, normal, indices: [faceIndex * 3, faceIndex * 3 + 1, faceIndex * 3 + 2] };
}

function setPositionAt(attribute, index, point) {
  attribute.setXYZ(index, point.x, point.y, point.z);
}

function getFalloffWeight(distance, radius, falloff) {
  const t = THREE.MathUtils.clamp(1 - distance / Math.max(radius, 0.001), 0, 1);
  if (falloff === 'linear') return t;
  return t * t * (3 - 2 * t);
}

function vertexKey(vector, precision = 10000) {
  return `${Math.round(vector.x * precision)},${Math.round(vector.y * precision)},${Math.round(vector.z * precision)}`;
}

function edgeKey(a, b) {
  return [vertexKey(a), vertexKey(b)].sort().join('|');
}

function subdivideTriangleGeometry(sourceGeometry, iterations = 1) {
  let geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
  for (let step = 0; step < iterations; step += 1) {
    const position = geometry.attributes.position;
    const nextPositions = [];
    for (let i = 0; i < position.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(position, i);
      const b = new THREE.Vector3().fromBufferAttribute(position, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(position, i + 2);
      const ab = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const bc = new THREE.Vector3().addVectors(b, c).multiplyScalar(0.5);
      const ca = new THREE.Vector3().addVectors(c, a).multiplyScalar(0.5);
      [a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca].forEach((point) => nextPositions.push(point.x, point.y, point.z));
    }
    geometry.dispose();
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(nextPositions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
  return geometry;
}

function smoothGeometryLaplacian(sourceGeometry, strength = 0.35, iterations = 2) {
  const geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
  const position = geometry.attributes.position;
  const amount = THREE.MathUtils.clamp(Number(strength) || 0.35, 0.1, 1) * 0.45;
  const passes = Math.max(1, Math.min(10, Math.floor(Number(iterations) || 1)));

  for (let pass = 0; pass < passes; pass += 1) {
    const groups = new Map();
    const adjacency = new Map();
    const current = [];

    for (let i = 0; i < position.count; i += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(position, i);
      const key = vertexKey(point);
      current[i] = point;
      if (!groups.has(key)) groups.set(key, { indices: [], point: point.clone() });
      groups.get(key).indices.push(i);
      if (!adjacency.has(key)) adjacency.set(key, new Set());
    }

    for (let i = 0; i < position.count; i += 3) {
      const keys = [vertexKey(current[i]), vertexKey(current[i + 1]), vertexKey(current[i + 2])];
      [[0, 1], [1, 2], [2, 0]].forEach(([from, to]) => {
        adjacency.get(keys[from])?.add(keys[to]);
        adjacency.get(keys[to])?.add(keys[from]);
      });
    }

    const nextByKey = new Map();
    groups.forEach((group, key) => {
      const neighbors = [...(adjacency.get(key) || [])].map((neighborKey) => groups.get(neighborKey)?.point).filter(Boolean);
      if (!neighbors.length) {
        nextByKey.set(key, group.point.clone());
        return;
      }
      const average = neighbors.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / neighbors.length);
      nextByKey.set(key, group.point.clone().lerp(average, amount));
    });

    groups.forEach((group, key) => {
      const next = nextByKey.get(key);
      group.indices.forEach((index) => position.setXYZ(index, next.x, next.y, next.z));
    });
    position.needsUpdate = true;
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function inspectMeshGeometry(mesh, root, printerSize) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const position = geometry.attributes.position;
  const rootBounds = getObjectBounds(root);
  const halfX = printerSize.x / 2;
  const halfY = printerSize.y / 2;
  let invalidVertexCount = 0;
  let degenerateTriangleCount = 0;
  const edgeUse = new Map();

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (![x, y, z].every(Number.isFinite)) invalidVertexCount += 1;
  }

  for (let i = 0; i < position.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, i);
    const b = new THREE.Vector3().fromBufferAttribute(position, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, i + 2);
    const area = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() * 0.5;
    if (area < 0.000001) degenerateTriangleCount += 1;
    [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)].forEach((key) => edgeUse.set(key, (edgeUse.get(key) || 0) + 1));
  }

  if (geometry !== mesh.geometry) geometry.dispose();
  const openEdgeCount = [...edgeUse.values()].filter((count) => count === 1).length;
  const size = rootBounds.size;
  const outside = rootBounds.box.min.x < -halfX || rootBounds.box.max.x > halfX || rootBounds.box.min.y < -halfY || rootBounds.box.max.y > halfY || rootBounds.box.max.z > printerSize.z;

  return {
    triangleCount: Math.floor(position.count / 3),
    vertexCount: position.count,
    belowPlatform: rootBounds.box.min.z < -0.01,
    outside,
    tooThin: size.x < 1 || size.y < 1 || size.z < 1,
    invalidVertexCount,
    openEdgeCount,
    degenerateTriangleCount,
  };
}

function createShape(type, index = 0) {
  const def = SHAPES[type];
  const color = `#${palette[index % palette.length].toString(16).padStart(6, '0')}`;
  let object;

  if (type === 'sphere') {
    object = new THREE.Mesh(new THREE.SphereGeometry(def.size.x / 2, 48, 28), makeMaterial(new THREE.Color(color)));
  } else if (type === 'cylinder') {
    object = makeCylinder(def.label, def.size.x / 2, def.size.z, new THREE.Color(color));
  } else if (type === 'torus') {
    const geometry = new THREE.TorusGeometry(12.5, 2.5, 24, 72);
    object = new THREE.Mesh(geometry, makeMaterial(new THREE.Color(color)));
  } else if (type === 'cone') {
    const geometry = new THREE.ConeGeometry(def.size.x / 2, def.size.z, 48);
    geometry.rotateX(Math.PI / 2);
    object = new THREE.Mesh(geometry, makeMaterial(new THREE.Color(color)));
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
  const faceHelperRef = useRef(null);
  const normalArrowRef = useRef(null);
  const brushPreviewRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const objectsRef = useRef([]);
  const selectedIdsRef = useRef([]);
  const selectedRef = useRef(null);
  const selectionGroupRef = useRef(null);
  const currentFaceRef = useRef(null);
  const editModeRef = useRef('object');
  const sculptSettingsRef = useRef({ brushMode: 'raise', radius: 15, strength: 0.35, falloff: 'smooth' });
  const sculptActiveRef = useRef(false);
  const sculptSnapshotRef = useRef(null);
  const sculptChangedRef = useRef(false);
  const modeRef = useRef('translate');
  const snapRef = useRef(true);
  const multiSelectRef = useRef(false);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const toastTimerRef = useRef(null);
  const objectCountRef = useRef(0);
  const activeWorkflowRef = useRef('model');
  const autosaveReadyRef = useRef(false);
  const [objects, setObjects] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeWorkflow, setActiveWorkflow] = useState('model');
  const [projectName, setProjectName] = useState('Untitled Model');
  const [lastAutosave, setLastAutosave] = useState('');
  const [showGuide, setShowGuide] = useState(() => localStorage.getItem('printModeler.hideGuide') !== 'true');
  const [editMode, setEditMode] = useState('object');
  const [faceSelection, setFaceSelection] = useState(null);
  const [faceSettings, setFaceSettings] = useState({ distance: 5, radius: 20, softEdit: false, smoothStrength: 0.5 });
  const [sculptSettings, setSculptSettings] = useState({ brushMode: 'raise', radius: 15, strength: 0.35, falloff: 'smooth' });
  const [printPrepSettings, setPrintPrepSettings] = useState({ subdivideIterations: 1, smoothStrength: 0.35, smoothIterations: 2 });
  const [meshCheckResults, setMeshCheckResults] = useState(null);
  const [mode, setMode] = useState('translate');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [multiSelect, setMultiSelect] = useState(false);
  const [printerKey, setPrinterKey] = useState('h2d');
  const [customSize, setCustomSize] = useState({ x: 256, y: 256, z: 256 });
  const [arraySettings, setArraySettings] = useState({ count: 5, x: 30, y: 0, z: 0 });
  const [booleanMessage, setBooleanMessage] = useState('');
  const [toast, setToast] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);

  const printerSize = printerKey === 'custom' ? customSize : PRINTERS[printerKey].size;
  const selectedObjects = useMemo(() => objectsRef.current.filter((object) => selectedIds.includes(object.uuid)), [selectedIds, objects]);
  const primarySelected = selectedObjects[0] || null;
  const selectedCheck = primarySelected ? printCheck(primarySelected, printerSize) : null;
  const printStats = useMemo(() => getPrintStats(objectsRef.current, printerSize), [objects, printerSize.x, printerSize.y, printerSize.z]);

  function switchWorkflow(nextWorkflow) {
    setActiveWorkflow(nextWorkflow);
    activeWorkflowRef.current = nextWorkflow;
    if (nextWorkflow === 'face') setEditMode('face');
    else if (nextWorkflow === 'sculpt') setEditMode('sculpt');
    else setEditMode('object');
  }

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

    window.setTimeout(() => {
      const saved = localStorage.getItem('printModeler.autosave');
      if (saved && window.confirm('偵測到自動儲存的專案，要恢復嗎？')) {
        try {
          loadProjectData(JSON.parse(saved));
          const time = localStorage.getItem('printModeler.autosaveTime');
          if (time) setLastAutosave(time);
          showToast('已恢復自動儲存');
        } catch (error) {
          showToast(`恢復自動儲存失敗：${error.message}`);
        }
      }
      autosaveReadyRef.current = true;
    }, 350);

    const onPointerDown = (event) => {
      if (transform.dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      if (editModeRef.current === 'sculpt') {
        if (event.button !== 0) return;
        beginSculptStroke();
        return;
      }
      if (editModeRef.current === 'face') {
        pickFaceFromPointer();
        return;
      }
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

    const onPointerMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      if (editModeRef.current !== 'sculpt') return;
      continueSculptStroke();
    };

    const onPointerUp = () => {
      if (editModeRef.current === 'sculpt') endSculptStroke();
    };

    const onPointerLeave = () => {
      if (editModeRef.current === 'sculpt') {
        hideBrushPreview();
        endSculptStroke();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

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
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      clearBrushPreview();
      transform.dispose();
      orbit.dispose();
      disposeObject(scene);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!autosaveReadyRef.current) return;
      const payload = makeProjectPayload();
      const time = new Date().toLocaleTimeString();
      localStorage.setItem('printModeler.autosave', JSON.stringify(payload));
      localStorage.setItem('printModeler.autosaveTime', time);
      setLastAutosave(time);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [projectName, printerKey, customSize, objects, historyVersion]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tagName = event.target?.tagName?.toLowerCase();
      const typing = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || event.target?.isContentEditable;
      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      } else if (event.key.toLowerCase() === 'y') {
        if (!event.ctrlKey) return;
        event.preventDefault();
        redo();
      } else if (!typing && event.key.toLowerCase() === 'w') {
        setMode('translate');
      } else if (!typing && event.key.toLowerCase() === 'e') {
        setMode('rotate');
      } else if (!typing && event.key.toLowerCase() === 'r') {
        setMode('scale');
      } else if (!typing && event.key === 'Delete') {
        deleteSelected();
      } else if (!typing && event.key === '1') {
        switchWorkflow('model');
      } else if (!typing && event.key === '2') {
        switchWorkflow('face');
      } else if (!typing && event.key === '3') {
        switchWorkflow('sculpt');
      } else if (!typing && event.key === '4') {
        switchWorkflow('prep');
      } else if (!typing && event.key === '5') {
        switchWorkflow('export');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    multiSelectRef.current = multiSelect;
  }, [multiSelect]);

  useEffect(() => {
    editModeRef.current = editMode;
    const transform = transformRef.current;
    if (!transform) return;
    if (editMode === 'face' || editMode === 'sculpt') {
      if (!selectedIdsRef.current.length) showToast('請先選取一個 mesh 物件');
      transform.detach();
      detachSelectionGroup();
      if (editMode === 'face') hideBrushPreview();
      if (editMode === 'sculpt') clearFaceHelper();
      setSelected(primarySelected ? readTransform(primarySelected) : null);
    } else {
      clearFaceHelper();
      hideBrushPreview();
      endSculptStroke();
      attachTransformForSelection(selectedIdsRef.current);
    }
  }, [editMode]);

  useEffect(() => {
    sculptSettingsRef.current = sculptSettings;
    const hit = editModeRef.current === 'sculpt' ? getSculptHit() : null;
    if (hit) updateBrushPreview(hit);
  }, [sculptSettings]);

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

  function makeProjectPayload() {
    return {
      version: 3,
      projectName,
      printerKey,
      customSize,
      objects: objectsRef.current.map(objectToProjectData),
    };
  }

  function makeSnapshot() {
    return makeProjectPayload();
  }

  function loadProjectData(data) {
    detachSelectionGroup();
    clearFaceHelper();
    hideBrushPreview();
    objectsRef.current.forEach((object) => {
      sceneRef.current.remove(object);
      disposeObject(object);
    });
    objectsRef.current = (data.objects || []).map(objectFromProjectData);
    objectsRef.current.forEach((object) => sceneRef.current.add(object));
    if (data.projectName) setProjectName(data.projectName);
    if (data.printerKey) setPrinterKey(data.printerKey);
    if (data.customSize) setCustomSize(data.customSize);
    refreshObjects();
    attachTransformForSelection([]);
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
    clearFaceHelper();
    hideBrushPreview();
    endSculptStroke();
    objectsRef.current.forEach((object) => {
      sceneRef.current.remove(object);
      disposeObject(object);
    });
    objectsRef.current = (snapshot.objects || []).map(objectFromProjectData);
    objectsRef.current.forEach((object) => sceneRef.current.add(object));
    if (snapshot.projectName) setProjectName(snapshot.projectName);
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

  function clearFaceHelper() {
    const scene = sceneRef.current;
    if (!scene) return;
    if (faceHelperRef.current) {
      scene.remove(faceHelperRef.current);
      faceHelperRef.current.geometry?.dispose?.();
      faceHelperRef.current.material?.dispose?.();
      faceHelperRef.current = null;
    }
    if (normalArrowRef.current) {
      scene.remove(normalArrowRef.current);
      normalArrowRef.current.cone?.geometry?.dispose?.();
      normalArrowRef.current.cone?.material?.dispose?.();
      normalArrowRef.current.line?.geometry?.dispose?.();
      normalArrowRef.current.line?.material?.dispose?.();
      normalArrowRef.current = null;
    }
    currentFaceRef.current = null;
    setFaceSelection(null);
  }

  function ensureBrushPreview() {
    const scene = sceneRef.current;
    if (!scene) return null;
    if (brushPreviewRef.current) return brushPreviewRef.current;
    const points = [];
    for (let i = 0; i < 96; i += 1) {
      const angle = (i / 96) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const preview = new THREE.LineLoop(geometry, material);
    preview.visible = false;
    preview.renderOrder = 30;
    preview.userData.helper = true;
    scene.add(preview);
    brushPreviewRef.current = preview;
    return preview;
  }

  function hideBrushPreview() {
    if (brushPreviewRef.current) brushPreviewRef.current.visible = false;
  }

  function clearBrushPreview() {
    const scene = sceneRef.current;
    if (!scene || !brushPreviewRef.current) return;
    scene.remove(brushPreviewRef.current);
    brushPreviewRef.current.geometry?.dispose?.();
    brushPreviewRef.current.material?.dispose?.();
    brushPreviewRef.current = null;
  }

  function getSculptTarget() {
    const root = objectsRef.current.find((object) => object.uuid === selectedIdsRef.current[0]);
    if (!root) return { root: null, meshes: [] };
    return { root, meshes: getPrintableMeshes(root) };
  }

  function getSculptHit() {
    const { root, meshes } = getSculptTarget();
    if (!root || !meshes.length) return null;
    const hits = raycasterRef.current.intersectObjects(meshes, false);
    return hits[0] || null;
  }

  function updateBrushPreview(hit) {
    const preview = ensureBrushPreview();
    if (!preview || !hit?.object || hit.faceIndex == null) {
      hideBrushPreview();
      return;
    }
    const mesh = hit.object;
    const geometry = makeEditableGeometry(mesh);
    const triangle = readTriangle(geometry, hit.faceIndex);
    if (!triangle) {
      hideBrushPreview();
      return;
    }
    mesh.updateWorldMatrix(true, false);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const worldNormal = triangle.normal.clone().applyMatrix3(normalMatrix).normalize();
    preview.position.copy(hit.point).addScaledVector(worldNormal, 0.35);
    preview.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
    const radius = Math.max(0.5, Number(sculptSettingsRef.current.radius) || 15);
    preview.scale.set(radius, radius, radius);
    preview.visible = true;
  }

  function showFaceHelper(mesh, faceIndex) {
    const scene = sceneRef.current;
    if (!scene || !mesh) return;
    clearFaceHelper();
    const geometry = makeEditableGeometry(mesh);
    const triangle = readTriangle(geometry, faceIndex);
    if (!triangle) return;

    mesh.updateWorldMatrix(true, false);
    const a = triangle.a.clone().applyMatrix4(mesh.matrixWorld);
    const b = triangle.b.clone().applyMatrix4(mesh.matrixWorld);
    const c = triangle.c.clone().applyMatrix4(mesh.matrixWorld);
    const center = triangle.center.clone().applyMatrix4(mesh.matrixWorld);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const worldNormal = triangle.normal.clone().applyMatrix3(normalMatrix).normalize();

    const helperGeometry = new THREE.BufferGeometry().setFromPoints([a, b, c]);
    helperGeometry.setIndex([0, 1, 2]);
    helperGeometry.computeVertexNormals();
    const helper = new THREE.Mesh(
      helperGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    );
    helper.renderOrder = 20;
    helper.userData.helper = true;
    scene.add(helper);
    faceHelperRef.current = helper;

    const arrow = new THREE.ArrowHelper(worldNormal, center, 16, 0xfacc15, 5, 2.5);
    arrow.userData.helper = true;
    scene.add(arrow);
    normalArrowRef.current = arrow;

    currentFaceRef.current = { mesh, faceIndex, normal: triangle.normal.clone(), center: triangle.center.clone() };
    setFaceSelection({
      faceIndex,
      meshName: mesh.name || mesh.parent?.name || 'Mesh',
      normal: {
        x: roundNumber(worldNormal.x, 3),
        y: roundNumber(worldNormal.y, 3),
        z: roundNumber(worldNormal.z, 3),
      },
    });
  }

  function pickFaceFromPointer() {
    const root = objectsRef.current.find((object) => object.uuid === selectedIdsRef.current[0]);
    if (!root) {
      showToast('請先選取一個物件');
      return;
    }
    const meshes = getPrintableMeshes(root);
    const hits = raycasterRef.current.intersectObjects(meshes, false);
    const hit = hits[0];
    if (!hit?.object || hit.faceIndex == null) {
      clearFaceHelper();
      showToast('請點選模型表面');
      return;
    }
    makeEditableGeometry(hit.object);
    showFaceHelper(hit.object, hit.faceIndex);
  }

  function applySculptStroke(hit) {
    if (!hit?.object || hit.faceIndex == null) return false;
    const mesh = hit.object;
    const geometry = makeEditableGeometry(mesh);
    const triangle = readTriangle(geometry, hit.faceIndex);
    if (!triangle) return false;

    const settings = sculptSettingsRef.current;
    const radius = Math.max(0.5, Number(settings.radius) || 15);
    const strength = THREE.MathUtils.clamp(Number(settings.strength) || 0, 0, 1);
    if (strength <= 0) return false;

    const position = geometry.attributes.position;
    const normalAttribute = geometry.attributes.normal;
    const localPoint = mesh.worldToLocal(hit.point.clone());
    const brushNormal = triangle.normal.clone().normalize();
    const deltaDistance = radius * 0.075 * strength;
    const affected = [];

    for (let i = 0; i < position.count; i += 1) {
      const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
      const distance = vertex.distanceTo(localPoint);
      if (distance > radius) continue;
      const weight = getFalloffWeight(distance, radius, settings.falloff);
      if (weight <= 0) continue;
      affected.push({ index: i, vertex, distance, weight });
    }
    if (!affected.length) return false;

    if (settings.brushMode === 'smooth') {
      const vertices = [];
      for (let i = 0; i < position.count; i += 1) vertices.push(new THREE.Vector3().fromBufferAttribute(position, i));
      affected.forEach(({ index, vertex, weight }) => {
        const nearby = vertices.filter((candidate) => candidate.distanceTo(vertex) <= radius * 0.45);
        if (nearby.length < 2) return;
        const average = nearby.reduce((sum, candidate) => sum.add(candidate), new THREE.Vector3()).multiplyScalar(1 / nearby.length);
        setPositionAt(position, index, vertex.clone().lerp(average, strength * weight * 0.6));
      });
    } else if (settings.brushMode === 'flatten') {
      affected.forEach(({ index, vertex, weight }) => {
        const offset = vertex.clone().sub(localPoint).dot(brushNormal);
        const next = vertex.clone().addScaledVector(brushNormal, -offset * weight * strength);
        setPositionAt(position, index, next);
      });
    } else {
      affected.forEach(({ index, vertex, weight }) => {
        let direction = brushNormal;
        let sign = 1;
        if (settings.brushMode === 'lower') sign = -1;
        if (settings.brushMode === 'inflate' && normalAttribute) {
          direction = new THREE.Vector3().fromBufferAttribute(normalAttribute, index).normalize();
        }
        const next = vertex.clone().addScaledVector(direction, deltaDistance * weight * sign);
        setPositionAt(position, index, next);
      });
    }

    updateEditedMesh(mesh);
    sculptChangedRef.current = true;
    return true;
  }

  function beginSculptStroke() {
    const { root } = getSculptTarget();
    if (!root) {
      showToast('請先選取要雕刻的物件');
      return;
    }
    const hit = getSculptHit();
    if (!hit?.object) {
      hideBrushPreview();
      return;
    }
    makeEditableGeometry(hit.object);
    sculptActiveRef.current = true;
    sculptChangedRef.current = false;
    sculptSnapshotRef.current = makeSnapshot();
    if (orbitRef.current) orbitRef.current.enabled = false;
    updateBrushPreview(hit);
    applySculptStroke(hit);
  }

  function continueSculptStroke() {
    const hit = getSculptHit();
    updateBrushPreview(hit);
    if (!sculptActiveRef.current || !hit?.object) return;
    applySculptStroke(hit);
  }

  function endSculptStroke() {
    if (!sculptActiveRef.current) return;
    sculptActiveRef.current = false;
    if (orbitRef.current) orbitRef.current.enabled = true;
    if (sculptChangedRef.current && sculptSnapshotRef.current) {
      historyRef.current.push(sculptSnapshotRef.current);
      if (historyRef.current.length > 80) historyRef.current.shift();
      redoRef.current = [];
      setHistoryVersion((version) => version + 1);
      showToast('已完成雕刻筆刷');
    }
    sculptSnapshotRef.current = null;
    sculptChangedRef.current = false;
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
    clearFaceHelper();
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
      if (editModeRef.current === 'object') transform.attach(selectedItems[0]);
      else transform.detach();
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
    if (editModeRef.current === 'object') transform.attach(selectionGroup);
    else transform.detach();
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
    const source = primarySelected;
    if (!source) {
      showToast('沒有選取物件');
      return;
    }
    pushHistory('mirror');
    detachSelectionGroup();
    const clone = clonePrintable(source);
    clone.position[axis] = -source.position[axis];
    clone.scale[axis] *= -1;
    clone.name = `${source.name} Mirror ${axis.toUpperCase()}`;
    objectsRef.current.push(clone);
    sceneRef.current.add(clone);
    refreshObjects();
    attachTransformForSelection([clone.uuid]);
    showToast('已建立鏡像物件');
  }

  function alignSelected(axis, modeName) {
    const selectedItems = objectsRef.current.filter((object) => selectedIdsRef.current.includes(object.uuid));
    if (selectedItems.length < 2) {
      showToast('請至少選取 2 個物件才能對齊');
      return;
    }
    pushHistory('align');
    const base = getObjectBounds(selectedItems[0]).box;
    const targetValue = modeName === 'min' ? base.min[axis] : modeName === 'max' ? base.max[axis] : (base.min[axis] + base.max[axis]) / 2;
    selectedItems.slice(1).forEach((object) => {
      const box = getObjectBounds(object).box;
      const ownValue = modeName === 'min' ? box.min[axis] : modeName === 'max' ? box.max[axis] : (box.min[axis] + box.max[axis]) / 2;
      object.position[axis] += targetValue - ownValue;
    });
    refreshObjects();
    attachTransformForSelection(selectedItems.map((object) => object.uuid));
    showToast('已對齊物件');
  }

  function arrayDuplicate() {
    const source = primarySelected;
    if (!source) {
      showToast('沒有選取物件');
      return;
    }
    const count = Math.max(2, Math.floor(Number(arraySettings.count) || 2));
    pushHistory('array duplicate');
    detachSelectionGroup();
    const clones = [];
    for (let i = 1; i < count; i += 1) {
      const clone = clonePrintable(source);
      clone.name = `${source.name} Array ${i + 1}`;
      clone.position.x = source.position.x + i * (Number(arraySettings.x) || 0);
      clone.position.y = source.position.y + i * (Number(arraySettings.y) || 0);
      clone.position.z = source.position.z + i * (Number(arraySettings.z) || 0);
      objectsRef.current.push(clone);
      sceneRef.current.add(clone);
      clones.push(clone);
    }
    refreshObjects();
    attachTransformForSelection([source.uuid, ...clones.map((clone) => clone.uuid)]);
    showToast('已建立陣列複製');
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
    } else if (path === 'applyBevel') {
      pushHistory('bevel');
      object.userData.bevelRadius = Math.max(0, Number(value.radius) || 0);
      object.userData.bevelSegments = Math.max(1, Number(value.segments) || 1);
      rebuildCubeGeometry(object);
      showToast('已套用圓角');
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

  function updateEditedMesh(mesh) {
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.attributes.position.needsUpdate = true;
    if (mesh.geometry.attributes.normal) mesh.geometry.attributes.normal.needsUpdate = true;
    if (primarySelected) setSelected(readTransform(primarySelected));
    refreshObjects();
  }

  function getSelectedPrintableTarget() {
    const object = objectsRef.current.find((item) => item.uuid === selectedIdsRef.current[0]);
    if (!object) {
      showToast('沒有選取物件');
      return null;
    }
    const meshes = getPrintableMeshes(object);
    if (!meshes.length) {
      showToast('選取物件沒有可處理的 mesh');
      return null;
    }
    return { object, meshes };
  }

  function finishPrintPrepChange(object, message) {
    object.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      child.geometry.computeVertexNormals();
      child.geometry.computeBoundingBox();
      child.geometry.computeBoundingSphere();
      child.geometry.attributes.position.needsUpdate = true;
      if (child.geometry.attributes.normal) child.geometry.attributes.normal.needsUpdate = true;
    });
    setSelected(readTransform(object));
    updateSelectionHelpers([object]);
    refreshObjects();
    setMeshCheckResults(null);
    showToast(message);
  }

  function subdivideSelectedModel() {
    const target = getSelectedPrintableTarget();
    if (!target) return;
    const iterations = Math.max(1, Math.min(2, Math.floor(Number(printPrepSettings.subdivideIterations) || 1)));
    const currentTriangles = target.meshes.reduce((sum, mesh) => sum + Math.floor((mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3), 0);
    if (currentTriangles * 4 ** iterations > 120000) showToast('面數過高可能影響效能');
    pushHistory('subdivide');
    target.meshes.forEach((mesh) => {
      const nextGeometry = subdivideTriangleGeometry(mesh.geometry, iterations);
      mesh.geometry.dispose();
      mesh.geometry = nextGeometry;
    });
    finishPrintPrepChange(target.object, '已套用細分');
  }

  function smoothSelectedModel() {
    const target = getSelectedPrintableTarget();
    if (!target) return;
    pushHistory('smooth model');
    target.meshes.forEach((mesh) => {
      const nextGeometry = smoothGeometryLaplacian(mesh.geometry, printPrepSettings.smoothStrength, printPrepSettings.smoothIterations);
      mesh.geometry.dispose();
      mesh.geometry = nextGeometry;
    });
    finishPrintPrepChange(target.object, '已平滑模型');
  }

  function recalculateSelectedNormals() {
    const target = getSelectedPrintableTarget();
    if (!target) return;
    pushHistory('recalculate normals');
    target.meshes.forEach((mesh) => {
      makeEditableGeometry(mesh);
      mesh.geometry.computeVertexNormals();
      mesh.geometry.attributes.position.needsUpdate = true;
      if (mesh.geometry.attributes.normal) mesh.geometry.attributes.normal.needsUpdate = true;
    });
    finishPrintPrepChange(target.object, '已重新計算法線');
  }

  function placeSelectedOnBed() {
    const target = getSelectedPrintableTarget();
    if (!target) return;
    pushHistory('place on bed');
    const { box } = getObjectBounds(target.object);
    target.object.position.z -= box.min.z;
    finishPrintPrepChange(target.object, '已置於平台');
  }

  function centerSelectedOnBed() {
    const target = getSelectedPrintableTarget();
    if (!target) return;
    pushHistory('center on bed');
    const { box, center } = getObjectBounds(target.object);
    target.object.position.x -= center.x;
    target.object.position.y -= center.y;
    target.object.position.z -= box.min.z;
    finishPrintPrepChange(target.object, '已居中到平台');
  }

  function applySelectedTransform() {
    const target = getSelectedPrintableTarget();
    if (!target) return;
    pushHistory('apply transform');
    detachSelectionGroup();
    target.object.updateWorldMatrix(true, true);
    target.object.traverse((child) => {
      if (!child.isMesh || !child.geometry || child.userData.helper) return;
      child.updateWorldMatrix(true, false);
      child.geometry.applyMatrix4(child.matrixWorld);
      child.position.set(0, 0, 0);
      child.rotation.set(0, 0, 0);
      child.scale.set(1, 1, 1);
      child.updateMatrixWorld(true);
    });
    target.object.position.set(0, 0, 0);
    target.object.rotation.set(0, 0, 0);
    target.object.scale.set(1, 1, 1);
    finishPrintPrepChange(target.object, '已套用變形');
    attachTransformForSelection([target.object.uuid]);
  }

  function buildMeshCheckResults(targetObjects) {
    const aggregate = targetObjects.reduce((sceneResult, object) => {
      const meshes = getPrintableMeshes(object);
      return meshes.reduce((result, mesh) => {
        const report = inspectMeshGeometry(mesh, object, printerSize);
        return {
          triangleCount: result.triangleCount + report.triangleCount,
          vertexCount: result.vertexCount + report.vertexCount,
          belowPlatform: result.belowPlatform || report.belowPlatform,
          outside: result.outside || report.outside,
          tooThin: result.tooThin || report.tooThin,
          invalidVertexCount: result.invalidVertexCount + report.invalidVertexCount,
          openEdgeCount: result.openEdgeCount + report.openEdgeCount,
          degenerateTriangleCount: result.degenerateTriangleCount + report.degenerateTriangleCount,
        };
      }, sceneResult);
    }, {
      triangleCount: 0,
      vertexCount: 0,
      belowPlatform: false,
      outside: false,
      tooThin: false,
      invalidVertexCount: 0,
      openEdgeCount: 0,
      degenerateTriangleCount: 0,
    });

    return [
      { label: `Triangle 數量：${aggregate.triangleCount}`, status: aggregate.triangleCount > 120000 ? 'warning' : 'ok' },
      { label: `Vertex 數量：${aggregate.vertexCount}`, status: aggregate.vertexCount > 360000 ? 'warning' : 'ok' },
      { label: aggregate.belowPlatform ? '模型低於平台' : '未低於平台', status: aggregate.belowPlatform ? 'error' : 'ok' },
      { label: aggregate.outside ? '模型超出列印平台' : '未超出列印平台', status: aggregate.outside ? 'warning' : 'ok' },
      { label: aggregate.tooThin ? '尺寸小於 1mm' : '尺寸厚度正常', status: aggregate.tooThin ? 'warning' : 'ok' },
      { label: aggregate.invalidVertexCount ? `有 ${aggregate.invalidVertexCount} 個 NaN / Infinity 頂點` : '沒有 NaN / Infinity 頂點', status: aggregate.invalidVertexCount ? 'error' : 'ok' },
      { label: aggregate.openEdgeCount ? `可能有開口：${aggregate.openEdgeCount} 條邊只被使用一次` : '未偵測到開口邊', status: aggregate.openEdgeCount ? 'warning' : 'ok' },
      { label: aggregate.degenerateTriangleCount ? `有 ${aggregate.degenerateTriangleCount} 個退化 triangle` : '沒有退化 triangle', status: aggregate.degenerateTriangleCount ? 'warning' : 'ok' },
    ];
  }

  function checkSelectedMesh() {
    const target = getSelectedPrintableTarget();
    if (!target) return;
    setMeshCheckResults(buildMeshCheckResults([target.object]));
    showToast('已檢查模型');
  }

  function moveSelectedFace(direction = 1) {
    const face = currentFaceRef.current;
    if (!face?.mesh) {
      showToast('請點選模型表面');
      return;
    }
    const mesh = face.mesh;
    const geometry = makeEditableGeometry(mesh);
    const triangle = readTriangle(geometry, face.faceIndex);
    if (!triangle) {
      showToast('請重新選取模型表面');
      clearFaceHelper();
      return;
    }
    const distance = Math.abs(Number(faceSettings.distance) || 0) * direction;
    if (Math.abs(distance) < 0.001) return;
    pushHistory('face move');

    const position = geometry.attributes.position;
    const normal = triangle.normal.clone().normalize();
    const center = triangle.center.clone();
    const radius = Math.max(0.5, Number(faceSettings.radius) || 0.5);
    const selectedIndices = new Set(triangle.indices);
    const delta = normal.clone().multiplyScalar(distance);

    for (let i = 0; i < position.count; i += 1) {
      const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
      let weight = selectedIndices.has(i) ? 1 : 0;
      if (faceSettings.softEdit) {
        const distanceToCenter = vertex.distanceTo(center);
        if (distanceToCenter <= radius) {
          weight = Math.max(weight, 1 - distanceToCenter / radius);
        }
      }
      if (weight <= 0) continue;
      vertex.addScaledVector(delta, weight);
      setPositionAt(position, i, vertex);
    }

    updateEditedMesh(mesh);
    showFaceHelper(mesh, face.faceIndex);
    showToast(direction > 0 ? '已向外拉伸面' : '已向內推入面');
  }

  function smoothSelectedFace() {
    const face = currentFaceRef.current;
    if (!face?.mesh) {
      showToast('請點選模型表面');
      return;
    }
    const mesh = face.mesh;
    const geometry = makeEditableGeometry(mesh);
    const triangle = readTriangle(geometry, face.faceIndex);
    if (!triangle) {
      showToast('請重新選取模型表面');
      clearFaceHelper();
      return;
    }
    pushHistory('face smooth');
    const position = geometry.attributes.position;
    const radius = Math.max(0.5, Number(faceSettings.radius) || 0.5);
    const strength = THREE.MathUtils.clamp(Number(faceSettings.smoothStrength) || 0, 0, 1);
    const center = triangle.center.clone();
    const vertices = [];
    for (let i = 0; i < position.count; i += 1) vertices.push(new THREE.Vector3().fromBufferAttribute(position, i));

    vertices.forEach((vertex, index) => {
      const distanceToCenter = vertex.distanceTo(center);
      if (distanceToCenter > radius && !triangle.indices.includes(index)) return;
      const nearby = vertices.filter((candidate) => candidate.distanceTo(vertex) <= radius * 0.45);
      if (nearby.length < 2) return;
      const average = nearby.reduce((sum, candidate) => sum.add(candidate), new THREE.Vector3()).multiplyScalar(1 / nearby.length);
      const weight = triangle.indices.includes(index) ? 1 : Math.max(0, 1 - distanceToCenter / radius);
      const next = vertex.clone().lerp(average, strength * weight);
      setPositionAt(position, index, next);
    });

    updateEditedMesh(mesh);
    showFaceHelper(mesh, face.faceIndex);
    showToast('已平滑選取區域');
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
    if (!objectsRef.current.length) {
      showToast('沒有可匯出的物件');
      return;
    }
    if (format === 'stl') {
      const printableObjects = objectsRef.current.filter((object) => object.userData.mode !== 'hole');
      const results = buildMeshCheckResults(printableObjects);
      setMeshCheckResults(results);
      const hasIssue = results.some((item) => item.status !== 'ok');
      if (hasIssue && !window.confirm('模型可能有問題，仍要匯出嗎？')) {
        switchWorkflow('export');
        showToast('已取消匯出 STL');
        return;
      }
    }
    const group = new THREE.Group();
    objectsRef.current.filter((object) => object.userData.mode !== 'hole').forEach((object) => group.add(object.clone(true)));
    group.updateMatrixWorld(true);
    const exporter = format === 'obj' ? new OBJExporter() : new STLExporter();
    const data = format === 'obj' ? exporter.parse(group) : exporter.parse(group, { binary: false });
    const blob = new Blob([data], { type: format === 'obj' ? 'text/plain' : 'model/stl' });
    downloadBlob(blob, `print-model.${format}`);
    showToast(`已匯出 ${format.toUpperCase()}`);
  }

  function saveProject() {
    detachSelectionGroup();
    const payload = makeProjectPayload();
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'print-model-project.json');
  }

  function loadProjectFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        loadProjectData(data);
        showToast('已載入專案');
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
        <div className="project-strip">
          <input className="project-name-input" value={projectName} onChange={(event) => setProjectName(event.target.value || 'Untitled Model')} />
          <span>{lastAutosave ? `Autosaved ${lastAutosave}` : 'Autosave ready'}</span>
        </div>
        <div className="workflow-bar">
          {[
            ['model', '1. 建立模型'],
            ['face', '2. 編輯形狀'],
            ['sculpt', '3. 雕刻'],
            ['prep', '4. 列印準備'],
            ['export', '5. 匯出'],
          ].map(([key, label]) => (
            <button key={key} className={activeWorkflow === key ? 'active' : ''} onClick={() => switchWorkflow(key)}>{label}</button>
          ))}
        </div>
        <div className="toolbar-group">
          <button onClick={undo} disabled={!historyRef.current.length}>復原 Undo</button>
          <button onClick={redo} disabled={!redoRef.current.length}>重做 Redo</button>
          <button className="danger" onClick={deleteSelected} disabled={!selectedIds.length}><Trash2 size={18} />刪除</button>
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

      {showGuide && (
        <GuidePanel
          onClose={() => setShowGuide(false)}
          onNeverShow={() => {
            localStorage.setItem('printModeler.hideGuide', 'true');
            setShowGuide(false);
          }}
        />
      )}

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
      </LeftPanel>

      <section className="viewport-wrap">
        <div className="viewport-topbar">
          <span>{objects.length} objects</span>
          <span>{selectedIds.length} selected</span>
          <span>{editMode === 'face' ? 'Face Mode' : editMode === 'sculpt' ? 'Sculpt Mode' : 'Object Mode'}</span>
          <span>{printerSize.x} x {printerSize.y} x {printerSize.z} mm</span>
          <span>{selected ? selected.name : '未選取物件'}</span>
        </div>
        <div ref={mountRef} className="three-viewport" />
        {!objects.length && <div className="empty-scene-hint">從左側新增一個基本物件開始建模</div>}
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

        {activeWorkflow === 'prep' ? (
          <PrintPrepPanel
            settings={printPrepSettings}
            onSettingChange={(key, value) => setPrintPrepSettings((settings) => ({ ...settings, [key]: value }))}
            onSubdivide={subdivideSelectedModel}
            onSmooth={smoothSelectedModel}
            onRecalculate={recalculateSelectedNormals}
            onPlace={placeSelectedOnBed}
            onCenter={centerSelectedOnBed}
            onApplyTransform={applySelectedTransform}
            onCheck={checkSelectedMesh}
            results={meshCheckResults}
            disabled={!primarySelected}
          />
        ) : activeWorkflow === 'export' ? (
          <ExportPanel
            onExportStl={() => exportModel('stl')}
            onExportObj={() => exportModel('obj')}
            onSave={saveProject}
            onLoad={() => fileInputRef.current?.click()}
            hasObjects={objects.length > 0}
            checkResults={meshCheckResults}
          />
        ) : activeWorkflow === 'face' ? (
          <FaceEditPanel
            faceSelection={faceSelection}
            settings={faceSettings}
            onSettingChange={(key, value) => setFaceSettings((settings) => ({ ...settings, [key]: value }))}
            onPull={() => moveSelectedFace(1)}
            onPush={() => moveSelectedFace(-1)}
            onSmooth={smoothSelectedFace}
          />
        ) : activeWorkflow === 'sculpt' ? (
          <SculptPanel
            settings={sculptSettings}
            onSettingChange={(key, value) => setSculptSettings((settings) => ({ ...settings, [key]: value }))}
            hasSelection={!!primarySelected}
          />
        ) : selected ? (
          <div className="property-stack">
            <label className="field"><span>名稱</span><input value={primarySelected?.name || selected.name} onChange={(event) => updateSelected('name', null, event.target.value)} /></label>
            <div className="row-fields">
              <label className="field"><span>物件模式</span><select value={primarySelected?.userData.mode || 'solid'} onChange={(event) => updateSelected('mode', null, event.target.value)}><option value="solid">Solid</option><option value="hole">Hole</option></select></label>
              <label className="field"><span>顏色</span><input type="color" value={primarySelected?.userData.color || '#38bdf8'} onChange={(event) => updateSelected('color', null, event.target.value)} /></label>
            </div>
            <ObjectToolsPanel
              mode={mode}
              setMode={setMode}
              multiSelect={multiSelect}
              setMultiSelect={setMultiSelect}
              selectedCount={selectedIds.length}
              primarySelected={primarySelected}
              duplicateSelected={duplicateSelected}
              deleteSelected={deleteSelected}
              centerSelectedOnPlate={centerSelectedOnPlate}
              dropSelectedToPlate={dropSelectedToPlate}
              setSelectedMode={setSelectedMode}
              mergeSelected={mergeSelected}
              applyHole={applyHole}
              mirrorSelected={mirrorSelected}
              alignSelected={alignSelected}
              arraySettings={arraySettings}
              setArraySettings={setArraySettings}
              arrayDuplicate={arrayDuplicate}
              groupSelected={groupSelected}
              ungroupSelected={ungroupSelected}
            />
            <div className="notice">Hole 物件不會被列印，只用來切掉 Solid。</div>
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

function GuidePanel({ onClose, onNeverShow }) {
  return (
    <section className="guide-panel">
      <div>
        <strong>操作指南</strong>
        <ol>
          <li>從左側新增 Cube / Sphere / Cylinder。</li>
          <li>使用移動、旋轉、縮放調整位置。</li>
          <li>切到 Face Mode 可推拉表面。</li>
          <li>切到 Sculpt Mode 可用筆刷雕刻。</li>
          <li>用 Print Prep 檢查模型。</li>
          <li>匯出 STL 進行 3D 列印。</li>
        </ol>
        <p>快捷鍵：W 移動、E 旋轉、R 縮放、Delete 刪除、Ctrl+Z 復原、Ctrl+Y 重做、1-5 切換流程。</p>
      </div>
      <div className="guide-actions">
        <button onClick={onClose}>關閉</button>
        <button onClick={onNeverShow}>不再顯示</button>
      </div>
    </section>
  );
}

function ObjectToolsPanel({
  mode,
  setMode,
  multiSelect,
  setMultiSelect,
  selectedCount,
  primarySelected,
  duplicateSelected,
  deleteSelected,
  centerSelectedOnPlate,
  dropSelectedToPlate,
  setSelectedMode,
  mergeSelected,
  applyHole,
  mirrorSelected,
  alignSelected,
  arraySettings,
  setArraySettings,
  arrayDuplicate,
  groupSelected,
  ungroupSelected,
}) {
  return (
    <section className="printer-card object-tools-card">
      <div className="card-title">Object Mode 工具</div>
      <div className="segmented">
        {MODE_BUTTONS.map((item) => {
          const Icon = item.icon;
          return <button key={item.mode} className={mode === item.mode ? 'active' : ''} onClick={() => setMode(item.mode)} title={item.label}><Icon size={18} /></button>;
        })}
      </div>
      <div className="prep-grid">
        <button onClick={() => setMultiSelect((value) => !value)} className={multiSelect ? 'active' : ''}>多選</button>
        <button onClick={duplicateSelected} disabled={!selectedCount}><Copy size={14} /> 複製</button>
        <button onClick={deleteSelected} disabled={!selectedCount}>刪除</button>
        <button onClick={centerSelectedOnPlate} disabled={!selectedCount}>置中</button>
        <button onClick={dropSelectedToPlate} disabled={!selectedCount}>貼齊平台</button>
        <button onClick={groupSelected} disabled={selectedCount < 2}>群組</button>
        <button onClick={ungroupSelected} disabled={!primarySelected?.isGroup}>取消群組</button>
        <button onClick={mergeSelected} disabled={selectedCount < 2}>合併</button>
        <button onClick={() => setSelectedMode('solid')} disabled={!selectedCount}>設為實體</button>
        <button onClick={() => setSelectedMode('hole')} disabled={!selectedCount}>設為洞</button>
        <button onClick={applyHole} disabled={selectedCount < 2}>套用打洞</button>
      </div>
      <div className="mini-grid">
        <button onClick={() => mirrorSelected('x')} disabled={!selectedCount}>Mirror X</button>
        <button onClick={() => mirrorSelected('y')} disabled={!selectedCount}>Mirror Y</button>
        <button onClick={() => mirrorSelected('z')} disabled={!selectedCount}>Mirror Z</button>
        <button onClick={() => alignSelected('x', 'min')} disabled={selectedCount < 2}>X 左</button>
        <button onClick={() => alignSelected('x', 'center')} disabled={selectedCount < 2}>X 中</button>
        <button onClick={() => alignSelected('x', 'max')} disabled={selectedCount < 2}>X 右</button>
        <button onClick={() => alignSelected('y', 'min')} disabled={selectedCount < 2}>Y 前</button>
        <button onClick={() => alignSelected('y', 'center')} disabled={selectedCount < 2}>Y 中</button>
        <button onClick={() => alignSelected('y', 'max')} disabled={selectedCount < 2}>Y 後</button>
        <button onClick={() => alignSelected('z', 'min')} disabled={selectedCount < 2}>Z 底</button>
        <button onClick={() => alignSelected('z', 'center')} disabled={selectedCount < 2}>Z 中</button>
        <button onClick={() => alignSelected('z', 'max')} disabled={selectedCount < 2}>Z 頂</button>
      </div>
      <div className="row-fields">
        <MiniNumber label="陣列數量" value={arraySettings.count} onChange={(value) => setArraySettings((settings) => ({ ...settings, count: value }))} />
        <MiniNumber label="X 間距" value={arraySettings.x} onChange={(value) => setArraySettings((settings) => ({ ...settings, x: value }))} />
      </div>
      <div className="row-fields">
        <MiniNumber label="Y 間距" value={arraySettings.y} onChange={(value) => setArraySettings((settings) => ({ ...settings, y: value }))} />
        <MiniNumber label="Z 間距" value={arraySettings.z} onChange={(value) => setArraySettings((settings) => ({ ...settings, z: value }))} />
      </div>
      <button className="wide-action" onClick={arrayDuplicate} disabled={!selectedCount}>建立陣列複製</button>
    </section>
  );
}

function ExportPanel({ onExportStl, onExportObj, onSave, onLoad, hasObjects, checkResults }) {
  const hasIssue = checkResults?.some((item) => item.status !== 'ok');
  return (
    <div className="property-stack">
      <section className="printer-card export-card">
        <div className="card-title">匯出</div>
        <div className="notice">匯出 STL 前會自動檢查模型；如果有警告或錯誤，會先詢問是否仍要匯出。</div>
        {hasIssue && <div className="notice warning-note">目前檢查結果有警告或錯誤，建議先到 Print Prep 修復。</div>}
        <div className="prep-grid">
          <button onClick={onExportStl} disabled={!hasObjects}><Download size={14} /> 匯出 STL</button>
          <button onClick={onExportObj} disabled={!hasObjects}><Download size={14} /> 匯出 OBJ</button>
          <button onClick={onSave}>儲存 JSON</button>
          <button onClick={onLoad}>載入 JSON</button>
        </div>
      </section>
    </div>
  );
}

function PrintPrepPanel({ settings, onSettingChange, onSubdivide, onSmooth, onRecalculate, onPlace, onCenter, onApplyTransform, onCheck, results, disabled }) {
  return (
    <section className="printer-card print-prep-card">
      <div className="card-title">列印準備 Print Prep</div>
      {disabled && <div className="notice warning-note">請先選取要處理的物件。</div>}
      <div className="row-fields">
        <label className="field">
          <span>細分次數</span>
          <select value={settings.subdivideIterations} onChange={(event) => onSettingChange('subdivideIterations', Number(event.target.value))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <label className="field"><span>平滑強度</span><input type="number" min="0.1" max="1" step="0.1" value={settings.smoothStrength} onChange={(event) => onSettingChange('smoothStrength', event.target.value)} /></label>
      </div>
      <label className="field"><span>平滑次數</span><input type="number" min="1" max="10" step="1" value={settings.smoothIterations} onChange={(event) => onSettingChange('smoothIterations', event.target.value)} /></label>
      <div className="prep-grid">
        <button onClick={onSubdivide} disabled={disabled}>套用細分</button>
        <button onClick={onSmooth} disabled={disabled}>平滑模型</button>
        <button onClick={onRecalculate} disabled={disabled}>重新計算法線</button>
        <button onClick={onPlace} disabled={disabled}>置於平台</button>
        <button onClick={onCenter} disabled={disabled}>居中到平台</button>
        <button onClick={onApplyTransform} disabled={disabled}>套用變形</button>
      </div>
      <button className="wide-action" onClick={onCheck} disabled={disabled}>檢查模型</button>
      {results && (
        <div className="mesh-check-list">
          {results.map((item) => (
            <div key={item.label} className={`mesh-check-item ${item.status}`}>
              <span>{item.status === 'ok' ? '✅' : item.status === 'warning' ? '⚠️' : '❌'}</span>
              <strong>{item.status === 'ok' ? '正常' : item.status === 'warning' ? '警告' : '錯誤'}</strong>
              <p>{item.label}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FaceEditPanel({ faceSelection, settings, onSettingChange, onPull, onPush, onSmooth }) {
  return (
    <div className="property-stack">
      <section className="printer-card face-edit-card">
        <div className="card-title">面編輯</div>
        {faceSelection ? (
          <>
            <div className="status-row ok"><span>目前選取</span><strong>Face #{faceSelection.faceIndex}</strong></div>
            <div className="dimension-readout">
              <span>法線 X：{faceSelection.normal.x}</span>
              <span>法線 Y：{faceSelection.normal.y}</span>
              <span>法線 Z：{faceSelection.normal.z}</span>
            </div>
          </>
        ) : (
          <div className="empty-state compact"><Move3D size={28} /><p>請點選模型表面</p></div>
        )}
        <label className="field"><span>拉伸距離 mm</span><input type="number" step="1" min="0.1" value={settings.distance} onChange={(event) => onSettingChange('distance', event.target.value)} /></label>
        <label className="field"><span>影響範圍 mm</span><input type="number" step="1" min="0.5" value={settings.radius} onChange={(event) => onSettingChange('radius', event.target.value)} /></label>
        <label className="mini-check toggle-line">
          <input type="checkbox" checked={settings.softEdit} onChange={(event) => onSettingChange('softEdit', event.target.checked)} />
          <span>軟編輯：{settings.softEdit ? '開' : '關'}</span>
        </label>
        <label className="field"><span>平滑強度</span><input type="number" step="0.1" min="0" max="1" value={settings.smoothStrength} onChange={(event) => onSettingChange('smoothStrength', event.target.value)} /></label>
        <div className="action-grid">
          <button onClick={onPull} disabled={!faceSelection}>向外拉伸</button>
          <button onClick={onPush} disabled={!faceSelection}>向內推入</button>
        </div>
        <button className="wide-action" onClick={onSmooth} disabled={!faceSelection}>平滑選取區域</button>
      </section>
    </div>
  );
}

function SculptPanel({ settings, onSettingChange, hasSelection }) {
  return (
    <div className="property-stack">
      <section className="printer-card sculpt-card">
        <div className="card-title">雕刻模式</div>
        {!hasSelection && <div className="notice warning-note">請先選取要雕刻的物件。</div>}
        <label className="field">
          <span>筆刷</span>
          <select value={settings.brushMode} onChange={(event) => onSettingChange('brushMode', event.target.value)}>
            <option value="raise">Raise 推起</option>
            <option value="lower">Lower 壓下</option>
            <option value="smooth">Smooth 平滑</option>
            <option value="inflate">Inflate 膨脹</option>
            <option value="flatten">Flatten 壓平</option>
          </select>
        </label>
        <div className="row-fields">
          <label className="field"><span>半徑 mm</span><input type="number" step="1" min="1" value={settings.radius} onChange={(event) => onSettingChange('radius', event.target.value)} /></label>
          <label className="field"><span>強度</span><input type="number" step="0.05" min="0" max="1" value={settings.strength} onChange={(event) => onSettingChange('strength', event.target.value)} /></label>
        </div>
        <label className="field">
          <span>衰減 Falloff</span>
          <select value={settings.falloff} onChange={(event) => onSettingChange('falloff', event.target.value)}>
            <option value="smooth">Smooth</option>
            <option value="linear">Linear</option>
          </select>
        </label>
        <div className="notice">按住滑鼠左鍵在模型表面拖曳，即可雕刻。</div>
      </section>
    </div>
  );
}

function BevelFields({ selected, onChange }) {
  const [radius, setRadius] = useState(selected.bevelRadius);
  const [segments, setSegments] = useState(selected.bevelSegments);

  useEffect(() => {
    setRadius(selected.bevelRadius);
    setSegments(selected.bevelSegments);
  }, [selected.id, selected.bevelRadius, selected.bevelSegments]);

  return (
    <section className="printer-card">
      <div className="card-title">倒角 / 圓角</div>
      <div className="row-fields">
        <label className="field"><span>圓角半徑 mm</span><input type="number" step="0.5" min="0" value={radius} onChange={(event) => setRadius(event.target.value)} /></label>
        <label className="field"><span>圓角段數</span><input type="number" step="1" min="1" value={segments} onChange={(event) => setSegments(event.target.value)} /></label>
      </div>
      <button className="wide-action" onClick={() => onChange('applyBevel', null, { radius, segments })}>套用圓角</button>
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

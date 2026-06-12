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
  Wrench,
} from 'lucide-react';
import './styles.css';
import LeftPanel from './components/LeftPanel.jsx';
import RightPanel from './components/RightPanel.jsx';
import TopToolbar from './components/TopToolbar.jsx';
import PreferencesPanel from './components/PreferencesPanel.jsx';
import Outliner from './components/Outliner.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import StatusBar from './components/StatusBar.jsx';
import GuidePanel from './components/GuidePanel.jsx';
import ViewCube from './components/ViewCube.jsx';
import BoxSelectOverlay from './components/BoxSelectOverlay.jsx';
import BeginnerModeToggle from './components/BeginnerModeToggle.jsx';
import QuickStartCards from './components/QuickStartCards.jsx';
import RightPanelTabs from './components/RightPanelTabs.jsx';
import CommonToolsPanel from './components/CommonToolsPanel.jsx';
import SelectionSizeInfo from './components/SelectionSizeInfo.jsx';
import ModelingModeToolbar from './components/ModelingModeToolbar.jsx';
import ModelingToolPanel from './components/ModelingToolPanel.jsx';
import ViewAssistPanel from './components/ViewAssistPanel.jsx';
import ModeHintOverlay from './components/ModeHintOverlay.jsx';
import ToolboxPanel from './components/ToolboxPanel.jsx';
import ScaleFeedbackOverlay from './components/ScaleFeedbackOverlay.jsx';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts.js';
import { APP_INFO, APP_VERSION } from './data/changelog.js';
import { applyCameraView, applyOrbitControlStyle, focusCameraOnBox as focusCameraOnBoxUtil, toggleCameraProjectionFov } from './utils/cameraUtils.js';
import {
  analyzeMeshRepairGeometry,
  fillHolesGeometry,
  mergeCloseVerticesGeometry,
  removeDegenerateFacesGeometry,
  removeLooseFacesGeometry,
} from './utils/meshRepairUtils.js';
import {
  getSelectedBooleanParts,
  runBooleanDifference,
  validateBooleanInput,
} from './utils/booleanUtils.js';
import {
  extrudeTriangleFaceGeometry,
  insetTriangleFaceGeometry,
} from './utils/extrudeUtils.js';
import {
  getClosestEdgeFromIntersection,
  getClosestVertexFromIntersection,
} from './utils/selectionHelpers.js';
import {
  createEdgeHighlight,
  createVertexCloud,
  createVertexHighlight,
  createWireframeOverlay,
} from './utils/modelingVisuals.js';

const font = new FontLoader().parse(helvetikerFont);
const MAX_HISTORY = 50;
const LARGE_UNDO_VERTEX_THRESHOLD = 250000;

const PRINTERS = {
  a1mini: { label: 'Bambu A1 mini', size: { x: 180, y: 180, z: 180 } },
  h2d: { label: 'Bambu H2D', size: { x: 256, y: 256, z: 256 } },
  custom: { label: '自訂尺寸', size: { x: 256, y: 256, z: 256 } },
};

const SHAPES = {
  cube: { label: '方塊', icon: Box, size: { x: 20, y: 20, z: 20 } },
  sphere: { label: '球體', icon: Circle, size: { x: 20, y: 20, z: 20 } },
  cylinder: { label: '圓柱', icon: Cylinder, size: { x: 20, y: 20, z: 30 } },
  torus: { label: '圓環', icon: Circle, size: { x: 30, y: 30, z: 5 } },
  cone: { label: '圓錐', icon: Cylinder, size: { x: 25, y: 25, z: 35 } },
};

const RESOLUTION_PRESETS = {
  low: {
    label: '低',
    sphere: [32, 16],
    cylinder: 32,
    cone: 32,
    torus: [48, 12],
  },
  medium: {
    label: '中',
    sphere: [64, 32],
    cylinder: 64,
    cone: 64,
    torus: [72, 18],
  },
  high: {
    label: '高',
    sphere: [96, 48],
    cylinder: 96,
    cone: 96,
    torus: [96, 24],
  },
};

const MODE_BUTTONS = [
  { mode: 'translate', label: '移動', icon: Move3D },
  { mode: 'rotate', label: '旋轉', icon: RotateCw },
  { mode: 'scale', label: '縮放', icon: Scale },
];

const WORKFLOW_TABS = [
  { key: 'model', label: '建立', icon: Box },
  { key: 'face', label: '編輯', icon: Move3D },
  { key: 'sculpt', label: '雕刻', icon: RotateCw },
  { key: 'prep', label: '修復', icon: Wrench },
  { key: 'export', label: '匯出', icon: Download },
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
  const geometry = new TextGeometry(text || '文字', {
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
  if (!object?.visible) return meshes;
  object.traverse((child) => {
    if (child.isMesh && !child.userData.helper) meshes.push(child);
  });
  return meshes;
}

function countObjectVertices(object) {
  return getPrintableMeshes(object).reduce((total, mesh) => total + (mesh.geometry?.attributes?.position?.count || 0), 0);
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

function remeshGeometrySimple(sourceGeometry, targetEdgeLength = 8, smoothPasses = 2) {
  let geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
  const target = Math.max(0.5, Number(targetEdgeLength) || 8);
  for (let pass = 0; pass < 2; pass += 1) {
    const position = geometry.attributes.position;
    const nextPositions = [];
    let changed = false;
    for (let i = 0; i < position.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(position, i);
      const b = new THREE.Vector3().fromBufferAttribute(position, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(position, i + 2);
      const maxEdge = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
      if (maxEdge > target * 1.35) {
        changed = true;
        const ab = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
        const bc = new THREE.Vector3().addVectors(b, c).multiplyScalar(0.5);
        const ca = new THREE.Vector3().addVectors(c, a).multiplyScalar(0.5);
        [a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca].forEach((point) => nextPositions.push(point.x, point.y, point.z));
      } else {
        [a, b, c].forEach((point) => nextPositions.push(point.x, point.y, point.z));
      }
    }
    if (!changed) break;
    geometry.dispose();
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(nextPositions, 3));
    geometry.computeVertexNormals();
  }
  const smoothed = smoothGeometryLaplacian(geometry, 0.25, smoothPasses);
  geometry.dispose();
  return smoothed;
}

function planeCutGeometry(sourceGeometry, axis = 'z', positionValue = 0, keepDirection = 'positive') {
  const geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
  const position = geometry.attributes.position;
  const nextPositions = [];
  const keepPositive = keepDirection === 'positive';
  for (let i = 0; i < position.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, i);
    const b = new THREE.Vector3().fromBufferAttribute(position, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, i + 2);
    const center = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
    const keep = keepPositive ? center[axis] >= positionValue : center[axis] <= positionValue;
    if (keep) [a, b, c].forEach((point) => nextPositions.push(point.x, point.y, point.z));
  }
  geometry.dispose();
  const nextGeometry = new THREE.BufferGeometry();
  nextGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nextPositions, 3));
  nextGeometry.computeVertexNormals();
  nextGeometry.computeBoundingBox();
  nextGeometry.computeBoundingSphere();
  return nextGeometry;
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

function createShape(type, index = 0, resolution = 'low') {
  const def = SHAPES[type];
  const preset = RESOLUTION_PRESETS[resolution] || RESOLUTION_PRESETS.low;
  const color = `#${palette[index % palette.length].toString(16).padStart(6, '0')}`;
  let object;

  if (type === 'sphere') {
    object = new THREE.Mesh(new THREE.SphereGeometry(def.size.x / 2, preset.sphere[0], preset.sphere[1]), makeMaterial(new THREE.Color(color)));
  } else if (type === 'cylinder') {
    object = makeCylinder(def.label, def.size.x / 2, def.size.z, new THREE.Color(color), { x: 0, y: 0, z: 0 }, preset.cylinder);
  } else if (type === 'torus') {
    const geometry = new THREE.TorusGeometry(12.5, 2.5, preset.torus[1], preset.torus[0]);
    object = new THREE.Mesh(geometry, makeMaterial(new THREE.Color(color)));
  } else if (type === 'cone') {
    const geometry = new THREE.ConeGeometry(def.size.x / 2, def.size.z, preset.cone);
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

function createTextObject(index = 0, settings = { text: '文字', size: 18, depth: 4, align: 'center' }) {
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
  clone.name = `${source.name} 複製`;
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
    scale: {
      x: roundNumber(object.scale.x),
      y: roundNumber(object.scale.y),
      z: roundNumber(object.scale.z),
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
  let geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  if (geometry.index) geometry = geometry.toNonIndexed();
  geometry.computeVertexNormals();
  return geometry;
}

function meshToMergeGeometry(mesh) {
  let geometry = meshToWorldGeometry(mesh);
  Object.keys(geometry.attributes).forEach((name) => {
    if (!['position', 'normal'].includes(name)) geometry.deleteAttribute(name);
  });
  geometry.computeVertexNormals();
  return geometry;
}

function getShapeDisplayName(type) {
  const labels = {
    cube: '方塊',
    sphere: '球體',
    cylinder: '圓柱',
    torus: '圓環',
    cone: '圓錐',
    text: '文字',
  };
  return labels[type] || '物件';
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
    visible: object.visible !== false,
    locked: !!object.userData.locked,
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
  object.visible = data.visible !== false;
  object.userData.locked = !!data.locked;
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return markPrintObject(object, data.name || '物件', data.shapeType || 'custom', data);
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
  const measureHelperRef = useRef(null);
  const repairHelperRef = useRef(null);
  const edgeHelperRef = useRef(null);
  const vertexHelperRef = useRef(null);
  const viewAssistHelpersRef = useRef([]);
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
  const isTransformDraggingRef = useRef(false);
  const isGizmoPointerDownRef = useRef(false);
  const isMiddleMousePanningRef = useRef(false);
  const suppressNextClickSelectionRef = useRef(false);
  const transformHistorySnapshotRef = useRef(null);
  const measureActiveRef = useRef(false);
  const boxSelectActiveRef = useRef(false);
  const boxSelectStartRef = useRef(null);
  const boxSelectRectRef = useRef(null);
  const modeRef = useRef('translate');
  const snapRef = useRef(true);
  const multiSelectRef = useRef(false);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const toastTimerRef = useRef(null);
  const scaleFeedbackTimerRef = useRef(null);
  const objectCountRef = useRef(0);
  const activeWorkflowRef = useRef('model');
  const autosaveReadyRef = useRef(false);
  const prefsRef = useRef(null);
  const cameraProjectionRef = useRef('perspective');
  const [objects, setObjects] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeWorkflow, setActiveWorkflow] = useState('model');
  const [uiMode, setUiMode] = useState('beginner');
  const [rightPanelTab, setRightPanelTab] = useState('properties');
  const [leftToolTab, setLeftToolTab] = useState('create');
  const [modelingMode, setModelingMode] = useState('object');
  const [edgeSelection, setEdgeSelection] = useState(null);
  const [vertexSelection, setVertexSelection] = useState(null);
  const [viewAssist, setViewAssist] = useState({
    wireframe: false,
    vertices: false,
    faceNormals: false,
    boundingBox: true,
    dimensions: false,
  });
  const [projectName, setProjectName] = useState('未命名模型');
  const [lastAutosave, setLastAutosave] = useState('');
  const [showGuide, setShowGuide] = useState(() => localStorage.getItem('printModeler.hideGuide') !== 'true');
  const [editMode, setEditMode] = useState('object');
  const [faceSelection, setFaceSelection] = useState(null);
  const [faceSettings, setFaceSettings] = useState({ distance: 5, extrudeDistance: 5, radius: 20, softEdit: false, smoothStrength: 0.5 });
  const [shapeResolution, setShapeResolution] = useState('low');
  const [sculptSettings, setSculptSettings] = useState({ brushMode: 'raise', radius: 15, strength: 0.35, falloff: 'smooth', symmetryX: false, symmetryY: false, symmetryZ: false });
  const [printPrepSettings, setPrintPrepSettings] = useState({ subdivideIterations: 1, smoothStrength: 0.35, smoothIterations: 2, remeshEdgeLength: 8, remeshKeepVolume: true });
  const [meshRepairSettings, setMeshRepairSettings] = useState({ tolerance: 0.01 });
  const [meshRepairResult, setMeshRepairResult] = useState(null);
  const [planeCutSettings, setPlaneCutSettings] = useState({ axis: 'z', position: 0, keep: 'positive' });
  const [measureActive, setMeasureActive] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [boxSelectActive, setBoxSelectActive] = useState(false);
  const [boxSelectRect, setBoxSelectRect] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [clipboardObject, setClipboardObject] = useState(null);
  const [lockedAxis, setLockedAxis] = useState(null);
  const [operationStatus, setOperationStatus] = useState('就緒');
  const [transformSpace, setTransformSpace] = useState('world');
  const [showPreferences, setShowPreferences] = useState(false);
  const [cameraProjection, setCameraProjection] = useState(() => localStorage.getItem('printModeler.cameraProjection') || 'perspective');
  const [preferences, setPreferences] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('printModeler.preferences')) || {};
    } catch {
      return {};
    }
  });
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
  const [autosavePrompt, setAutosavePrompt] = useState(null);
  const [lastErrorMessage, setLastErrorMessage] = useState('');
  const [scaleFeedback, setScaleFeedback] = useState({
    visible: false,
    isDragging: false,
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 0, y: 0, z: 0 },
    objectName: '',
  });

  const printerSize = printerKey === 'custom' ? customSize : PRINTERS[printerKey].size;
  const selectedObjects = useMemo(() => objectsRef.current.filter((object) => selectedIds.includes(object.uuid)), [selectedIds, objects]);
  const primarySelected = selectedObjects[0] || null;
  const selectedCheck = primarySelected ? printCheck(primarySelected, printerSize) : null;
  const printStats = useMemo(() => getPrintStats(objectsRef.current, printerSize), [objects, printerSize.x, printerSize.y, printerSize.z]);
  const expertMode = uiMode === 'advanced';
  const visibleWorkflowTabs = useMemo(() => (
    expertMode ? WORKFLOW_TABS : WORKFLOW_TABS.filter((tab) => ['model', 'face', 'export'].includes(tab.key))
  ), [expertMode]);
  const selectionSizeInfo = useMemo(() => {
    if (!selectedObjects.length) {
      return {
        title: '目前平台',
        size: {
          x: roundNumber(printerSize.x, 1),
          y: roundNumber(printerSize.y, 1),
          z: roundNumber(printerSize.z, 1),
        },
        scale: null,
        caption: `場景中有 ${objects.length} 個物件`,
      };
    }
    const box = new THREE.Box3();
    selectedObjects.forEach((object) => box.union(getObjectBounds(object).box));
    const size = new THREE.Vector3();
    box.getSize(size);
    return {
      title: selectedObjects.length > 1 ? '多選範圍尺寸' : '選取物件尺寸',
      size: {
        x: roundNumber(size.x, 1),
        y: roundNumber(size.y, 1),
        z: roundNumber(size.z, 1),
      },
      scale: selectedObjects.length === 1 ? {
        x: roundNumber(primarySelected.scale.x, 2),
        y: roundNumber(primarySelected.scale.y, 2),
        z: roundNumber(primarySelected.scale.z, 2),
      } : null,
      caption: selectedObjects.length > 1 ? `已選取 ${selectedObjects.length} 個物件` : primarySelected?.name || '已選取物件',
    };
  }, [selectedObjects, objects.length, printerSize.x, printerSize.y, printerSize.z, primarySelected]);
  const basicPrintCheck = useMemo(() => ({
    hasSelection: selectedObjects.length > 0,
    objectCount: objects.length,
    printerSize,
    outside: selectedObjects.some((object) => printCheck(object, printerSize).outside),
    floating: selectedObjects.some((object) => printCheck(object, printerSize).floating),
  }), [selectedObjects, objects.length, printerSize]);
  const prefs = {
    operationStyle: 'blender',
    defaultCamera: 'perspective',
    mouseSensitivity: 1,
    gridSize: 10,
    snapDistance: 1,
    density: 'comfortable',
    ...preferences,
  };
  prefsRef.current = prefs;
  cameraProjectionRef.current = cameraProjection;

  function switchWorkflow(nextWorkflow) {
    if (uiMode === 'beginner' && ['sculpt', 'prep'].includes(nextWorkflow)) {
      showToast('雕刻與修復工具在進階模式中使用');
      return;
    }
    setActiveWorkflow(nextWorkflow);
    activeWorkflowRef.current = nextWorkflow;
    if (nextWorkflow === 'face') setModelingMode('face');
    else if (nextWorkflow === 'sculpt') setModelingMode('sculpt');
    else setModelingMode('object');
    if (nextWorkflow === 'face') setEditMode('face');
    else if (nextWorkflow === 'sculpt') setEditMode('sculpt');
    else setEditMode('object');
  }

  function updateScaleFeedback(target, isDragging = true) {
    if (!target || modeRef.current !== 'scale') return;
    const { size } = getObjectBounds(target);
    if (scaleFeedbackTimerRef.current) {
      window.clearTimeout(scaleFeedbackTimerRef.current);
      scaleFeedbackTimerRef.current = null;
    }
    setScaleFeedback({
      visible: true,
      isDragging,
      scale: {
        x: roundNumber(target.scale.x, 2),
        y: roundNumber(target.scale.y, 2),
        z: roundNumber(target.scale.z, 2),
      },
      size: {
        x: roundNumber(size.x, 1),
        y: roundNumber(size.y, 1),
        z: roundNumber(size.z, 1),
      },
      objectName: target.name || '選取物件',
    });
  }

  function hideScaleFeedbackSoon() {
    setScaleFeedback((feedback) => ({ ...feedback, isDragging: false }));
    if (scaleFeedbackTimerRef.current) window.clearTimeout(scaleFeedbackTimerRef.current);
    scaleFeedbackTimerRef.current = window.setTimeout(() => {
      setScaleFeedback((feedback) => ({ ...feedback, visible: false, isDragging: false }));
      scaleFeedbackTimerRef.current = null;
    }, 1000);
  }

  useEffect(() => {
    if (uiMode === 'beginner' && ['sculpt', 'prep'].includes(activeWorkflowRef.current)) {
      switchWorkflow('model');
    }
  }, [uiMode]);

  function switchModelingMode(nextMode) {
    setModelingMode(nextMode);
    clearFaceHelper();
    clearEdgeHelper();
    clearVertexHelper();
    setEdgeSelection(null);
    setVertexSelection(null);
    setRightPanelTab(nextMode === 'object' ? 'properties' : 'properties');
    if (nextMode === 'object') {
      setEditMode('object');
      switchWorkflow('model');
      attachTransformForSelection([...selectedIdsRef.current]);
    } else if (nextMode === 'face') {
      setEditMode('face');
      switchWorkflow('face');
    } else if (nextMode === 'sculpt') {
      setEditMode('sculpt');
      if (uiMode === 'advanced') switchWorkflow('sculpt');
      else setActiveWorkflow('model');
    } else {
      setEditMode(nextMode);
      setActiveWorkflow('model');
      activeWorkflowRef.current = 'model';
      if (nextMode === 'edge') setViewAssist((settings) => ({ ...settings, wireframe: true }));
      if (nextMode === 'vertex') setViewAssist((settings) => ({ ...settings, vertices: true }));
      transformRef.current?.detach();
    }
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
    orbit.enablePan = true;
    orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    orbit.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    orbit.target.set(0, 0, 25);
    orbitRef.current = orbit;

    const transform = new TransformControls(camera, renderer.domElement);
    transform.setMode(mode);
    transform.setSpace(transformSpace);
    transform.addEventListener('mouseDown', () => {
      isGizmoPointerDownRef.current = true;
      suppressNextClickSelectionRef.current = true;
      transformHistorySnapshotRef.current = makeSnapshot();
      orbit.enabled = false;
      renderer.domElement.style.cursor = 'grabbing';
      if (modeRef.current === 'scale') updateScaleFeedback(transform.object, true);
      setOperationStatus(modeRef.current === 'rotate' ? '正在旋轉' : modeRef.current === 'scale' ? '正在縮放' : '正在移動');
    });
    transform.addEventListener('mouseUp', () => {
      isGizmoPointerDownRef.current = false;
      suppressNextClickSelectionRef.current = true;
      if (!isTransformDraggingRef.current) transformHistorySnapshotRef.current = null;
      if (modeRef.current === 'scale') hideScaleFeedbackSoon();
    });
    transform.addEventListener('dragging-changed', (event) => {
      isTransformDraggingRef.current = event.value;
      orbit.enabled = !event.value;
      if (event.value) {
        transformHistorySnapshotRef.current ||= makeSnapshot();
        renderer.domElement.style.cursor = 'grabbing';
        if (modeRef.current === 'scale') updateScaleFeedback(transform.object, true);
        setOperationStatus(modeRef.current === 'rotate' ? '正在旋轉' : modeRef.current === 'scale' ? '正在縮放' : '正在移動');
      } else {
        if (transformHistorySnapshotRef.current) {
          historyRef.current.push(transformHistorySnapshotRef.current);
          if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
          redoRef.current = [];
          transformHistorySnapshotRef.current = null;
          setHistoryVersion((version) => version + 1);
        }
        if (selectionGroupRef.current) attachTransformForSelection([...selectedIdsRef.current]);
        renderer.domElement.style.cursor = '';
        if (modeRef.current === 'scale') hideScaleFeedbackSoon();
        setOperationStatus('就緒');
        window.setTimeout(() => {
          suppressNextClickSelectionRef.current = false;
          isGizmoPointerDownRef.current = false;
          if (orbitRef.current) orbitRef.current.enabled = true;
        }, 0);
      }
    });
    transform.addEventListener('objectChange', () => {
      const active = transform.object;
      if (!active) return;
      if (snapRef.current && modeRef.current === 'scale') snapObjectDimensions(active);
      selectedRef.current = active;
      setSelected(readTransform(active));
      if (modeRef.current === 'scale' && isTransformDraggingRef.current) updateScaleFeedback(active, true);
    });
    const transformHelper = transform.getHelper();
    scene.add(transformHelper);
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
      const time = localStorage.getItem('printModeler.autosaveTime');
      if (saved) setAutosavePrompt({ saved, time });
      else autosaveReadyRef.current = true;
    }, 350);

    const isPointerOnGizmo = () => {
      if (editModeRef.current !== 'object' || !transformHelper?.visible) return false;
      return raycasterRef.current.intersectObject(transformHelper, true).length > 0;
    };

    const onPointerDown = (event) => {
      if (event.button === 1) {
        isMiddleMousePanningRef.current = true;
        setOperationStatus('視角平移');
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      setContextMenu(null);

      if (isTransformDraggingRef.current || transform.dragging) return;

      const pointerOnGizmo = isPointerOnGizmo();
      if (pointerOnGizmo) {
        isGizmoPointerDownRef.current = true;
        suppressNextClickSelectionRef.current = true;
        orbit.enabled = false;
        renderer.domElement.style.cursor = 'grab';
        setOperationStatus('準備操作變形軸');
        return;
      }

      if (event.shiftKey && (event.button === 0 || event.button === 1)) setOperationStatus('視角平移');
      else if (event.button === 0 || event.button === 1) setOperationStatus('視角旋轉');

      if (event.button !== 0) return;
      if (suppressNextClickSelectionRef.current || isGizmoPointerDownRef.current) return;
      if (boxSelectActiveRef.current && event.button === 0) {
        event.preventDefault();
        event.stopPropagation();
        boxSelectStartRef.current = { x: event.clientX, y: event.clientY };
        const nextRect = { x: event.clientX, y: event.clientY, width: 0, height: 0 };
        boxSelectRectRef.current = nextRect;
        setBoxSelectRect(nextRect);
        return;
      }
      if (measureActiveRef.current) {
        event.preventDefault();
        event.stopPropagation();
        pickMeasurePoint();
        return;
      }
      if (editModeRef.current === 'sculpt') {
        if (event.button !== 0) return;
        if (event.altKey || event.shiftKey) return;
        const hit = getSculptHit();
        if (!hit?.object) return;
        event.preventDefault();
        event.stopPropagation();
        beginSculptStroke();
        return;
      }
      if (editModeRef.current === 'face') {
        if (event.altKey || event.shiftKey) return;
        const root = objectsRef.current.find((object) => object.uuid === selectedIdsRef.current[0]);
        const faceHit = root ? raycasterRef.current.intersectObjects(getPrintableMeshes(root), false)[0] : null;
        if (!faceHit?.object) return;
        event.preventDefault();
        event.stopPropagation();
        pickFaceFromPointer();
        return;
      }
      if (editModeRef.current === 'edge') {
        if (event.altKey || event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
        pickEdgeFromPointer();
        return;
      }
      if (editModeRef.current === 'vertex') {
        if (event.altKey || event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
        pickVertexFromPointer();
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
      if (isMiddleMousePanningRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      if (isTransformDraggingRef.current || transform.dragging || isGizmoPointerDownRef.current) {
        renderer.domElement.style.cursor = 'grabbing';
        return;
      }
      if (isPointerOnGizmo()) {
        renderer.domElement.style.cursor = 'grab';
        setOperationStatus('可拖曳變形軸');
        return;
      }
      renderer.domElement.style.cursor = '';
      if (event.buttons && (event.shiftKey || event.button === 1)) setOperationStatus('視角平移');
      if (boxSelectStartRef.current) {
        event.preventDefault();
        event.stopPropagation();
        const start = boxSelectStartRef.current;
        const nextRect = {
          x: Math.min(start.x, event.clientX),
          y: Math.min(start.y, event.clientY),
          width: Math.abs(event.clientX - start.x),
          height: Math.abs(event.clientY - start.y),
        };
        boxSelectRectRef.current = nextRect;
        setBoxSelectRect(nextRect);
        return;
      }
      if (editModeRef.current !== 'sculpt') return;
      continueSculptStroke();
    };

    const onPointerUp = (event) => {
      if (event.button === 1) {
        isMiddleMousePanningRef.current = false;
        setOperationStatus('就緒');
        return;
      }
      if (isTransformDraggingRef.current || transform.dragging || isGizmoPointerDownRef.current || suppressNextClickSelectionRef.current) {
        event.preventDefault();
        isGizmoPointerDownRef.current = false;
        setOperationStatus('就緒');
        window.setTimeout(() => {
          if (!isTransformDraggingRef.current && !transform.dragging) {
            suppressNextClickSelectionRef.current = false;
            if (orbitRef.current) orbitRef.current.enabled = true;
          }
        }, 0);
        return;
      }
      if (boxSelectStartRef.current) {
        event.preventDefault();
        event.stopPropagation();
        selectObjectsInBox(boxSelectRectRef.current);
        boxSelectStartRef.current = null;
        boxSelectRectRef.current = null;
        setBoxSelectRect(null);
        return;
      }
      if (editModeRef.current === 'sculpt') endSculptStroke();
    };

    const onPointerLeave = () => {
      isMiddleMousePanningRef.current = false;
      if (!isTransformDraggingRef.current && !transform.dragging) {
        isGizmoPointerDownRef.current = false;
        if (orbitRef.current) orbitRef.current.enabled = true;
      }
      if (editModeRef.current === 'sculpt') {
        hideBrushPreview();
        endSculptStroke();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown, true);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    const onContextMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const meshes = objectsRef.current.flatMap((object) => getPrintableMeshes(object));
      const hit = raycasterRef.current.intersectObjects(meshes, false)[0];
      const root = hit?.object ? objectsRef.current.find((object) => {
        let found = false;
        object.traverse((child) => { if (child === hit.object) found = true; });
        return found;
      }) : null;
      if (root && !selectedIdsRef.current.includes(root.uuid)) updateSelection(root, false);
      setContextMenu({ x: event.clientX, y: event.clientY, type: root ? 'object' : 'empty' });
    };
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown, true);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      isTransformDraggingRef.current = false;
      isGizmoPointerDownRef.current = false;
      isMiddleMousePanningRef.current = false;
      suppressNextClickSelectionRef.current = false;
      orbit.enabled = true;
      clearBrushPreview();
      clearRepairHelper();
      clearViewAssistHelpers();
      transform.dispose();
      orbit.dispose();
      disposeObject(scene);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (scaleFeedbackTimerRef.current) window.clearTimeout(scaleFeedbackTimerRef.current);
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

  useKeyboardShortcuts({
    activeWorkflowRef,
    modeRef,
    prefsRef,
    selectedIdsRef,
    undo,
    redo,
    setMode,
    switchWorkflow,
    setSculptSettings,
    roundNumber,
    setAxisLock,
    setBoxSelectActive,
    setContextMenu,
    attachTransformForSelection,
    focusSelectedObject,
    frameAllObjects,
    duplicateSelected,
    toggleProjection,
    setCameraView,
    deleteSelectedWithConfirm,
    showToast,
  });

  useEffect(() => {
    multiSelectRef.current = multiSelect;
  }, [multiSelect]);

  useEffect(() => {
    editModeRef.current = editMode;
    const transform = transformRef.current;
    if (!transform) return;
    if (editMode !== 'object') {
      if (!selectedIdsRef.current.length) showToast('請先選取一個 mesh 物件');
      transform.detach();
      detachSelectionGroup();
      if (editMode !== 'sculpt') hideBrushPreview();
      if (editMode !== 'face') clearFaceHelper();
      setSelected(primarySelected ? readTransform(primarySelected) : null);
    } else {
      clearFaceHelper();
      clearEdgeHelper();
      clearVertexHelper();
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
    measureActiveRef.current = measureActive;
  }, [measureActive]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    clearViewAssistHelpers();
    const targets = selectedObjects.length ? selectedObjects : objectsRef.current;
    targets.forEach((object) => {
      if (viewAssist.wireframe) {
        const helper = createWireframeOverlay(object, THREE);
        if (helper.children.length) {
          scene.add(helper);
          viewAssistHelpersRef.current.push(helper);
        }
      }
      if (viewAssist.vertices) {
        const helper = createVertexCloud(object, THREE);
        if (helper.children.length) {
          scene.add(helper);
          viewAssistHelpersRef.current.push(helper);
        }
      }
      if (viewAssist.boundingBox) {
        const helper = new THREE.BoxHelper(object, 0x22c55e);
        helper.userData.helper = true;
        scene.add(helper);
        viewAssistHelpersRef.current.push(helper);
      }
    });
    return () => clearViewAssistHelpers();
  }, [viewAssist, selectedIds, objects]);

  useEffect(() => {
    modeRef.current = mode;
    transformRef.current?.setMode(mode);
    setLockedAxis(null);
  }, [mode]);

  useEffect(() => {
    transformRef.current?.setSpace(transformSpace);
  }, [transformSpace]);

  useEffect(() => {
    snapRef.current = snapEnabled;
    const transform = transformRef.current;
    if (!transform) return;
    transform.setTranslationSnap(snapEnabled ? Math.max(0.1, Number(prefs.snapDistance) || 1) : null);
    transform.setRotationSnap(snapEnabled ? THREE.MathUtils.degToRad(15) : null);
    transform.setScaleSnap(snapEnabled ? 0.5 : null);
  }, [snapEnabled, preferences]);

  useEffect(() => {
    localStorage.setItem('printModeler.preferences', JSON.stringify(preferences));
    applyOrbitControlStyle(orbitRef.current, THREE, prefs.operationStyle, prefs.mouseSensitivity);
  }, [preferences]);

  useEffect(() => {
    const transform = transformRef.current;
    if (!transform) return;
    transform.showX = !lockedAxis || lockedAxis === 'x';
    transform.showY = !lockedAxis || lockedAxis === 'y';
    transform.showZ = !lockedAxis || lockedAxis === 'z';
  }, [lockedAxis]);

  useEffect(() => {
    boxSelectActiveRef.current = boxSelectActive;
  }, [boxSelectActive]);

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

  function recordError(message) {
    setLastErrorMessage(message || '');
  }

  function getSelectedPrintObjects() {
    const selectedSet = new Set(selectedIdsRef.current);
    return objectsRef.current.filter((object) => selectedSet.has(object.uuid) && object.userData.printObject && object.visible !== false && !object.userData.locked);
  }

  function getSelectedSolidsAndHoles() {
    const selectedItems = getSelectedPrintObjects();
    return {
      selectedItems,
      solids: selectedItems.filter((object) => object.userData.mode !== 'hole'),
      holes: selectedItems.filter((object) => object.userData.mode === 'hole'),
    };
  }

  function getNextObjectName(type, reservedNames = []) {
    const baseName = getShapeDisplayName(type);
    let next = 1;
    const usedNames = new Set([...objectsRef.current.map((object) => object.name), ...reservedNames]);
    while (usedNames.has(`${baseName} ${next}`)) next += 1;
    return `${baseName} ${next}`;
  }

  function getNextNamedObjectName(baseName) {
    let next = 1;
    const usedNames = new Set(objectsRef.current.map((object) => object.name));
    while (usedNames.has(`${baseName} ${next}`)) next += 1;
    return `${baseName} ${next}`;
  }

  function runSafe(label, action) {
    try {
      return action();
    } catch (error) {
      console.error(`${label} failed`, error);
      const message = `${label} 失敗：${error.message || '未知錯誤'}`;
      recordError(message);
      showToast(message);
      return null;
    }
  }

  function restoreAutosave() {
    if (!autosavePrompt?.saved) {
      autosaveReadyRef.current = true;
      setAutosavePrompt(null);
      return;
    }
    try {
      loadProjectData(JSON.parse(autosavePrompt.saved));
      if (autosavePrompt.time) setLastAutosave(autosavePrompt.time);
      showToast('已恢復上次未儲存的模型');
    } catch (error) {
      const message = `恢復 autosave 失敗：${error.message}`;
      recordError(message);
      showToast(message);
    } finally {
      autosaveReadyRef.current = true;
      setAutosavePrompt(null);
    }
  }

  function ignoreAutosave() {
    autosaveReadyRef.current = true;
    setAutosavePrompt(null);
    showToast('已忽略 autosave');
  }

  function clearAutosave() {
    localStorage.removeItem('printModeler.autosave');
    localStorage.removeItem('printModeler.autosaveTime');
    autosaveReadyRef.current = true;
    setAutosavePrompt(null);
    showToast('已清除 autosave');
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
    clearRepairHelper();
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
    const vertexCount = objectsRef.current.reduce((total, object) => total + countObjectVertices(object), 0);
    if (vertexCount > LARGE_UNDO_VERTEX_THRESHOLD) showToast('大型模型 Undo 可能較慢');
    historyRef.current.push(makeSnapshot());
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
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
    clearRepairHelper();
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

  function clearEdgeHelper() {
    const scene = sceneRef.current;
    if (!scene || !edgeHelperRef.current) return;
    scene.remove(edgeHelperRef.current);
    edgeHelperRef.current.geometry?.dispose?.();
    edgeHelperRef.current.material?.dispose?.();
    edgeHelperRef.current = null;
  }

  function clearVertexHelper() {
    const scene = sceneRef.current;
    if (!scene || !vertexHelperRef.current) return;
    scene.remove(vertexHelperRef.current);
    disposeObject(vertexHelperRef.current);
    vertexHelperRef.current = null;
  }

  function showEdgeHelper(edge) {
    const scene = sceneRef.current;
    if (!scene || !edge?.points?.length) return;
    clearEdgeHelper();
    const helper = createEdgeHighlight(edge.points, THREE);
    scene.add(helper);
    edgeHelperRef.current = helper;
  }

  function showVertexHelper(vertex) {
    const scene = sceneRef.current;
    if (!scene || !vertex?.point) return;
    clearVertexHelper();
    const helper = createVertexHighlight(vertex.point, THREE);
    scene.add(helper);
    vertexHelperRef.current = helper;
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

  function clearMeasureHelper() {
    const scene = sceneRef.current;
    if (!scene || !measureHelperRef.current) return;
    scene.remove(measureHelperRef.current);
    disposeObject(measureHelperRef.current);
    measureHelperRef.current = null;
  }

  function clearRepairHelper() {
    const scene = sceneRef.current;
    if (!scene || !repairHelperRef.current) return;
    scene.remove(repairHelperRef.current);
    disposeObject(repairHelperRef.current);
    repairHelperRef.current = null;
  }

  function clearViewAssistHelpers() {
    const scene = sceneRef.current;
    if (!scene) return;
    viewAssistHelpersRef.current.forEach((helper) => {
      scene.remove(helper);
      disposeObject(helper);
    });
    viewAssistHelpersRef.current = [];
  }

  function showHoleHelpers(target) {
    const scene = sceneRef.current;
    if (!scene || !target) return;
    clearRepairHelper();
    const group = new THREE.Group();
    group.userData.helper = true;
    target.meshes.forEach((mesh) => {
      const analysis = analyzeMeshRepairGeometry(mesh.geometry);
      if (!analysis.holes.length) return;
      mesh.updateWorldMatrix(true, false);
      const points = [];
      analysis.holes.forEach((hole) => {
        for (let i = 0; i < hole.points.length; i += 1) {
          const a = hole.points[i].clone().applyMatrix4(mesh.matrixWorld);
          const b = hole.points[(i + 1) % hole.points.length].clone().applyMatrix4(mesh.matrixWorld);
          points.push(a, b);
        }
      });
      if (!points.length) return;
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ color: 0xfb923c, depthTest: false, transparent: true, opacity: 0.95 }),
      );
      line.renderOrder = 40;
      line.userData.helper = true;
      group.add(line);
    });
    if (!group.children.length) return;
    scene.add(group);
    repairHelperRef.current = group;
  }

  function updateMeasureHelper(points) {
    const scene = sceneRef.current;
    if (!scene) return;
    clearMeasureHelper();
    if (!points.length) return;
    const group = new THREE.Group();
    group.userData.helper = true;
    points.forEach((point) => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(1.8, 16, 8),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false }),
      );
      dot.position.copy(point);
      dot.userData.helper = true;
      group.add(dot);
    });
    if (points.length === 2) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0xfacc15, depthTest: false }),
      );
      line.userData.helper = true;
      group.add(line);
    }
    scene.add(group);
    measureHelperRef.current = group;
  }

  function pickMeasurePoint() {
    const meshes = objectsRef.current.flatMap((object) => getPrintableMeshes(object));
    const hit = raycasterRef.current.intersectObjects(meshes, false)[0];
    if (!hit?.point) {
      showToast('請點選模型表面進行測量');
      return;
    }
    setMeasurePoints((points) => {
      const next = points.length >= 2 ? [hit.point.clone()] : [...points, hit.point.clone()];
      updateMeasureHelper(next);
      return next;
    });
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

  function pickEdgeFromPointer() {
    const root = objectsRef.current.find((object) => object.uuid === selectedIdsRef.current[0]);
    if (!root) {
      showToast('請先選取一個物件');
      return;
    }
    const hit = raycasterRef.current.intersectObjects(getPrintableMeshes(root), false)[0];
    const edge = getClosestEdgeFromIntersection(hit, THREE);
    if (!edge) {
      clearEdgeHelper();
      setEdgeSelection(null);
      showToast('請點選模型邊線附近');
      return;
    }
    showEdgeHelper(edge);
    setEdgeSelection({
      edgeIndex: edge.edgeIndex,
      length: roundNumber(edge.length, 2),
      faceIndex: edge.faceIndex,
    });
  }

  function pickVertexFromPointer() {
    const root = objectsRef.current.find((object) => object.uuid === selectedIdsRef.current[0]);
    if (!root) {
      showToast('請先選取一個物件');
      return;
    }
    const hit = raycasterRef.current.intersectObjects(getPrintableMeshes(root), false)[0];
    const vertex = getClosestVertexFromIntersection(hit, THREE);
    if (!vertex) {
      clearVertexHelper();
      setVertexSelection(null);
      showToast('請點選模型頂點附近');
      return;
    }
    showVertexHelper(vertex);
    setVertexSelection({
      vertexIndex: vertex.vertexIndex,
      point: {
        x: roundNumber(vertex.point.x, 2),
        y: roundNumber(vertex.point.y, 2),
        z: roundNumber(vertex.point.z, 2),
      },
      faceIndex: vertex.faceIndex,
    });
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

    const localPoint = mesh.worldToLocal(hit.point.clone());
    const brushNormal = triangle.normal.clone().normalize();
    const strokePoints = [{ point: localPoint, normal: brushNormal }];
    axes.forEach((axis) => {
      if (!settings[`symmetry${axis.toUpperCase()}`]) return;
      const mirrorPoint = localPoint.clone();
      const mirrorNormal = brushNormal.clone();
      mirrorPoint[axis] *= -1;
      mirrorNormal[axis] *= -1;
      strokePoints.push({ point: mirrorPoint, normal: mirrorNormal.normalize() });
    });

    let changed = false;
    strokePoints.forEach(({ point, normal }) => {
      changed = applySculptAtPoint(mesh, geometry, point, normal, settings) || changed;
    });
    if (!changed) return false;

    updateEditedMesh(mesh);
    sculptChangedRef.current = true;
    return true;
  }

  function applySculptAtPoint(mesh, geometry, localPoint, brushNormal, settings) {
    const radius = Math.max(0.5, Number(settings.radius) || 15);
    const strength = THREE.MathUtils.clamp(Number(settings.strength) || 0, 0, 1);
    const position = geometry.attributes.position;
    const normalAttribute = geometry.attributes.normal;
    const deltaDistance = radius * 0.075 * strength;
    const affected = [];

    for (let i = 0; i < position.count; i += 1) {
      const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
      const distance = vertex.distanceTo(localPoint);
      if (distance > radius) continue;
      const weight = getFalloffWeight(distance, radius, settings.falloff);
      if (weight <= 0) continue;
      affected.push({ index: i, vertex, weight });
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
        setPositionAt(position, index, vertex.clone().addScaledVector(brushNormal, -offset * weight * strength));
      });
    } else {
      affected.forEach(({ index, vertex, weight }) => {
        let direction = brushNormal;
        let sign = settings.brushMode === 'lower' ? -1 : 1;
        if (settings.brushMode === 'inflate' && normalAttribute) direction = new THREE.Vector3().fromBufferAttribute(normalAttribute, index).normalize();
        setPositionAt(position, index, vertex.clone().addScaledVector(direction, deltaDistance * weight * sign));
      });
    }
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
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
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
    clearEdgeHelper();
    clearVertexHelper();
    setEdgeSelection(null);
    setVertexSelection(null);
    detachSelectionGroup();
    const selectedItems = objectsRef.current.filter((object) => ids.includes(object.uuid) && object.visible !== false && !object.userData.locked);
    const safeIds = selectedItems.map((object) => object.uuid);
    selectedIdsRef.current = safeIds;
    setSelectedIds(safeIds);
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
    if (object.userData.locked) {
      showToast('物件已鎖定');
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
    const object = createShape(type, objectCountRef.current, shapeResolution);
    object.name = getNextObjectName(type);
    objectCountRef.current += 1;
    addObject(object);
    showToast(`已新增 ${getShapeDisplayName(type)}`);
  }

  function addText() {
    pushHistory('add text');
    const object = createTextObject(objectCountRef.current);
    object.name = getNextObjectName('text');
    objectCountRef.current += 1;
    addObject(object);
    showToast('已新增 文字');
  }

  function createBooleanTest() {
    pushHistory('create boolean test');
    detachSelectionGroup();
    const solidColor = '#38bdf8';
    const holeColor = '#ef4444';
    const solid = makeBox('Boolean Test Solid', { x: 30, y: 30, z: 30 }, new THREE.Color(solidColor), { x: 0, y: 0, z: 15 });
    markPrintObject(solid, getNextObjectName('cube'), 'cube', { color: solidColor, mode: 'solid' });
    const hole = makeCylinder('Boolean Test Hole', 7, 48, new THREE.Color(holeColor), { x: 0, y: 0, z: 15 }, 64);
    markPrintObject(hole, getNextObjectName('cylinder', [solid.name]), 'cylinder', { color: holeColor, mode: 'hole' });
    objectsRef.current.push(solid, hole);
    sceneRef.current.add(solid, hole);
    objectCountRef.current += 2;
    refreshObjects();
    attachTransformForSelection([solid.uuid, hole.uuid]);
    showToast('已建立 Boolean 測試物件');
  }

  function createExampleScene() {
    if (objectsRef.current.length && !window.confirm('目前場景已有物件，要以範例場景取代嗎？')) return;
    pushHistory('example scene');
    detachSelectionGroup();
    objectsRef.current.forEach((object) => {
      sceneRef.current.remove(object);
      disposeObject(object);
    });
    objectsRef.current = [];

    const cubeColor = '#38bdf8';
    const holeColor = '#ef4444';
    const cylinderColor = '#22c55e';
    const textColor = '#facc15';
    const cube = makeBox('範例方塊', { x: 42, y: 42, z: 34 }, new THREE.Color(cubeColor), { x: -32, y: 0, z: 17 });
    markPrintObject(cube, '方塊 1', 'cube', { color: cubeColor, mode: 'solid' });

    const sphere = createShape('sphere', 1, 'medium');
    sphere.name = '挖洞球體 1';
    sphere.position.set(-18, 0, 18);
    sphere.scale.set(0.9, 0.9, 0.9);
    sphere.userData.mode = 'hole';
    sphere.userData.color = holeColor;
    applyModeAndColor(sphere, 'hole', holeColor);

    const cylinder = makeCylinder('圓柱 1', 12, 48, new THREE.Color(cylinderColor), { x: 38, y: 0, z: 24 }, 64);
    markPrintObject(cylinder, '圓柱 1', 'cylinder', { color: cylinderColor, mode: 'solid' });

    const text = createTextObject(0, { text: 'TEST', size: 14, depth: 3, align: 'center' });
    text.name = '文字 1';
    text.position.set(0, -52, 2);
    text.userData.color = textColor;
    applyModeAndColor(text, 'solid', textColor);

    objectsRef.current.push(cube, sphere, cylinder, text);
    objectsRef.current.forEach((object) => sceneRef.current.add(object));
    objectCountRef.current += 4;
    refreshObjects();
    attachTransformForSelection([cube.uuid, sphere.uuid]);
    switchWorkflow('model');
    showToast('已建立範例場景，可以測試打洞、合併與匯出。');
  }

  function createBeginnerBasicModel() {
    addShape('cube');
    showToast('已建立方塊，可以用 G / R / S 調整位置與大小');
  }

  function showImportModelStub() {
    showToast('STL / OBJ 匯入尚未完成，請先使用左側基本形狀或載入專案 JSON');
  }

  function createStorageBoxStarter() {
    pushHistory('create starter box');
    detachSelectionGroup();
    const color = '#38bdf8';
    const wall = 3;
    const width = 62;
    const depth = 42;
    const height = 24;
    const parts = [
      makeBox('盒子底板', { x: width, y: depth, z: wall }, new THREE.Color(color), { x: 0, y: 0, z: wall / 2 }),
      makeBox('盒子左牆', { x: wall, y: depth, z: height }, new THREE.Color(color), { x: -width / 2 + wall / 2, y: 0, z: height / 2 }),
      makeBox('盒子右牆', { x: wall, y: depth, z: height }, new THREE.Color(color), { x: width / 2 - wall / 2, y: 0, z: height / 2 }),
      makeBox('盒子前牆', { x: width, y: wall, z: height }, new THREE.Color(color), { x: 0, y: -depth / 2 + wall / 2, z: height / 2 }),
      makeBox('盒子後牆', { x: width, y: wall, z: height }, new THREE.Color(color), { x: 0, y: depth / 2 - wall / 2, z: height / 2 }),
    ];
    const reservedNames = [];
    parts.forEach((part) => {
      markPrintObject(part, getNextObjectName('cube', reservedNames), 'cube', { color, mode: 'solid' });
      reservedNames.push(part.name);
      objectsRef.current.push(part);
      sceneRef.current.add(part);
    });
    objectCountRef.current += parts.length;
    refreshObjects();
    attachTransformForSelection(parts.map((part) => part.uuid));
    switchWorkflow('model');
    showToast('已建立簡易盒子，可調整尺寸或合併成單一模型');
  }

  function createTextSignStarter() {
    pushHistory('create text sign');
    detachSelectionGroup();
    const baseColor = '#334155';
    const textColor = '#facc15';
    const base = makeBox('文字牌底板', { x: 72, y: 28, z: 3 }, new THREE.Color(baseColor), { x: 0, y: 0, z: 1.5 });
    markPrintObject(base, getNextObjectName('cube'), 'cube', { color: baseColor, mode: 'solid' });
    const text = createTextObject(objectCountRef.current, { text: 'TEXT', size: 12, depth: 2.5, align: 'center' });
    text.name = getNextObjectName('text', [base.name]);
    text.position.set(0, -6, 3.1);
    text.userData.color = textColor;
    applyModeAndColor(text, 'solid', textColor);
    objectsRef.current.push(base, text);
    sceneRef.current.add(base, text);
    objectCountRef.current += 2;
    refreshObjects();
    attachTransformForSelection([base.uuid, text.uuid]);
    switchWorkflow('model');
    showToast('已建立文字牌範例，可在右側修改文字內容');
  }

  async function copyDebugInfo() {
    const info = [
      `App version: ${APP_VERSION}`,
      `Browser userAgent: ${navigator.userAgent}`,
      `Object count: ${objectsRef.current.length}`,
      `Selected count: ${selectedIdsRef.current.length}`,
      `Last error message: ${lastErrorMessage || '無'}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(info);
      showToast('已複製除錯資訊');
    } catch (error) {
      recordError(`複製除錯資訊失敗：${error.message}`);
      showToast('複製除錯資訊失敗');
    }
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
    const reservedNames = [];
    const clones = selectedIdsRef.current.map((id) => objectsRef.current.find((item) => item.uuid === id)).filter(Boolean).map((source) => {
      const clone = clonePrintable(source);
      clone.name = getNextObjectName(source.userData.shapeType || 'custom', reservedNames);
      reservedNames.push(clone.name);
      return clone;
    });
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

  function matrixDuplicateStub() {
    showToast('複製矩陣尚未完整實作，請先使用「複製一排」建立線性陣列');
  }

  function resetCameraView() {
    const camera = cameraRef.current;
    const orbit = orbitRef.current;
    if (!camera || !orbit) return;
    camera.position.set(220, -260, 180);
    orbit.target.set(0, 0, 25);
    orbit.update();
  }

  function setCameraView(view) {
    const camera = cameraRef.current;
    const orbit = orbitRef.current;
    applyCameraView(camera, orbit, view);
  }

  function focusSelectedObject() {
    const target = primarySelected || objectsRef.current.find((object) => selectedIdsRef.current.includes(object.uuid));
    if (!target) {
      showToast('請先選取物件');
      return;
    }
    focusCameraOnBoxUtil(cameraRef.current, orbitRef.current, getObjectBounds(target).box, 80);
    showToast('已聚焦選取物件');
  }

  function frameAllObjects() {
    const box = new THREE.Box3();
    let hasContent = false;
    objectsRef.current.filter((object) => object.visible !== false).forEach((object) => {
      box.union(getObjectBounds(object).box);
      hasContent = true;
    });
    box.expandByPoint(new THREE.Vector3(-printerSize.x / 2, -printerSize.y / 2, 0));
    box.expandByPoint(new THREE.Vector3(printerSize.x / 2, printerSize.y / 2, printerSize.z * 0.4));
    focusCameraOnBoxUtil(cameraRef.current, orbitRef.current, box, hasContent ? 160 : 260);
    showToast('Framed scene');
  }

  function toggleProjection() {
    const camera = cameraRef.current;
    if (!camera) return;
    const next = toggleCameraProjectionFov(camera, cameraProjectionRef.current);
    setCameraProjection(next);
    cameraProjectionRef.current = next;
    localStorage.setItem('printModeler.cameraProjection', next);
    showToast(next === 'orthographic' ? '已切換為正交視角' : '已切換為透視視角');
  }

  function setAxisLock(axis) {
    setLockedAxis((current) => {
      const next = current === axis ? null : axis;
      showToast(next ? `軸向限制：${next.toUpperCase()}` : '已取消軸向限制');
      return next;
    });
  }

  function deleteSelectedWithConfirm() {
    if (!selectedIdsRef.current.length) {
      showToast('沒有選取物件');
      return;
    }
    if (window.confirm('確定要刪除選取物件嗎？')) deleteSelected();
    else showToast('已取消刪除');
  }

  function selectObjectsInBox(selectionRect = boxSelectRectRef.current) {
    if (!selectionRect || selectionRect.width < 4 || selectionRect.height < 4) return;
    const camera = cameraRef.current;
    const mount = mountRef.current;
    if (!camera || !mount) return;
    const rect = mount.getBoundingClientRect();
    const minX = selectionRect.x;
    const maxX = selectionRect.x + selectionRect.width;
    const minY = selectionRect.y;
    const maxY = selectionRect.y + selectionRect.height;
    const ids = objectsRef.current.filter((object) => object.visible !== false && !object.userData.locked).filter((object) => {
      const { center } = getObjectBounds(object);
      const projected = center.clone().project(camera);
      const screenX = rect.left + ((projected.x + 1) / 2) * rect.width;
      const screenY = rect.top + ((1 - projected.y) / 2) * rect.height;
      return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
    }).map((object) => object.uuid);
    attachTransformForSelection(ids);
    setBoxSelectActive(false);
    showToast(ids.length ? `框選 ${ids.length} 個物件` : '框選範圍內沒有物件');
  }

  function copySelectedToClipboard() {
    const source = primarySelected || objectsRef.current.find((object) => selectedIdsRef.current.includes(object.uuid));
    if (!source) {
      showToast('沒有選取物件');
      return;
    }
    setClipboardObject(clonePrintable(source));
    showToast('Copied object');
  }

  function pasteClipboardObject() {
    if (!clipboardObject) {
      showToast('剪貼簿是空的');
      return;
    }
    pushHistory('paste');
    const clone = clonePrintable(clipboardObject);
    objectsRef.current.push(clone);
    sceneRef.current.add(clone);
    refreshObjects();
    attachTransformForSelection([clone.uuid]);
    showToast('已貼上物件');
  }

  function renameObject(object, name) {
    if (!object) return;
    object.name = name || '物件';
    refreshObjects();
    if (selectedIdsRef.current.includes(object.uuid)) setSelected(readTransform(object));
  }

  function toggleObjectVisibility(object) {
    if (!object) return;
    object.visible = !object.visible;
    if (!object.visible && selectedIdsRef.current.includes(object.uuid)) {
      attachTransformForSelection(selectedIdsRef.current.filter((id) => id !== object.uuid));
    }
    refreshObjects();
  }

  function toggleObjectLock(object) {
    if (!object) return;
    object.userData.locked = !object.userData.locked;
    if (object.userData.locked && selectedIdsRef.current.includes(object.uuid)) {
      attachTransformForSelection(selectedIdsRef.current.filter((id) => id !== object.uuid));
    }
    refreshObjects();
  }

  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function closeContextMenu() {
    setContextMenu(null);
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
    return runSafe('Merge', () => {
      detachSelectionGroup();
      const { solids } = getSelectedSolidsAndHoles();
      if (solids.length < 2) {
        showToast('請至少選取 2 個實體物件才能合併');
        return;
      }
      const meshes = solids.flatMap((object) => {
        object.updateMatrixWorld(true);
        return getPrintableMeshes(object);
      });
      if (meshes.length < 2) {
        showToast('請至少選取 2 個含有 mesh 的實體物件才能合併');
        return;
      }
      pushHistory('merge');
      const geometries = meshes.map(meshToMergeGeometry).filter(Boolean);
      const geometry = mergeGeometries(geometries, false);
      if (!geometry) return;
      const merged = createMeshFromGeometry('合併物件', geometry, solids[0].userData.color || getPrimaryColor(solids[0]));
      merged.position.set(0, 0, 0);
      merged.rotation.set(0, 0, 0);
      merged.scale.set(1, 1, 1);
      solids.forEach((object) => sceneRef.current.remove(object));
      objectsRef.current = objectsRef.current.filter((object) => !solids.includes(object));
      objectsRef.current.push(merged);
      sceneRef.current.add(merged);
      refreshObjects();
      attachTransformForSelection([merged.uuid]);
      showToast('已合併 ' + solids.length + ' 個物件');
    });
  }

  function applyHole() {
    detachSelectionGroup();
    const { selected, solids, holes } = getSelectedBooleanParts(objectsRef.current, selectedIdsRef.current);

    console.debug('[boolean]', {
      selected: selected.map((object) => ({ name: object.name, mode: object.userData.mode, type: object.type })),
      solids: solids.map((object) => object.name),
      holes: holes.map((object) => object.name),
    });

    const validation = validateBooleanInput(selected);
    if (!validation.ok) {
      const message = `${validation.message}（選取 ${selected.length}、實體 ${solids.length}、挖洞 ${holes.length}）`;
      setBooleanMessage(message);
      showToast(validation.message);
      return;
    }

    try {
      const target = solids[0];
      if (solids.length > 1) showToast('已使用第一個實體作為打洞目標');

      const result = runBooleanDifference(target, holes);
      if (!result.geometry) {
        const message = `${result.message}（選取 ${selected.length}、實體 ${solids.length}、挖洞 ${holes.length}、重疊 ${result.overlapCount}）`;
        setBooleanMessage(message);
        showToast(result.message);
        return;
      }

      pushHistory('boolean');
      const resultName = getNextNamedObjectName('打洞結果');
      const mesh = createMeshFromGeometry(resultName, result.geometry, target.userData.color || getPrimaryColor(target));
      mesh.userData.mode = 'solid';
      mesh.userData.shapeType = 'boolean';
      mesh.position.set(0, 0, 0);
      mesh.rotation.set(0, 0, 0);
      mesh.scale.set(1, 1, 1);

      const removedItems = [target, ...holes];
      removedItems.forEach((object) => sceneRef.current.remove(object));
      objectsRef.current = objectsRef.current.filter((object) => !removedItems.includes(object));
      objectsRef.current.push(mesh);
      sceneRef.current.add(mesh);
      refreshObjects();
      attachTransformForSelection([mesh.uuid]);
      const skippedMessage = result.skipped.length ? '已略過未重疊的挖洞物件。' : '';
      setBooleanMessage(`布林打洞完成。實體 ${solids.length}、挖洞 ${holes.length}、已使用 ${result.usedHoles.length}。${skippedMessage}`);
      showToast(result.skipped.length ? '已略過未重疊的挖洞物件，已套用打洞' : '已套用打洞');
    } catch (error) {
      console.error('Boolean Difference failed', error);
      const message = `打洞失敗：實體 ${solids.length}、挖洞 ${holes.length}，CSG 計算失敗：${error.message}`;
      setBooleanMessage(message);
      recordError(message);
      showToast('打洞失敗：請確認實體與挖洞物件有重疊');
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
      else if (path === 'scale') target.scale[axis] = Math.max(0.01, next);
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
    setMeshRepairResult(null);
    showToast(message);
  }

  function subdivideSelectedModel() {
    return runSafe('Subdivide', () => {
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
    });
  }

  function smoothSelectedModel() {
    return runSafe('Smooth', () => {
      const target = getSelectedPrintableTarget();
      if (!target) return;
      pushHistory('smooth model');
      target.meshes.forEach((mesh) => {
        const nextGeometry = smoothGeometryLaplacian(mesh.geometry, printPrepSettings.smoothStrength, printPrepSettings.smoothIterations);
        mesh.geometry.dispose();
        mesh.geometry = nextGeometry;
      });
      finishPrintPrepChange(target.object, '已平滑模型');
    });
  }

  function remeshSelectedModel() {
    return runSafe('Remesh', () => {
      const target = getSelectedPrintableTarget();
      if (!target) return;
      pushHistory('remesh');
      target.meshes.forEach((mesh) => {
        const nextGeometry = remeshGeometrySimple(mesh.geometry, printPrepSettings.remeshEdgeLength, printPrepSettings.remeshKeepVolume ? 1 : 3);
        mesh.geometry.dispose();
        mesh.geometry = nextGeometry;
      });
      finishPrintPrepChange(target.object, '已套用 Remesh 簡化版');
    });
  }

  function recalculateSelectedNormals() {
    return runSafe('Recalculate Normals', () => {
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
    });
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
    return runSafe('套用變形', () => {
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
    });
  }

  function applyPlaneCut() {
    return runSafe('Plane Cut', () => {
      const target = getSelectedPrintableTarget();
      if (!target) return;
      pushHistory('plane cut');
      target.meshes.forEach((mesh) => {
        const nextGeometry = planeCutGeometry(mesh.geometry, planeCutSettings.axis, Number(planeCutSettings.position) || 0, planeCutSettings.keep);
        mesh.geometry.dispose();
        mesh.geometry = nextGeometry;
      });
      finishPrintPrepChange(target.object, '已裁切模型，可能需要修補開口');
    });
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

  function getExportPrepTargets() {
    const selectedSet = new Set(selectedIdsRef.current);
    const selectedTargets = objectsRef.current.filter((object) => (
      selectedSet.has(object.uuid)
      && object.userData.printObject
      && object.visible !== false
      && !object.userData.locked
      && object.userData.mode !== 'hole'
    ));
    if (selectedTargets.length) return selectedTargets;
    if (!objectsRef.current.length) {
      showToast('沒有可準備的物件');
      return [];
    }
    if (!window.confirm('沒有選取物件，是否對全部可列印物件執行一鍵準備匯出？')) return [];
    return objectsRef.current.filter((object) => object.userData.printObject && object.visible !== false && !object.userData.locked && object.userData.mode !== 'hole');
  }

  function bakeTransformIntoObject(object) {
    object.updateWorldMatrix(true, true);
    object.traverse((child) => {
      if (!child.isMesh || !child.geometry || child.userData.helper) return;
      child.updateWorldMatrix(true, false);
      child.geometry.applyMatrix4(child.matrixWorld);
      child.position.set(0, 0, 0);
      child.rotation.set(0, 0, 0);
      child.scale.set(1, 1, 1);
      child.geometry.computeVertexNormals();
      child.geometry.computeBoundingBox();
      child.geometry.computeBoundingSphere();
    });
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);
  }

  function placeAndCenterObjectOnBed(object) {
    const { box, center } = getObjectBounds(object);
    object.position.x -= center.x;
    object.position.y -= center.y;
    object.position.z -= box.min.z;
  }

  function recalculateObjectNormals(object) {
    getPrintableMeshes(object).forEach((mesh) => {
      makeEditableGeometry(mesh);
      mesh.geometry.computeVertexNormals();
      mesh.geometry.attributes.position.needsUpdate = true;
      if (mesh.geometry.attributes.normal) mesh.geometry.attributes.normal.needsUpdate = true;
    });
  }

  function prepareExport() {
    return runSafe('一鍵準備匯出', () => {
      const targets = getExportPrepTargets();
      if (!targets.length) return;
      pushHistory('prepare export');
      detachSelectionGroup();
      targets.forEach((object) => {
        bakeTransformIntoObject(object);
        placeAndCenterObjectOnBed(object);
        recalculateObjectNormals(object);
      });
      const results = buildMeshCheckResults(targets);
      setMeshCheckResults(results);
      refreshObjects();
      attachTransformForSelection(targets.map((object) => object.uuid));
      const hasError = results.some((item) => item.status === 'error');
      const hasWarning = results.some((item) => item.status === 'warning');
      if (hasError) showToast('一鍵準備完成，但模型仍有錯誤，建議先修復再匯出。');
      else if (hasWarning) showToast('一鍵準備完成，有警告但可視情況匯出。');
      else showToast('一鍵準備完成，模型可匯出 STL。');
    });
  }

  function summarizeRepairTarget(target, lastMessage = '') {
    const summaries = target.meshes.map((mesh) => analyzeMeshRepairGeometry(mesh.geometry));
    const holes = summaries.flatMap((item) => item.holes);
    return {
      holeCount: holes.length,
      boundaryEdgeCount: summaries.reduce((sum, item) => sum + item.boundaryEdgeCount, 0),
      degenerateFaceCount: summaries.reduce((sum, item) => sum + item.degenerateFaceCount, 0),
      looseIslandCount: summaries.reduce((sum, item) => sum + Math.max(0, item.looseIslandCount - 1), 0),
      holeDetails: holes.map((hole, index) => ({ index: index + 1, edgeCount: hole.edgeCount, simple: hole.simple })),
      lastMessage,
    };
  }

  function replaceMeshGeometry(mesh, nextGeometry) {
    mesh.geometry.dispose();
    mesh.geometry = nextGeometry;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.attributes.position.needsUpdate = true;
    if (mesh.geometry.attributes.normal) mesh.geometry.attributes.normal.needsUpdate = true;
  }

  function findSelectedHoles() {
    return runSafe('尋找破洞', () => {
      const target = getSelectedPrintableTarget();
      if (!target) return;
      const result = summarizeRepairTarget(target, '已尋找破洞');
      setMeshRepairResult(result);
      showHoleHelpers(target);
      showToast(`找到 ${result.holeCount} 個破洞`);
    });
  }

  function fillSelectedHoles() {
    return runSafe('補洞', () => {
      const target = getSelectedPrintableTarget();
      if (!target) return;
      pushHistory('fill holes');
      let filled = 0;
      let skipped = 0;
      target.meshes.forEach((mesh) => {
        const result = fillHolesGeometry(mesh.geometry);
        filled += result.filled;
        skipped += result.skipped;
        replaceMeshGeometry(mesh, result.geometry);
      });
      finishPrintPrepChange(target.object, '已補洞');
      const summary = summarizeRepairTarget(target, skipped ? `已補 ${filled} 個洞，略過 ${skipped} 個複雜洞` : `已補 ${filled} 個洞`);
      setMeshRepairResult(summary);
      clearRepairHelper();
      showToast(summary.lastMessage);
    });
  }

  function mergeSelectedCloseVertices() {
    return runSafe('Merge Close Vertices', () => {
      const target = getSelectedPrintableTarget();
      if (!target) return;
      pushHistory('merge close vertices');
      let merged = 0;
      target.meshes.forEach((mesh) => {
        const result = mergeCloseVerticesGeometry(mesh.geometry, Number(meshRepairSettings.tolerance) || 0.01);
        merged += result.mergedVertices;
        replaceMeshGeometry(mesh, result.geometry);
      });
      finishPrintPrepChange(target.object, '已合併接近頂點');
      setMeshRepairResult(summarizeRepairTarget(target, `合併了 ${merged} 個接近頂點`));
      showToast(`合併了 ${merged} 個接近頂點`);
    });
  }

  function removeSelectedDegenerateFaces() {
    return runSafe('Remove Degenerate Faces', () => {
      const target = getSelectedPrintableTarget();
      if (!target) return;
      pushHistory('remove degenerate faces');
      let removed = 0;
      target.meshes.forEach((mesh) => {
        const result = removeDegenerateFacesGeometry(mesh.geometry);
        removed += result.removedFaces;
        replaceMeshGeometry(mesh, result.geometry);
      });
      finishPrintPrepChange(target.object, '已移除退化面');
      setMeshRepairResult(summarizeRepairTarget(target, `移除了 ${removed} 個退化面`));
      showToast(`移除了 ${removed} 個退化面`);
    });
  }

  function removeSelectedLooseFaces() {
    return runSafe('Remove Loose Faces', () => {
      const target = getSelectedPrintableTarget();
      if (!target) return;
      pushHistory('remove loose faces');
      let removed = 0;
      target.meshes.forEach((mesh) => {
        const result = removeLooseFacesGeometry(mesh.geometry);
        removed += result.removedTriangles;
        replaceMeshGeometry(mesh, result.geometry);
      });
      finishPrintPrepChange(target.object, '已移除孤立面');
      setMeshRepairResult(summarizeRepairTarget(target, `移除了 ${removed} 個孤立 triangle`));
      showToast(`移除了 ${removed} 個孤立 triangle`);
    });
  }

  function autoRepairSelectedMesh() {
    return runSafe('自動修復', () => {
      const target = getSelectedPrintableTarget();
      if (!target) return;
      pushHistory('auto repair');
      let merged = 0;
      let degenerate = 0;
      let filled = 0;
      target.meshes.forEach((mesh) => {
        const mergedResult = mergeCloseVerticesGeometry(mesh.geometry, Number(meshRepairSettings.tolerance) || 0.01);
        merged += mergedResult.mergedVertices;
        const degenerateResult = removeDegenerateFacesGeometry(mergedResult.geometry);
        mergedResult.geometry.dispose();
        degenerate += degenerateResult.removedFaces;
        const fillResult = fillHolesGeometry(degenerateResult.geometry);
        degenerateResult.geometry.dispose();
        filled += fillResult.filled;
        replaceMeshGeometry(mesh, fillResult.geometry);
      });
      finishPrintPrepChange(target.object, '自動修復完成');
      const summary = summarizeRepairTarget(target, `自動修復：合併 ${merged} 點，移除 ${degenerate} 面，補 ${filled} 洞`);
      setMeshRepairResult(summary);
      setMeshCheckResults(buildMeshCheckResults([target.object]));
      clearRepairHelper();
      showToast(summary.lastMessage);
    });
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

  function extrudeSelectedFace(direction = 1) {
    const face = currentFaceRef.current;
    if (!face?.mesh) {
      showToast('請先點選模型表面');
      return;
    }
    const mesh = face.mesh;
    const geometry = makeEditableGeometry(mesh);
    if (!geometry?.attributes?.position) {
      showToast('geometry 沒有 position attribute');
      clearFaceHelper();
      return;
    }
    const distance = Math.abs(Number(faceSettings.extrudeDistance) || 0) * direction;
    if (Math.abs(distance) < 0.0001) {
      showToast('擠出距離不能為 0');
      return;
    }
    const result = extrudeTriangleFaceGeometry(geometry, face.faceIndex, distance);
    if (!result.geometry) {
      showToast(result.message || '擠出失敗');
      clearFaceHelper();
      return;
    }
    pushHistory('face extrude');
    mesh.geometry.dispose?.();
    mesh.geometry = result.geometry;
    updateEditedMesh(mesh);
    showFaceHelper(mesh, result.faceIndex);
    showToast(direction > 0 ? '已擠出面' : '已反向擠出面');
  }

  function insetExtrudeSelectedFace() {
    const face = currentFaceRef.current;
    if (!face?.mesh) {
      showToast('請先點選模型表面');
      return;
    }
    const result = insetTriangleFaceGeometry(face.mesh.geometry, face.faceIndex, 0, Number(faceSettings.extrudeDistance) || 0);
    showToast(result.message || '內縮擠出尚未支援');
  }

  function deleteSelectedFaceStub() {
    showToast('刪除面工具下一版開放，請先使用平面裁切或布林挖洞');
  }

  function flipSelectedFaceStub() {
    showToast('翻轉面工具下一版開放，請先使用「修正表面方向」整理法線');
  }

  function updateFreeformSculptSetting(key, value) {
    if (key === 'tool') {
      const modeMap = { pull: 'raise', push: 'lower', smooth: 'smooth' };
      setSculptSettings((settings) => ({ ...settings, brushMode: modeMap[value] || 'raise' }));
      return;
    }
    const targetKey = key === 'radius' ? 'radius' : key === 'strength' ? 'strength' : key;
    setSculptSettings((settings) => ({ ...settings, [targetKey]: value }));
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
    return runSafe(`匯出 ${format.toUpperCase()}`, () => {
      detachSelectionGroup();
      if (!objectsRef.current.length) {
        showToast('沒有可匯出的物件');
        return;
      }
      if (format === 'stl') {
        const printableObjects = objectsRef.current.filter((object) => object.userData.mode !== 'hole');
        const results = buildMeshCheckResults(printableObjects);
        setMeshCheckResults(results);
        const hasError = results.some((item) => item.status === 'error');
        const hasWarning = results.some((item) => item.status === 'warning');
        if (hasError && !window.confirm('模型檢查發現嚴重錯誤，仍要匯出 STL 嗎？')) {
          switchWorkflow('export');
          showToast('已取消匯出 STL');
          return;
        }
        if (!hasError && hasWarning) showToast('模型有警告，仍允許匯出 STL');
      }
      const group = new THREE.Group();
      objectsRef.current.filter((object) => object.userData.mode !== 'hole').forEach((object) => group.add(object.clone(true)));
      group.updateMatrixWorld(true);
      const exporter = format === 'obj' ? new OBJExporter() : new STLExporter();
      const data = format === 'obj' ? exporter.parse(group) : exporter.parse(group, { binary: false });
      const blob = new Blob([data], { type: format === 'obj' ? 'text/plain' : 'model/stl' });
      downloadBlob(blob, `print-model.${format}`);
      showToast(format === 'stl' ? 'STL 已匯出，可放入切片軟體。' : `已匯出 ${format.toUpperCase()}`);
    });
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
      runSafe('載入 JSON', () => {
        const data = JSON.parse(reader.result);
        loadProjectData(data);
        showToast('已載入專案');
      });
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
    <main className={`app-shell density-${prefs.density}`} onClick={closeContextMenu}>
      <TopToolbar>
        <div className="project-strip">
          <input className="project-name-input" value={projectName} placeholder="未命名模型" onChange={(event) => setProjectName(event.target.value || '未命名模型')} />
          <span>{lastAutosave ? `已自動儲存：${lastAutosave}` : '自動儲存已準備'}</span>
        </div>
        <div className="toolbar-group">
          <button onClick={undo} disabled={!historyRef.current.length}>復原 Undo</button>
          <button onClick={redo} disabled={!redoRef.current.length}>重做 Redo</button>
          <button className="danger" onClick={deleteSelectedWithConfirm} disabled={!selectedIds.length}><Trash2 size={18} />刪除</button>
          <input ref={fileInputRef} className="hidden-input" type="file" accept="application/json,.json" onChange={loadProjectFile} />
          <button onClick={() => setShowPreferences((value) => !value)}>偏好設定</button>
        </div>
        <BeginnerModeToggle value={uiMode} onChange={setUiMode} />
        <label className="switch-control">
          <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} />
          <span>{snapEnabled ? `吸附：${prefs.snapDistance} mm` : '吸附：關'}</span>
        </label>
        <label className="select-field">
          <span>列印機</span>
          <select value={printerKey} onChange={(event) => setPrinterKey(event.target.value)}>
            {Object.entries(PRINTERS).map(([key, printer]) => <option key={key} value={key}>{printer.label}</option>)}
          </select>
        </label>
      </TopToolbar>

      <nav className="workflow-tabs">
        {visibleWorkflowTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} className={activeWorkflow === tab.key ? 'active' : ''} onClick={() => switchWorkflow(tab.key)}>
              <Icon size={17} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <ModelingModeToolbar value={modelingMode} onChange={switchModelingMode} />

      {showGuide && (
        <GuidePanel
          onClose={() => setShowGuide(false)}
          onNeverShow={() => {
            localStorage.setItem('printModeler.hideGuide', 'true');
            setShowGuide(false);
          }}
        />
      )}

      {showPreferences && (
        <PreferencesPanel
          preferences={prefs}
          cameraProjection={cameraProjection}
          onChange={updatePreference}
          onClose={() => setShowPreferences(false)}
          onProjectionChange={toggleProjection}
          onCopyDebugInfo={copyDebugInfo}
        />
      )}

      {autosavePrompt && (
        <section className="autosave-modal" onClick={(event) => event.stopPropagation()}>
          <div className="autosave-card">
            <strong>偵測到上次未儲存的模型，是否恢復？</strong>
            <p>{autosavePrompt.time ? `上次自動儲存時間：${autosavePrompt.time}` : '可以恢復上一個自動儲存版本。'}</p>
            <div className="quick-start-actions">
              <button className="primary-action" onClick={restoreAutosave}>恢復</button>
              <button onClick={ignoreAutosave}>忽略</button>
              <button className="danger" onClick={clearAutosave}>清除 autosave</button>
            </div>
          </div>
        </section>
      )}

      <LeftPanel>
        <ToolboxPanel
          activeTab={leftToolTab}
          onTabChange={setLeftToolTab}
          resolution={shapeResolution}
          onResolutionChange={setShapeResolution}
          shapes={SHAPES}
          onAddShape={addShape}
          onAddText={addText}
          hasSelection={!!selectedIds.length}
          onCenter={centerSelectedOnPlate}
          onDrop={dropSelectedToPlate}
          onRowDuplicate={arrayDuplicate}
          onMatrixDuplicate={matrixDuplicateStub}
          onSetHole={() => setSelectedMode('hole')}
          onSetSolid={() => setSelectedMode('solid')}
          modelingMode={modelingMode}
          onModelingModeChange={switchModelingMode}
          uiMode={uiMode}
          onSetAdvancedMode={() => setUiMode('advanced')}
          onOpenRepairTools={() => {
            setRightPanelTab('repair');
            switchWorkflow('prep');
          }}
        />
        <div className="brand compact-brand"><span className="brand-mark">mm</span><span>工具箱</span></div>
        <CommonToolsPanel
          disabled={!selectedIds.length}
          onCenter={centerSelectedOnPlate}
          onDrop={dropSelectedToPlate}
          onRowDuplicate={arrayDuplicate}
          onMatrixDuplicate={matrixDuplicateStub}
          onSetHole={() => setSelectedMode('hole')}
          onSetSolid={() => setSelectedMode('solid')}
        />
        {activeWorkflow === 'model' ? (
          <>
            <div className="tool-section">
              <span className="section-label">解析度</span>
              <div className="segmented text-segmented resolution-toggle">
                {Object.entries(RESOLUTION_PRESETS).map(([key, preset]) => (
                  <button key={key} className={shapeResolution === key ? 'active' : ''} onClick={() => setShapeResolution(key)}>{preset.label}</button>
                ))}
              </div>
            </div>
            <div className="tool-section">
              <span className="section-label">基本形狀</span>
              {Object.entries(SHAPES).map(([type, shape]) => {
                const Icon = shape.icon;
                return <button key={type} className="tool-button primary-tool" onClick={() => addShape(type)}><Icon size={20} /><span>{shape.label}</span></button>;
              })}
              <button className="tool-button primary-tool" onClick={addText}><Type size={20} /><span>文字</span></button>
            </div>
          </>
        ) : (
          <div className="tool-section workflow-hint">
            <span className="section-label">{WORKFLOW_TABS.find((tab) => tab.key === activeWorkflow)?.label} 工具</span>
            {activeWorkflow === 'face' && <p>請在模型表面點選一個面，右側可推拉、軟編輯與平滑。</p>}
            {activeWorkflow === 'sculpt' && <p>選擇筆刷後，在模型表面按住左鍵拖曳即可雕刻。</p>}
            {activeWorkflow === 'prep' && <p>使用右側列印修復與網格修復工具檢查、修復與封口模型。</p>}
            {activeWorkflow === 'export' && <p>請先 Check Mesh，再匯出 STL 進行 3D 列印。</p>}
          </div>
        )}
      </LeftPanel>

      <section className="viewport-wrap">
        <div className="viewport-hud">
          Objects: {objects.length} <span>|</span> Selected: {selectedIds.length} <span>|</span> Mode: {editMode === 'face' ? 'Face' : editMode === 'sculpt' ? 'Sculpt' : 'Object'} <span>|</span> Printer: {printerSize.x}³ mm
        </div>
        <div ref={mountRef} className="three-viewport" />
        <ViewCube cameraProjection={cameraProjection} onView={setCameraView} onToggleProjection={toggleProjection} />
        <BoxSelectOverlay rect={boxSelectRect} mountRef={mountRef} />
        <ScaleFeedbackOverlay feedback={scaleFeedback} />
        <ModeHintOverlay mode={modelingMode} />
        {!objects.length && (
          <QuickStartCards
            onBasic={createBeginnerBasicModel}
            onImport={showImportModelStub}
            onBox={createStorageBoxStarter}
            onTextSign={createTextSignStarter}
          />
        )}
      </section>

      <RightPanel>
        <section className="sidebar-section outliner-section">
          <div className="sidebar-title"><span>物件列表</span><small>{objects.length} 個物件</small></div>
          <Outliner
            objects={objects}
            selectedIds={selectedIds}
            onSelect={updateSelection}
            onRename={renameObject}
            onToggleVisibility={toggleObjectVisibility}
            onToggleLock={toggleObjectLock}
          />
        </section>

        <section className="sidebar-section properties-section">
          <div className="sidebar-title"><span>屬性 / 工具設定</span><small>{selectedIds.length} 個已選取</small></div>

          <RightPanelTabs activeTab={rightPanelTab} onTabChange={setRightPanelTab} expertMode={expertMode}>
            {rightPanelTab === 'properties' && (
              <div className="property-stack">
                <SelectionSizeInfo info={selectionSizeInfo} />
                <ModelingToolPanel
                  modelingMode={modelingMode}
                  faceSelection={faceSelection}
                  edgeSelection={edgeSelection}
                  vertexSelection={vertexSelection}
                  sculptSettings={{
                    tool: sculptSettings.brushMode === 'lower' ? 'push' : sculptSettings.brushMode === 'smooth' ? 'smooth' : 'pull',
                    radius: sculptSettings.radius,
                    strength: sculptSettings.strength,
                  }}
                  onSculptSettingChange={updateFreeformSculptSetting}
                  onExtrude={() => extrudeSelectedFace(1)}
                  onInset={insetExtrudeSelectedFace}
                  onDeleteFace={deleteSelectedFaceStub}
                  onFlipFace={flipSelectedFaceStub}
                  onStub={showToast}
                />
                <ViewAssistPanel
                  settings={viewAssist}
                  onChange={(key, value) => setViewAssist((settings) => ({ ...settings, [key]: value }))}
                  onStub={showToast}
                />
                <details className="accordion-panel" open>
                  <summary>物件屬性</summary>
                  <ObjectPropertiesPanel
                    selected={selected}
                    selectedObjects={selectedObjects}
                    primarySelected={primarySelected}
                    onUpdate={updateSelected}
                    onSetMode={setSelectedMode}
                    onToggleVisibility={toggleObjectVisibility}
                    onToggleLock={toggleObjectLock}
                    onDelete={deleteSelectedWithConfirm}
                  />
                </details>

                {selected && (
                  <details className="accordion-panel" open>
                    <summary>變形與尺寸</summary>
                    <TransformPanel
                      selected={selected}
                      transformSpace={transformSpace}
                      onTransformSpaceChange={setTransformSpace}
                      onUpdate={updateSelected}
                      onApplyTransform={applySelectedTransform}
                      onDropToPlate={dropSelectedToPlate}
                      onCenterOnPlate={centerSelectedOnPlate}
                    />
                    {selected.shapeType === 'cube' && <BevelFields selected={selected} onChange={updateSelected} />}
                    {selected.shapeType === 'text' && <TextFields selected={selected} onChange={updateSelected} />}
                  </details>
                )}

                <details className="accordion-panel" open>
                  <summary>常用建模工具</summary>
                  <ObjectToolsPanel
                    mode={mode}
                    setMode={setMode}
                    multiSelect={multiSelect}
                    setMultiSelect={setMultiSelect}
                    selectedCount={selectedIds.length}
                    selectedObjects={selectedObjects}
                    primarySelected={primarySelected}
                    duplicateSelected={duplicateSelected}
                    deleteSelected={deleteSelectedWithConfirm}
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
                    createBooleanTest={createBooleanTest}
                    measureActive={measureActive}
                    setMeasureActive={setMeasureActive}
                    measurePoints={measurePoints}
                    clearMeasure={() => {
                      setMeasurePoints([]);
                      clearMeasureHelper();
                    }}
                  />
                  {booleanMessage && <div className="notice">{booleanMessage}</div>}
                </details>
              </div>
            )}

            {rightPanelTab === 'check' && (
              <BasicPrintCheckPanel check={basicPrintCheck} selectedCheck={selectedCheck} stats={printStats} />
            )}

            {rightPanelTab === 'repair' && (
              expertMode ? (
                <PrintPrepPanel
                  settings={printPrepSettings}
                  onSettingChange={(key, value) => setPrintPrepSettings((settings) => ({ ...settings, [key]: value }))}
                  onSubdivide={subdivideSelectedModel}
                  onSmooth={smoothSelectedModel}
                  onRecalculate={recalculateSelectedNormals}
                  onRemesh={remeshSelectedModel}
                  onPlace={placeSelectedOnBed}
                  onCenter={centerSelectedOnBed}
                  onApplyTransform={applySelectedTransform}
                  onCheck={checkSelectedMesh}
                  planeCutSettings={planeCutSettings}
                  onPlaneCutSettingChange={(key, value) => setPlaneCutSettings((settings) => ({ ...settings, [key]: value }))}
                  onPlaneCut={applyPlaneCut}
                  repairSettings={meshRepairSettings}
                  onRepairSettingChange={(key, value) => setMeshRepairSettings((settings) => ({ ...settings, [key]: value }))}
                  onFindHoles={findSelectedHoles}
                  onFillHoles={fillSelectedHoles}
                  onMergeCloseVertices={mergeSelectedCloseVertices}
                  onRemoveDegenerateFaces={removeSelectedDegenerateFaces}
                  onRemoveLooseFaces={removeSelectedLooseFaces}
                  onAutoRepair={autoRepairSelectedMesh}
                  repairResult={meshRepairResult}
                  results={meshCheckResults}
                  disabled={!primarySelected}
                />
              ) : (
                <section className="printer-card">
                  <div className="card-title">修復工具</div>
                  <div className="notice">修復、雕刻、重新整理網格與表面方向工具屬於進階功能。請切換到「進階模式」後使用。</div>
                </section>
              )
            )}
          </RightPanelTabs>

          <div className={`legacy-workflow-panels ${activeWorkflow === 'model' ? 'hidden' : ''}`}>
          {activeWorkflow === 'model' && (
            <div className="property-stack">
              <details className="accordion-panel" open>
                <summary>物件屬性</summary>
                <ObjectPropertiesPanel
                  selected={selected}
                  selectedObjects={selectedObjects}
                  primarySelected={primarySelected}
                  onUpdate={updateSelected}
                  onSetMode={setSelectedMode}
                  onToggleVisibility={toggleObjectVisibility}
                  onToggleLock={toggleObjectLock}
                  onDelete={deleteSelectedWithConfirm}
                />
              </details>

              {selected && (
                <>
                  <details className="accordion-panel" open>
                    <summary>變形</summary>
                    <TransformPanel
                      selected={selected}
                      transformSpace={transformSpace}
                      onTransformSpaceChange={setTransformSpace}
                      onUpdate={updateSelected}
                      onApplyTransform={applySelectedTransform}
                      onDropToPlate={dropSelectedToPlate}
                      onCenterOnPlate={centerSelectedOnPlate}
                    />
                    {selected.shapeType === 'cube' && <BevelFields selected={selected} onChange={updateSelected} />}
                    {selected.shapeType === 'text' && <TextFields selected={selected} onChange={updateSelected} />}
                  </details>

                  <details className="accordion-panel">
                    <summary>物件工具</summary>
                    <ObjectToolsPanel
                      mode={mode}
                      setMode={setMode}
                      multiSelect={multiSelect}
                      setMultiSelect={setMultiSelect}
                      selectedCount={selectedIds.length}
                      selectedObjects={selectedObjects}
                      primarySelected={primarySelected}
                      duplicateSelected={duplicateSelected}
                      deleteSelected={deleteSelectedWithConfirm}
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
                      createBooleanTest={createBooleanTest}
                      measureActive={measureActive}
                      setMeasureActive={setMeasureActive}
                      measurePoints={measurePoints}
                      clearMeasure={() => {
                        setMeasurePoints([]);
                        clearMeasureHelper();
                      }}
                    />
                    {booleanMessage && <div className="notice">{booleanMessage}</div>}
                  </details>

                  <details className="accordion-panel">
                    <summary>列印檢查</summary>
                    <PrintCheckPanel check={selectedCheck} stats={printStats} />
                  </details>
                </>
              )}
            </div>
          )}

          {activeWorkflow === 'face' && (
            <FaceEditPanel
              faceSelection={faceSelection}
              settings={faceSettings}
              onSettingChange={(key, value) => setFaceSettings((settings) => ({ ...settings, [key]: value }))}
              onPull={() => moveSelectedFace(1)}
              onPush={() => moveSelectedFace(-1)}
              onExtrude={() => extrudeSelectedFace(1)}
              onReverseExtrude={() => extrudeSelectedFace(-1)}
              onInsetExtrude={insetExtrudeSelectedFace}
              onSmooth={smoothSelectedFace}
            />
          )}

          {activeWorkflow === 'sculpt' && (
            <SculptPanel
              settings={sculptSettings}
              onSettingChange={(key, value) => setSculptSettings((settings) => ({ ...settings, [key]: value }))}
              hasSelection={!!primarySelected}
            />
          )}

          {activeWorkflow === 'prep' && (
            <PrintPrepPanel
              settings={printPrepSettings}
              onSettingChange={(key, value) => setPrintPrepSettings((settings) => ({ ...settings, [key]: value }))}
              onSubdivide={subdivideSelectedModel}
              onSmooth={smoothSelectedModel}
              onRecalculate={recalculateSelectedNormals}
              onRemesh={remeshSelectedModel}
              onPlace={placeSelectedOnBed}
              onCenter={centerSelectedOnBed}
              onApplyTransform={applySelectedTransform}
              onCheck={checkSelectedMesh}
              planeCutSettings={planeCutSettings}
              onPlaneCutSettingChange={(key, value) => setPlaneCutSettings((settings) => ({ ...settings, [key]: value }))}
              onPlaneCut={applyPlaneCut}
              repairSettings={meshRepairSettings}
              onRepairSettingChange={(key, value) => setMeshRepairSettings((settings) => ({ ...settings, [key]: value }))}
              onFindHoles={findSelectedHoles}
              onFillHoles={fillSelectedHoles}
              onMergeCloseVertices={mergeSelectedCloseVertices}
              onRemoveDegenerateFaces={removeSelectedDegenerateFaces}
              onRemoveLooseFaces={removeSelectedLooseFaces}
              onAutoRepair={autoRepairSelectedMesh}
              repairResult={meshRepairResult}
              results={meshCheckResults}
              disabled={!primarySelected}
            />
          )}

          {activeWorkflow === 'export' && (
            <ExportPanel
              onCheck={checkSelectedMesh}
              onPrepareExport={prepareExport}
              onOpenExample={createExampleScene}
              onExportStl={() => exportModel('stl')}
              onExportObj={() => exportModel('obj')}
              onSave={saveProject}
              onLoad={() => fileInputRef.current?.click()}
              hasObjects={objects.length > 0}
              checkResults={meshCheckResults}
            />
          )}
          </div>
        </section>
      </RightPanel>
      <StatusBar
        workflow={activeWorkflow}
        editMode={editMode}
        mode={mode}
        selectedCount={selectedIds.length}
        lockedAxis={lockedAxis}
        operationStyle={prefs.operationStyle}
        brushMode={sculptSettings.brushMode}
        boxSelectActive={boxSelectActive}
        operationStatus={operationStatus}
        transformSpace={transformSpace}
        appInfo={APP_INFO}
        version={APP_VERSION}
      />
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          hasSelection={selectedIds.length > 0}
          hasClipboard={!!clipboardObject}
          onClose={closeContextMenu}
          onDuplicate={() => { duplicateSelected(); closeContextMenu(); }}
          onCopy={() => { copySelectedToClipboard(); closeContextMenu(); }}
          onPaste={() => { pasteClipboardObject(); closeContextMenu(); }}
          onDelete={() => { deleteSelectedWithConfirm(); closeContextMenu(); }}
          onSolid={() => { setSelectedMode('solid'); closeContextMenu(); }}
          onHole={() => { setSelectedMode('hole'); closeContextMenu(); }}
          onPlace={() => { placeSelectedOnBed(); closeContextMenu(); }}
          onCenter={() => { centerSelectedOnBed(); closeContextMenu(); }}
          onApply={() => { applySelectedTransform(); closeContextMenu(); }}
          onFocus={() => { focusSelectedObject(); closeContextMenu(); }}
          onAddShape={(type) => { addShape(type); closeContextMenu(); }}
        />
      )}
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
          <input type="number" step={step} value={data?.[axis] ?? 0} onChange={(event) => onChange(axis, event.target.value)} />
        </label>
      ))}
    </fieldset>
  );
}

function QuickStartCard({ onAddCube, onAddSphere, onOpenExample, onLoadProject }) {
  return (
    <div className="quick-start-card">
      <div>
        <span className="quick-start-kicker">快速開始</span>
        <h2>開始建立你的 3D 模型</h2>
      </div>
      <ol>
        <li>從左側新增方塊、球體或圓柱</li>
        <li>使用 G / R / S 移動、旋轉、縮放</li>
        <li>切到「編輯形狀」推拉表面</li>
        <li>切到「雕刻模型」用筆刷變形</li>
        <li>用「列印修復」檢查模型</li>
        <li>從「匯出檔案」匯出 STL</li>
      </ol>
      <div className="quick-start-actions">
        <button className="primary-action" onClick={onAddCube}>新增方塊</button>
        <button onClick={onAddSphere}>新增球體</button>
        <button onClick={onOpenExample}>開啟範例場景</button>
        <button onClick={onLoadProject}>載入專案 JSON</button>
      </div>
    </div>
  );
}

function ObjectPropertiesPanel({ selected, selectedObjects, primarySelected, onUpdate, onSetMode, onToggleVisibility, onToggleLock, onDelete }) {
  const selectedCount = selectedObjects.length;
  if (!selectedCount) {
    return <div className="empty-state compact"><Move3D size={28} /><p>請選取一個物件以編輯屬性</p></div>;
  }

  if (selectedCount > 1) {
    return (
      <section className="printer-card object-properties-card">
        <div className="card-title">已選取 {selectedCount} 個物件</div>
        <div className="notice">多選時只顯示可批量操作的工具。</div>
        <div className="prep-grid">
          <button onClick={() => onSetMode('solid')}>設為實體</button>
          <button onClick={() => onSetMode('hole')}>設為挖洞</button>
          <button onClick={() => selectedObjects.forEach((object) => { if (object.visible) onToggleVisibility(object); })}>隱藏</button>
          <button onClick={() => selectedObjects.forEach((object) => { if (!object.userData.locked) onToggleLock(object); })}>鎖定</button>
          <button className="danger" onClick={onDelete}>刪除</button>
        </div>
      </section>
    );
  }

  const typeLabel = SHAPES[selected.shapeType]?.label || (selected.shapeType === 'boolean' ? '布林結果' : selected.shapeType === 'group' ? '群組' : '自訂模型');
  return (
    <section className="printer-card object-properties-card">
      <label className="field"><span>名稱</span><input value={primarySelected?.name || selected.name} onChange={(event) => onUpdate('name', null, event.target.value)} /></label>
      <div className="info-grid">
        <span>類型</span><strong>{typeLabel}</strong>
        <span>狀態</span><strong>{primarySelected?.visible === false ? '隱藏' : '可見'} / {primarySelected?.userData.locked ? '鎖定' : '解鎖'}</strong>
      </div>
      <div className="row-fields">
        <label className="field">
          <span>模式</span>
          <select value={primarySelected?.userData.mode || 'solid'} onChange={(event) => onUpdate('mode', null, event.target.value)}>
            <option value="solid">實體</option>
            <option value="hole">挖洞</option>
          </select>
        </label>
        <label className="field"><span>顏色</span><input type="color" value={primarySelected?.userData.color || '#38bdf8'} onChange={(event) => onUpdate('color', null, event.target.value)} /></label>
      </div>
      <div className="prep-grid">
        <button onClick={() => onToggleVisibility(primarySelected)}>{primarySelected?.visible === false ? '顯示' : '隱藏'}</button>
        <button onClick={() => onToggleLock(primarySelected)}>{primarySelected?.userData.locked ? '解鎖' : '鎖定'}</button>
      </div>
    </section>
  );
}

function TransformPanel({ selected, transformSpace, onTransformSpaceChange, onUpdate, onApplyTransform, onDropToPlate, onCenterOnPlate }) {
  return (
    <section className="printer-card transform-card">
      <div className="tool-subgroup compact-tool">
        <h4>座標空間</h4>
        <div className="segmented text-segmented">
          <button className={transformSpace === 'world' ? 'active' : ''} onClick={() => onTransformSpaceChange('world')}>世界座標</button>
          <button className={transformSpace === 'local' ? 'active' : ''} onClick={() => onTransformSpaceChange('local')}>本地座標</button>
        </div>
      </div>
      <TransformFields title="位置 Position" unit="mm" data={selected.position} onChange={(axis, value) => onUpdate('position', axis, value)} />
      <TransformFields title="旋轉 Rotation" unit="deg" data={selected.rotation} onChange={(axis, value) => onUpdate('rotation', axis, value)} step="15" />
      <TransformFields title="尺寸 Size" unit="mm" data={selected.dimensions} onChange={(axis, value) => onUpdate('dimensions', axis, value)} step="1" labels={{ x: '寬 X', y: '深 Y', z: '高 Z' }} />
      <TransformFields title="縮放 Scale" data={selected.scale} onChange={(axis, value) => onUpdate('scale', axis, value)} step="0.05" />
      <div className="prep-grid">
        <button onClick={onApplyTransform}>套用變形</button>
        <button onClick={onDropToPlate}>貼齊平台</button>
        <button onClick={onCenterOnPlate}>置中到平台</button>
      </div>
    </section>
  );
}

function ToolGroup({ title, hint, children }) {
  return (
    <section className="tool-subgroup">
      <h4>{title}</h4>
      {hint && <p>{hint}</p>}
      {children}
    </section>
  );
}

function ObjectToolsPanel({
  mode,
  setMode,
  multiSelect,
  setMultiSelect,
  selectedCount,
  selectedObjects,
  primarySelected,
  duplicateSelected,
  deleteSelected,
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
  createBooleanTest,
  measureActive,
  setMeasureActive,
  measurePoints,
  clearMeasure,
}) {
  const distance = measurePoints.length === 2 ? measurePoints[0].distanceTo(measurePoints[1]) : null;
  const booleanSelectedObjects = selectedObjects.filter((object) => object.userData.printObject && object.visible !== false && !object.userData.locked);
  const solidCount = booleanSelectedObjects.filter((object) => object.userData.mode !== 'hole').length;
  const holeCount = booleanSelectedObjects.filter((object) => object.userData.mode === 'hole').length;
  const canGroup = booleanSelectedObjects.length >= 2;
  const canMerge = solidCount >= 2;
  const canBoolean = solidCount >= 1 && holeCount >= 1;
  const canUngroup = !!primarySelected?.isGroup;

  return (
    <section className="printer-card object-tools-card">
      <div className="card-title">物件工具</div>
      <div className="segmented">
        {MODE_BUTTONS.map((item) => {
          const Icon = item.icon;
          return <button key={item.mode} className={mode === item.mode ? 'active' : ''} onClick={() => setMode(item.mode)} title={item.label}><Icon size={18} /></button>;
        })}
      </div>

      <ToolGroup title="基本操作">
        <div className="prep-grid">
          <button onClick={() => setMultiSelect((value) => !value)} className={multiSelect ? 'active' : ''}>多選</button>
          <button onClick={duplicateSelected} disabled={!selectedCount} title={!selectedCount ? '請先選取物件' : '複製選取物件'}><Copy size={14} /> 複製</button>
          <button className="danger" onClick={deleteSelected} disabled={!selectedCount} title={!selectedCount ? '請先選取物件' : '刪除選取物件'}>刪除</button>
          <button onClick={groupSelected} disabled={!canGroup} title={canGroup ? '將選取物件建立成群組' : '請至少選取 2 個物件才能群組'}>群組</button>
          <button onClick={ungroupSelected} disabled={!canUngroup} title={canUngroup ? '取消目前群組' : '請選取群組'}>取消群組</button>
        </div>
      </ToolGroup>

      <ToolGroup title="布林 / 合併" hint="合併會將多個實體物件合成一個模型；套用打洞會使用挖洞物件切掉實體物件重疊區域。">
        <div className="prep-grid">
          <button onClick={mergeSelected} disabled={!canMerge} title={canMerge ? '合併選取的實體物件' : '請至少選取 2 個實體物件才能合併'}>合併</button>
          <button className="primary-action" onClick={applyHole} disabled={!canBoolean} title={canBoolean ? '使用挖洞物件切割實體' : '請選取至少 1 個實體與 1 個挖洞物件'}>套用打洞</button>
          <button onClick={() => setSelectedMode('solid')} disabled={!selectedCount}>設為實體</button>
          <button onClick={() => setSelectedMode('hole')} disabled={!selectedCount}>設為挖洞</button>
          {import.meta.env.DEV && <button onClick={createBooleanTest}>建立打洞測試</button>}
        </div>
      </ToolGroup>

      <ToolGroup title="排列">
        <div className="mini-grid">
          <button onClick={() => mirrorSelected('x')} disabled={!selectedCount}>X 鏡像</button>
          <button onClick={() => mirrorSelected('y')} disabled={!selectedCount}>Y 鏡像</button>
          <button onClick={() => mirrorSelected('z')} disabled={!selectedCount}>Z 鏡像</button>
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
        <button className="wide-action" onClick={arrayDuplicate} disabled={!selectedCount}>陣列複製</button>
      </ToolGroup>

      <ToolGroup title="測量" hint="開啟後在模型表面點兩個點，即可量測直線距離。">
        <div className="prep-grid">
          <button onClick={() => setMeasureActive((value) => !value)} className={measureActive ? 'active' : ''}>開啟測量</button>
          <button onClick={clearMeasure}>清除測量</button>
        </div>
        {measurePoints.length > 0 && (
          <div className="dimension-readout">
            <span>A：{measurePoints[0] ? `${roundNumber(measurePoints[0].x)} / ${roundNumber(measurePoints[0].y)} / ${roundNumber(measurePoints[0].z)} mm` : '-'}</span>
            <span>B：{measurePoints[1] ? `${roundNumber(measurePoints[1].x)} / ${roundNumber(measurePoints[1].y)} / ${roundNumber(measurePoints[1].z)} mm` : '-'}</span>
            <span>距離：{distance == null ? '-' : `${roundNumber(distance)} mm`}</span>
          </div>
        )}
      </ToolGroup>
    </section>
  );
}

function ExportPanel({ onCheck, onPrepareExport, onOpenExample, onExportStl, onExportObj, onSave, onLoad, hasObjects, checkResults }) {
  const hasIssue = checkResults?.some((item) => item.status !== 'ok');
  return (
    <div className="property-stack">
      <details className="accordion-panel" open>
        <summary>匯出檔案</summary>
        <section className="printer-card export-card">
          <div className="export-steps">
            <strong>建議順序</strong>
            <ol>
              <li>套用變形</li>
              <li>貼齊平台</li>
              <li>檢查模型</li>
              <li>匯出 STL</li>
            </ol>
          </div>
          {hasIssue && <div className="notice warning-note">目前檢查結果有警告或錯誤，建議先到列印修復處理。</div>}
          <div className="notice">一鍵準備匯出會依序套用變形、貼齊平台、置中到平台、重新計算法線並檢查模型。</div>
          <div className="prep-grid">
            <button className="primary-action" onClick={onPrepareExport} disabled={!hasObjects}>一鍵準備匯出</button>
            <button onClick={onCheck} disabled={!hasObjects}>檢查模型</button>
            <button className="primary-action" onClick={onExportStl} disabled={!hasObjects}><Download size={14} /> 匯出 STL</button>
            <button onClick={onExportObj} disabled={!hasObjects}><Download size={14} /> 匯出 OBJ</button>
            <button onClick={onOpenExample}>開啟範例</button>
            <button onClick={onSave}>儲存專案 JSON</button>
            <button onClick={onLoad}>載入專案 JSON</button>
          </div>
        </section>
      </details>
    </div>
  );
}

function PrintPrepPanel({
  settings,
  onSettingChange,
  onSubdivide,
  onSmooth,
  onRecalculate,
  onRemesh,
  onPlace,
  onCenter,
  onApplyTransform,
  onCheck,
  planeCutSettings,
  onPlaneCutSettingChange,
  onPlaneCut,
  repairSettings,
  onRepairSettingChange,
  onFindHoles,
  onFillHoles,
  onMergeCloseVertices,
  onRemoveDegenerateFaces,
  onRemoveLooseFaces,
  onAutoRepair,
  repairResult,
  results,
  disabled,
}) {
  return (
    <div className="property-stack">
      <details className="accordion-panel">
        <summary>列印準備</summary>
        <section className="printer-card print-prep-card">
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
          <div className="notice">Remesh 簡化版：讓網格更平均，適合雕刻前整理。</div>
          <div className="row-fields">
            <label className="field"><span>目標邊長 mm</span><input type="number" min="0.5" step="0.5" value={settings.remeshEdgeLength} onChange={(event) => onSettingChange('remeshEdgeLength', event.target.value)} /></label>
            <label className="mini-check toggle-line">
              <input type="checkbox" checked={settings.remeshKeepVolume} onChange={(event) => onSettingChange('remeshKeepVolume', event.target.checked)} />
              <span>保持體積</span>
            </label>
          </div>
          <div className="prep-grid">
            <button onClick={onSubdivide} disabled={disabled}>套用細分</button>
            <button onClick={onSmooth} disabled={disabled}>平滑模型</button>
            <button onClick={onRemesh} disabled={disabled}>重建網格</button>
            <button onClick={onRecalculate} disabled={disabled}>重新計算法線</button>
            <button onClick={onPlace} disabled={disabled}>貼齊平台</button>
            <button onClick={onCenter} disabled={disabled}>置中到平台</button>
            <button onClick={onApplyTransform} disabled={disabled}>套用變形</button>
          </div>
        </section>
      </details>

      <details className="accordion-panel" open>
        <summary>網格修復</summary>
        <section className="printer-card">
          <label className="field">
            <span>合併容差 mm</span>
            <input type="number" min="0.0001" step="0.001" value={repairSettings.tolerance} onChange={(event) => onRepairSettingChange('tolerance', event.target.value)} />
          </label>
          <div className="prep-grid">
            <button onClick={onFindHoles} disabled={disabled}>尋找破洞</button>
            <button onClick={onFillHoles} disabled={disabled}>補洞</button>
            <button onClick={onMergeCloseVertices} disabled={disabled}>合併接近頂點</button>
            <button onClick={onRemoveDegenerateFaces} disabled={disabled}>移除退化面</button>
            <button onClick={onRemoveLooseFaces} disabled={disabled}>移除孤立面</button>
            <button onClick={onRecalculate} disabled={disabled}>重新計算法線</button>
            <button className="primary-action" onClick={onAutoRepair} disabled={disabled}>自動修復</button>
          </div>
          {repairResult && (
            <div className="mesh-repair-results">
              <div className={'mesh-check-item ' + (repairResult.holeCount ? 'warning' : 'ok')}><strong>破洞數量</strong><p>{repairResult.holeCount}</p></div>
              <div className={'mesh-check-item ' + (repairResult.boundaryEdgeCount ? 'warning' : 'ok')}><strong>邊界邊</strong><p>{repairResult.boundaryEdgeCount}</p></div>
              <div className={'mesh-check-item ' + (repairResult.degenerateFaceCount ? 'warning' : 'ok')}><strong>退化面</strong><p>{repairResult.degenerateFaceCount}</p></div>
              <div className={'mesh-check-item ' + (repairResult.looseIslandCount ? 'warning' : 'ok')}><strong>孤立面群</strong><p>{repairResult.looseIslandCount}</p></div>
              {repairResult.lastMessage && <div className="notice">{repairResult.lastMessage}</div>}
              {!!repairResult.holeDetails?.length && (
                <div className="dimension-readout">
                  {repairResult.holeDetails.map((hole) => (
                    <span key={hole.index}>破洞 #{hole.index}：{hole.edgeCount} 條邊 {hole.simple ? '' : '（複雜）'}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </details>

      <details className="accordion-panel" open>
        <summary>模型檢查</summary>
        <section className="printer-card">
          <div className="nested-tool">
            <div className="card-title">平面裁切</div>
            <div className="row-fields">
              <label className="field"><span>裁切軸</span><select value={planeCutSettings.axis} onChange={(event) => onPlaneCutSettingChange('axis', event.target.value)}><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
              <label className="field"><span>位置 mm</span><input type="number" step="1" value={planeCutSettings.position} onChange={(event) => onPlaneCutSettingChange('position', event.target.value)} /></label>
            </div>
            <label className="field"><span>保留方向</span><select value={planeCutSettings.keep} onChange={(event) => onPlaneCutSettingChange('keep', event.target.value)}><option value="positive">正向</option><option value="negative">負向</option></select></label>
            <button className="wide-action" onClick={onPlaneCut} disabled={disabled}>套用裁切</button>
          </div>
          <button className="wide-action primary-action" onClick={onCheck} disabled={disabled}>檢查模型</button>
          {results && (
            <div className="mesh-check-list">
              {results.map((item) => (
                <div key={item.label} className={'mesh-check-item ' + item.status}>
                  <strong>{item.status === 'ok' ? '正常' : item.status === 'warning' ? '警告' : '錯誤'}</strong>
                  <p>{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </details>
    </div>
  );
}

function FaceEditPanel({ faceSelection, settings, onSettingChange, onPull, onPush, onExtrude, onReverseExtrude, onInsetExtrude, onSmooth }) {
  return (
    <div className="property-stack">
      <details className="accordion-panel" open>
        <summary>面編輯</summary>
        <section className="printer-card face-edit-card">
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
        </section>
      </details>

      <details className="accordion-panel" open>
        <summary>擠出工具</summary>
        <section className="printer-card">
          <div className="notice">選取一個面後，沿法線方向產生新的凸起或凹陷。</div>
          <label className="field"><span>擠出距離 mm</span><input type="number" step="1" min="0.1" value={settings.extrudeDistance} onChange={(event) => onSettingChange('extrudeDistance', event.target.value)} /></label>
          <div className="action-grid">
            <button className="primary-action" onClick={onExtrude} disabled={!faceSelection}>擠出</button>
            <button onClick={onReverseExtrude} disabled={!faceSelection}>反向擠出</button>
          </div>
          <button className="wide-action" onClick={onInsetExtrude} disabled title="第一版先支援 triangle extrude">內縮擠出</button>
        </section>
      </details>

      <details className="accordion-panel">
        <summary>局部變形</summary>
        <section className="printer-card">
          <label className="field"><span>拉起距離 mm</span><input type="number" step="1" min="0.1" value={settings.distance} onChange={(event) => onSettingChange('distance', event.target.value)} /></label>
          <label className="field"><span>影響範圍 mm</span><input type="number" step="1" min="0.5" value={settings.radius} onChange={(event) => onSettingChange('radius', event.target.value)} /></label>
          <label className="mini-check toggle-line">
            <input type="checkbox" checked={settings.softEdit} onChange={(event) => onSettingChange('softEdit', event.target.checked)} />
            <span>軟編輯：{settings.softEdit ? '開' : '關'}</span>
          </label>
          <label className="field"><span>平滑強度</span><input type="number" step="0.1" min="0" max="1" value={settings.smoothStrength} onChange={(event) => onSettingChange('smoothStrength', event.target.value)} /></label>
          <div className="action-grid">
            <button onClick={onPull} disabled={!faceSelection}>局部拉起</button>
            <button onClick={onPush} disabled={!faceSelection}>局部壓下</button>
          </div>
          <button className="wide-action" onClick={onSmooth} disabled={!faceSelection}>平滑選取區域</button>
        </section>
      </details>
    </div>
  );
}

function SculptPanel({ settings, onSettingChange, hasSelection }) {
  const brushLabels = {
    raise: '推起',
    lower: '壓下',
    smooth: '平滑',
    inflate: '膨脹',
    flatten: '壓平',
  };
  return (
    <div className="property-stack">
      <details className="accordion-panel" open>
        <summary>雕刻筆刷</summary>
        <section className="printer-card sculpt-card">
          {!hasSelection && <div className="notice warning-note">請先選取要雕刻的物件。</div>}
          <label className="field">
            <span>筆刷</span>
            <select value={settings.brushMode} onChange={(event) => onSettingChange('brushMode', event.target.value)}>
              {Object.entries(brushLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="row-fields">
            <label className="field"><span>半徑 mm</span><input type="number" step="1" min="1" value={settings.radius} onChange={(event) => onSettingChange('radius', event.target.value)} /></label>
            <label className="field"><span>強度</span><input type="number" step="0.05" min="0" max="1" value={settings.strength} onChange={(event) => onSettingChange('strength', event.target.value)} /></label>
          </div>
          <label className="field">
            <span>筆刷衰減</span>
            <select value={settings.falloff} onChange={(event) => onSettingChange('falloff', event.target.value)}>
              <option value="smooth">平滑</option>
              <option value="linear">線性</option>
            </select>
          </label>
        </section>
      </details>

      <details className="accordion-panel">
        <summary>對稱設定</summary>
        <section className="printer-card">
          <div className="row-fields">
            {axes.map((axis) => (
              <label key={axis} className="mini-check toggle-line">
                <input type="checkbox" checked={settings[`symmetry${axis.toUpperCase()}`]} onChange={(event) => onSettingChange(`symmetry${axis.toUpperCase()}`, event.target.checked)} />
                <span>{axis.toUpperCase()} 對稱</span>
              </label>
            ))}
          </div>
        </section>
      </details>

      <details className="accordion-panel">
        <summary>筆刷提示</summary>
        <section className="printer-card">
          <div className="notice">按住滑鼠左鍵在模型表面拖曳即可變形。</div>
          <div className="notice">熱鍵：[ / ] 調整半徑，- / = 調整強度。</div>
        </section>
      </details>
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
  const settings = selected.textSettings || { text: '文字', size: 18, depth: 4, align: 'center' };
  return (
    <section className="printer-card">
      <div className="card-title">文字設定</div>
      <label className="field"><span>文字內容</span><input value={settings.text} onChange={(event) => onChange('textSettings', 'text', event.target.value)} /></label>
      <div className="row-fields">
        <label className="field"><span>字體大小 mm</span><input type="number" value={settings.size} onChange={(event) => onChange('textSettings', 'size', event.target.value)} /></label>
        <label className="field"><span>厚度 mm</span><input type="number" value={settings.depth} onChange={(event) => onChange('textSettings', 'depth', event.target.value)} /></label>
      </div>
      <label className="field"><span>對齊方式</span><select value={settings.align} onChange={(event) => onChange('textSettings', 'align', event.target.value)}><option value="left">靠左</option><option value="center">置中</option><option value="right">靠右</option></select></label>
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

function BasicPrintCheckPanel({ check, selectedCheck, stats }) {
  return (
    <div className="property-stack">
      <section className="printer-card">
        <div className="card-title">列印檢查</div>
        <StatusRow label="是否有選取物件" ok={check.hasSelection} badText="尚未選取物件" goodText="已有選取物件" />
        <StatusRow label="是否超出平台" ok={!check.outside} badText="選取物件超出平台" goodText="未超出平台" />
        <StatusRow label="是否懸空" ok={!check.floating} badText="選取物件可能懸空" goodText="未偵測到懸空" />
        <div className="dimension-readout">
          <span>物件數量：{check.objectCount}</span>
          <span>平台尺寸：{check.printerSize.x} × {check.printerSize.y} × {check.printerSize.z} mm</span>
        </div>
      </section>
      {selectedCheck ? (
        <PrintCheckPanel check={selectedCheck} stats={stats} />
      ) : (
        <section className="printer-card">
          <div className="empty-state compact"><Move3D size={28} /><p>請選擇一個物件以查看尺寸與列印狀態。</p></div>
        </section>
      )}
    </div>
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
          <span>物件數 {stats.objectCount} / 實體 {stats.solidCount} / 挖洞 {stats.holeCount}</span>
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

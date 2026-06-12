import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

const evaluator = new Evaluator();

function makeBrush(geometry) {
  const brush = new Brush(geometry);
  brush.position.set(0, 0, 0);
  brush.rotation.set(0, 0, 0);
  brush.scale.set(1, 1, 1);
  brush.updateMatrixWorld(true);
  return brush;
}

function getGeometryBox(geometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox?.clone() || new THREE.Box3();
}

export function getSelectedBooleanParts(sceneObjects, selectedIds) {
  const selectedSet = new Set(selectedIds);
  const selected = sceneObjects.filter((object) => (
    selectedSet.has(object.uuid)
    && object.userData.printObject
    && object.visible !== false
    && !object.userData.locked
  ));
  const solids = selected.filter((object) => object.userData.mode !== 'hole');
  const holes = selected.filter((object) => object.userData.mode === 'hole');
  return { selected, solids, holes };
}

export function cleanGeometryForCSG(sourceGeometry) {
  if (!sourceGeometry?.attributes?.position) return null;
  let geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
  Object.keys(geometry.attributes).forEach((name) => {
    if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
  });
  geometry.computeVertexNormals();

  // three-bvh-csg expects both brushes to have the same attribute schema.
  if (!geometry.attributes.uv) {
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function objectToWorldGeometry(object) {
  if (!object) return null;
  object.updateMatrixWorld(true);
  const geometries = [];

  object.traverse((child) => {
    if (!child.isMesh || child.userData.helper || child.visible === false || !child.geometry?.attributes?.position) return;
    child.updateMatrixWorld(true);
    const transformed = child.geometry.clone();
    transformed.applyMatrix4(child.matrixWorld);
    const geometry = cleanGeometryForCSG(transformed);
    transformed.dispose?.();
    if (geometry) geometries.push(geometry);
  });

  if (!geometries.length) return null;

  const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
  geometries.forEach((item) => {
    if (item !== geometry) item.dispose?.();
  });
  if (!geometry) return null;

  geometry.computeVertexNormals();
  if (!geometry.attributes.uv) {
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function validateBooleanInput(selectedObjects) {
  const solids = selectedObjects.filter((object) => object.userData.mode !== 'hole');
  const holes = selectedObjects.filter((object) => object.userData.mode === 'hole');

  if (!solids.length) {
    return { ok: false, solids, holes, message: '請選取 1 個 Solid 物件作為打洞目標' };
  }
  if (!holes.length) {
    return { ok: false, solids, holes, message: '請選取至少 1 個 Hole 物件作為切割工具' };
  }
  return { ok: true, solids, holes, message: '' };
}

export function runBooleanDifference(targetObject, holeObjects) {
  const targetGeometry = objectToWorldGeometry(targetObject);
  if (!targetGeometry) throw new Error('找不到 Solid 可用幾何資料');

  const targetBox = getGeometryBox(targetGeometry);
  const overlapping = [];
  const skipped = [];

  holeObjects.forEach((hole) => {
    const geometry = objectToWorldGeometry(hole);
    if (!geometry) {
      skipped.push({ object: hole, reason: '找不到可用幾何資料' });
      return;
    }

    const box = getGeometryBox(geometry);
    if (!targetBox.intersectsBox(box)) {
      skipped.push({ object: hole, reason: '未與 Solid 重疊' });
      geometry.dispose?.();
      return;
    }

    overlapping.push({ object: hole, geometry });
  });

  if (!overlapping.length) {
    targetGeometry.dispose?.();
    return {
      geometry: null,
      skipped,
      usedHoles: [],
      overlapCount: 0,
      message: 'Hole 沒有與 Solid 重疊，無法打洞',
    };
  }

  let resultBrush = makeBrush(targetGeometry);
  overlapping.forEach(({ geometry }) => {
    const cutterBrush = makeBrush(geometry);
    resultBrush = evaluator.evaluate(resultBrush, cutterBrush, SUBTRACTION);
    resultBrush.updateMatrixWorld(true);
    resultBrush.geometry.computeVertexNormals();
    geometry.dispose?.();
  });

  const resultGeometry = cleanGeometryForCSG(resultBrush.geometry);
  if (!resultGeometry) throw new Error('CSG 沒有產生可用幾何資料');
  resultGeometry.computeBoundingBox();
  resultGeometry.computeBoundingSphere();

  return {
    geometry: resultGeometry,
    skipped,
    usedHoles: overlapping.map(({ object }) => object),
    overlapCount: overlapping.length,
    message: skipped.length ? '已略過未重疊的 Hole' : '',
  };
}

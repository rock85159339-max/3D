import * as THREE from 'three';
import {
  clampVertexOffset,
  getMeshPositionAttribute,
  getVertexLocalPosition,
  getVertexNormal,
  updateGeometryAfterVertexEdit,
} from './vertexEditUtils.js';

export function computeFalloffWeight(distance, radius, falloff = 'smooth') {
  const safeRadius = Math.max(1, Number(radius) || 1);
  if (distance <= 0) return 1;
  if (distance >= safeRadius) return 0;
  const t = THREE.MathUtils.clamp(distance / safeRadius, 0, 1);
  if (falloff === 'linear') return 1 - t;
  if (falloff === 'sharp') return Math.pow(1 - t, 2);
  return 1 - (t * t * (3 - 2 * t));
}

export function getSoftSelectionWeights(mesh, centerVertexIndex, radius, falloff = 'smooth') {
  const position = getMeshPositionAttribute(mesh);
  const center = getVertexLocalPosition(mesh, centerVertexIndex);
  if (!position || !center) return [];
  const safeRadius = THREE.MathUtils.clamp(Number(radius) || 20, 1, 200);
  const weights = [];
  for (let index = 0; index < position.count; index += 1) {
    const vertex = new THREE.Vector3().fromBufferAttribute(position, index);
    const distance = vertex.distanceTo(center);
    const weight = computeFalloffWeight(distance, safeRadius, falloff);
    if (weight > 0) weights.push({ index, weight, distance });
  }
  return weights;
}

export function getAffectedVertexCount(mesh, centerVertexIndex, radius) {
  return getSoftSelectionWeights(mesh, centerVertexIndex, radius, 'linear').length;
}

export function applySoftVertexOffset(mesh, centerVertexIndex, offset, radius, falloff = 'smooth') {
  const position = getMeshPositionAttribute(mesh);
  if (!position) return false;
  const weights = getSoftSelectionWeights(mesh, centerVertexIndex, radius, falloff);
  if (!weights.length) return false;
  const delta = new THREE.Vector3(
    clampVertexOffset(offset?.x, 50),
    clampVertexOffset(offset?.y, 50),
    clampVertexOffset(offset?.z, 50),
  );
  weights.forEach(({ index, weight }) => {
    const vertex = new THREE.Vector3().fromBufferAttribute(position, index);
    vertex.addScaledVector(delta, weight);
    position.setXYZ(index, vertex.x, vertex.y, vertex.z);
  });
  return updateGeometryAfterVertexEdit(mesh);
}

export function applySoftVertexNormalMove(mesh, centerVertexIndex, distance, radius, falloff = 'smooth') {
  const position = getMeshPositionAttribute(mesh);
  const normal = getVertexNormal(mesh, centerVertexIndex);
  if (!position || !normal) return false;
  const weights = getSoftSelectionWeights(mesh, centerVertexIndex, radius, falloff);
  if (!weights.length) return false;
  const amount = clampVertexOffset(distance, 20);
  weights.forEach(({ index, weight }) => {
    const vertex = new THREE.Vector3().fromBufferAttribute(position, index);
    vertex.addScaledVector(normal, amount * weight);
    position.setXYZ(index, vertex.x, vertex.y, vertex.z);
  });
  return updateGeometryAfterVertexEdit(mesh);
}

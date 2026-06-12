import * as THREE from 'three';

export function clampVertexOffset(value, max = 50) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return THREE.MathUtils.clamp(number, -Math.abs(max), Math.abs(max));
}

export function getMeshPositionAttribute(mesh) {
  return mesh?.isMesh && mesh.geometry?.attributes?.position
    ? mesh.geometry.attributes.position
    : null;
}

export function getVertexLocalPosition(mesh, vertexIndex) {
  const position = getMeshPositionAttribute(mesh);
  if (!position || vertexIndex == null || vertexIndex < 0 || vertexIndex >= position.count) return null;
  return new THREE.Vector3().fromBufferAttribute(position, vertexIndex);
}

export function getVertexWorldPosition(mesh, vertexIndex) {
  const local = getVertexLocalPosition(mesh, vertexIndex);
  if (!local) return null;
  mesh.updateWorldMatrix(true, false);
  return local.clone().applyMatrix4(mesh.matrixWorld);
}

export function getVertexNormal(mesh, vertexIndex) {
  if (!mesh?.isMesh || vertexIndex == null) return null;
  const geometry = mesh.geometry;
  const normal = geometry?.attributes?.normal;
  if (!normal) {
    geometry?.computeVertexNormals?.();
  }
  const nextNormal = geometry?.attributes?.normal;
  if (!nextNormal || vertexIndex < 0 || vertexIndex >= nextNormal.count) return null;
  return new THREE.Vector3().fromBufferAttribute(nextNormal, vertexIndex).normalize();
}

export function updateGeometryAfterVertexEdit(mesh) {
  const position = getMeshPositionAttribute(mesh);
  if (!mesh?.geometry || !position) return false;
  position.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  if (mesh.geometry.attributes.normal) mesh.geometry.attributes.normal.needsUpdate = true;
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  return true;
}

export function moveVertexByOffset(mesh, vertexIndex, offset) {
  const position = getMeshPositionAttribute(mesh);
  const current = getVertexLocalPosition(mesh, vertexIndex);
  if (!position || !current) return false;
  const next = current.add(new THREE.Vector3(
    clampVertexOffset(offset?.x, 50),
    clampVertexOffset(offset?.y, 50),
    clampVertexOffset(offset?.z, 50),
  ));
  position.setXYZ(vertexIndex, next.x, next.y, next.z);
  return updateGeometryAfterVertexEdit(mesh);
}

export function moveVertexAlongNormal(mesh, vertexIndex, distance) {
  const normal = getVertexNormal(mesh, vertexIndex);
  const current = getVertexLocalPosition(mesh, vertexIndex);
  const position = getMeshPositionAttribute(mesh);
  if (!normal || !current || !position) return false;
  const amount = clampVertexOffset(distance, 20);
  const next = current.addScaledVector(normal, amount);
  position.setXYZ(vertexIndex, next.x, next.y, next.z);
  return updateGeometryAfterVertexEdit(mesh);
}

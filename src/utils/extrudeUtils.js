import * as THREE from 'three';

function readFaceVertices(geometry, faceIndex) {
  const position = geometry?.attributes?.position;
  if (!position) return null;
  const base = faceIndex * 3;
  return {
    a: new THREE.Vector3().fromBufferAttribute(position, base),
    b: new THREE.Vector3().fromBufferAttribute(position, base + 1),
    c: new THREE.Vector3().fromBufferAttribute(position, base + 2),
  };
}

function pushTriangle(target, a, b, c) {
  target.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
}

function ensureNonIndexedGeometry(geometry) {
  if (!geometry?.attributes?.position) return null;
  return geometry.index ? geometry.toNonIndexed() : geometry.clone();
}

export function validateFaceIndex(geometry, faceIndex) {
  const position = geometry?.attributes?.position;
  if (!position) return { ok: false, message: 'geometry 沒有 position attribute' };
  if (!Number.isInteger(faceIndex) || faceIndex < 0) return { ok: false, message: 'faceIndex 無效' };
  const triangleCount = Math.floor(position.count / 3);
  if (faceIndex >= triangleCount) return { ok: false, message: 'faceIndex 超出範圍' };
  return { ok: true, message: '' };
}

export function extrudeTriangleFaceGeometry(geometry, faceIndex, distance) {
  const source = ensureNonIndexedGeometry(geometry);
  const validation = validateFaceIndex(source, faceIndex);
  if (!validation.ok) {
    source?.dispose?.();
    return { geometry: null, faceIndex: null, message: validation.message };
  }
  if (Math.abs(Number(distance) || 0) < 0.0001) {
    source.dispose?.();
    return { geometry: null, faceIndex: null, message: '擠出距離不能為 0' };
  }

  const { a, b, c } = readFaceVertices(source, faceIndex);
  const normal = new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3()).normalize();
  if (!Number.isFinite(normal.x) || normal.lengthSq() < 0.5) {
    source.dispose?.();
    return { geometry: null, faceIndex: null, message: '選取面法線無效' };
  }

  const offset = normal.multiplyScalar(distance);
  const a2 = a.clone().add(offset);
  const b2 = b.clone().add(offset);
  const c2 = c.clone().add(offset);
  const positions = [];
  const sourcePosition = source.attributes.position;
  const triangleCount = Math.floor(sourcePosition.count / 3);

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    if (triangleIndex === faceIndex) continue;
    const base = triangleIndex * 3;
    pushTriangle(
      positions,
      new THREE.Vector3().fromBufferAttribute(sourcePosition, base),
      new THREE.Vector3().fromBufferAttribute(sourcePosition, base + 1),
      new THREE.Vector3().fromBufferAttribute(sourcePosition, base + 2),
    );
  }

  pushTriangle(positions, a, b, b2);
  pushTriangle(positions, a, b2, a2);
  pushTriangle(positions, b, c, c2);
  pushTriangle(positions, b, c2, b2);
  pushTriangle(positions, c, a, a2);
  pushTriangle(positions, c, a2, c2);
  const newFaceIndex = Math.floor(positions.length / 9);
  pushTriangle(positions, a2, b2, c2);

  const nextGeometry = new THREE.BufferGeometry();
  nextGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  nextGeometry.computeVertexNormals();
  nextGeometry.computeBoundingBox();
  nextGeometry.computeBoundingSphere();
  source.dispose?.();
  return { geometry: nextGeometry, faceIndex: newFaceIndex, message: '' };
}

export function insetTriangleFaceGeometry() {
  return { geometry: null, faceIndex: null, message: '內縮擠出尚未支援' };
}

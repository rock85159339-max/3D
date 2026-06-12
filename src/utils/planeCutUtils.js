import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const EPSILON = 1e-5;

export function createPlaneFromAxisPosition(axis = 'z', position = 0) {
  const normal = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
  return new THREE.Plane(normal, -Number(position || 0));
}

export function validatePlaneCutInput(selectedObjects = []) {
  const printObjects = selectedObjects.filter((object) => object?.userData?.printObject && !object.userData.helper);
  if (!printObjects.length) return { ok: false, message: '請先選取要切割的物件' };
  if (printObjects.length > 1) return { ok: false, message: '請一次切割一個物件' };
  const object = printObjects[0];
  if (object.userData.mode === 'hole') return { ok: false, message: '請選取實體物件進行切割' };
  return { ok: true, object };
}

function makeWorldGeometry(object) {
  const geometries = [];
  object.updateMatrixWorld(true);
  object.traverse((child) => {
    if (!child.isMesh || !child.geometry || child.userData.helper) return;
    child.updateMatrixWorld(true);
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    geometry.deleteAttribute('normal');
    geometry.deleteAttribute('uv');
    geometry.deleteAttribute('color');
    geometry.computeVertexNormals();
    geometries.push(geometry);
  });
  if (!geometries.length) return null;
  const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
  geometries.forEach((geometry) => {
    if (geometry !== merged) geometry.dispose();
  });
  if (!merged) return null;
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function pointDistance(point, plane) {
  return plane.distanceToPoint(point);
}

function intersectEdge(a, b, da, db) {
  const t = da / (da - db);
  return new THREE.Vector3().lerpVectors(a, b, THREE.MathUtils.clamp(t, 0, 1));
}

function clipPolygonByPlane(points, plane, keepPositive) {
  const clipped = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const currentDistance = pointDistance(current, plane);
    const nextDistance = pointDistance(next, plane);
    const currentInside = keepPositive ? currentDistance >= -EPSILON : currentDistance <= EPSILON;
    const nextInside = keepPositive ? nextDistance >= -EPSILON : nextDistance <= EPSILON;

    if (currentInside && nextInside) {
      clipped.push(next.clone());
    } else if (currentInside && !nextInside) {
      clipped.push(intersectEdge(current, next, currentDistance, nextDistance));
    } else if (!currentInside && nextInside) {
      clipped.push(intersectEdge(current, next, currentDistance, nextDistance));
      clipped.push(next.clone());
    }
  }
  return clipped;
}

function pushTriangle(positions, a, b, c, reverse = false) {
  const triangle = reverse ? [a, c, b] : [a, b, c];
  triangle.forEach((point) => positions.push(point.x, point.y, point.z));
}

function pushPolygon(positions, polygon, reverse = false) {
  if (polygon.length < 3) return;
  for (let i = 1; i < polygon.length - 1; i += 1) {
    pushTriangle(positions, polygon[0], polygon[i], polygon[i + 1], reverse);
  }
}

function keyForPoint(point) {
  return `${Math.round(point.x * 10000)},${Math.round(point.y * 10000)},${Math.round(point.z * 10000)}`;
}

function addCutSegment(segments, a, b) {
  if (!a || !b || a.distanceToSquared(b) < EPSILON * EPSILON) return;
  segments.push([a.clone(), b.clone()]);
}

function buildCutCaps(positions, segments, plane, keepPositive) {
  if (segments.length < 3) return;
  const pointsByKey = new Map();
  segments.forEach(([a, b]) => {
    pointsByKey.set(keyForPoint(a), a);
    pointsByKey.set(keyForPoint(b), b);
  });
  const uniquePoints = [...pointsByKey.values()];
  if (uniquePoints.length < 3) return;

  const center = uniquePoints.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / uniquePoints.length);
  const normal = plane.normal.clone().normalize();
  const reference = Math.abs(normal.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const axisU = new THREE.Vector3().crossVectors(reference, normal).normalize();
  const axisV = new THREE.Vector3().crossVectors(normal, axisU).normalize();
  const ordered = uniquePoints.sort((a, b) => {
    const va = a.clone().sub(center);
    const vb = b.clone().sub(center);
    return Math.atan2(va.dot(axisV), va.dot(axisU)) - Math.atan2(vb.dot(axisV), vb.dot(axisU));
  });

  for (let i = 0; i < ordered.length; i += 1) {
    const a = ordered[i];
    const b = ordered[(i + 1) % ordered.length];
    pushTriangle(positions, center, a, b, !keepPositive);
  }
}

function clipGeometryByPlane(sourceGeometry, plane, keepPositive) {
  const geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
  const position = geometry.attributes.position;
  const positions = [];
  const cutSegments = [];

  for (let i = 0; i < position.count; i += 3) {
    const triangle = [
      new THREE.Vector3().fromBufferAttribute(position, i),
      new THREE.Vector3().fromBufferAttribute(position, i + 1),
      new THREE.Vector3().fromBufferAttribute(position, i + 2),
    ];
    const clipped = clipPolygonByPlane(triangle, plane, keepPositive);
    pushPolygon(positions, clipped);

    const intersections = [];
    for (let edge = 0; edge < 3; edge += 1) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      const da = pointDistance(a, plane);
      const db = pointDistance(b, plane);
      if ((da > EPSILON && db < -EPSILON) || (da < -EPSILON && db > EPSILON)) {
        intersections.push(intersectEdge(a, b, da, db));
      }
    }
    if (intersections.length === 2) addCutSegment(cutSegments, intersections[0], intersections[1]);
  }

  buildCutCaps(positions, cutSegments, plane, keepPositive);
  geometry.dispose();

  if (positions.length < 9) return null;
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

function makeResultMesh(sourceObject, geometry, suffix) {
  const material = sourceObject.material?.clone?.() || new THREE.MeshStandardMaterial({
    color: sourceObject.userData.color || '#38bdf8',
    roughness: 0.58,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${sourceObject.name || '物件'} ${suffix}`.trim();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    ...sourceObject.userData,
    mode: 'solid',
    printObject: true,
    shapeType: 'plane-cut',
  };
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  return mesh;
}

export function clipMeshByPlane(mesh, plane, keepSide = 'positive') {
  const worldGeometry = makeWorldGeometry(mesh);
  if (!worldGeometry) return null;
  const clipped = clipGeometryByPlane(worldGeometry, plane, keepSide === 'positive');
  worldGeometry.dispose();
  return clipped ? makeResultMesh(mesh, clipped, '切割') : null;
}

export function splitMeshByPlane(mesh, plane) {
  const worldGeometry = makeWorldGeometry(mesh);
  if (!worldGeometry) return [];
  const positive = clipGeometryByPlane(worldGeometry, plane, true);
  const negative = clipGeometryByPlane(worldGeometry, plane, false);
  worldGeometry.dispose();
  const results = [];
  if (positive) results.push(makeResultMesh(mesh, positive, '切割 A'));
  if (negative) results.push(makeResultMesh(mesh, negative, '切割 B'));
  return results;
}

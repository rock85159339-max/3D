import * as THREE from 'three';

const DEFAULT_KEY_PRECISION = 100000;
const DEGENERATE_AREA = 0.0001;

function vertexKey(vertex, precision = DEFAULT_KEY_PRECISION) {
  return [
    Math.round(vertex.x * precision),
    Math.round(vertex.y * precision),
    Math.round(vertex.z * precision),
  ].join(',');
}

function edgeKey(a, b) {
  return [a, b].sort().join('|');
}

function makeNonIndexed(sourceGeometry) {
  const geometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
  geometry.computeVertexNormals();
  return geometry;
}

function triangleArea(a, b, c) {
  return new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() * 0.5;
}

function readPositions(geometry) {
  const position = geometry.attributes.position;
  const vertices = [];
  for (let i = 0; i < position.count; i += 1) {
    vertices.push(new THREE.Vector3().fromBufferAttribute(position, i));
  }
  return vertices;
}

function buildBoundaryData(geometry) {
  const work = makeNonIndexed(geometry);
  const vertices = readPositions(work);
  const edgeMap = new Map();
  let degenerateFaceCount = 0;

  for (let i = 0; i < vertices.length; i += 3) {
    const tri = [vertices[i], vertices[i + 1], vertices[i + 2]];
    if (triangleArea(tri[0], tri[1], tri[2]) < DEGENERATE_AREA) degenerateFaceCount += 1;
    const keys = tri.map((vertex) => vertexKey(vertex));
    [[0, 1], [1, 2], [2, 0]].forEach(([from, to]) => {
      const key = edgeKey(keys[from], keys[to]);
      const entry = edgeMap.get(key) || { count: 0, keys: [keys[from], keys[to]], points: [tri[from].clone(), tri[to].clone()] };
      entry.count += 1;
      edgeMap.set(key, entry);
    });
  }

  const boundaryEdges = [...edgeMap.values()].filter((entry) => entry.count === 1);
  const holes = groupBoundaryLoops(boundaryEdges);
  work.dispose();
  return { boundaryEdges, holes, degenerateFaceCount };
}

function groupBoundaryLoops(boundaryEdges) {
  const unused = new Set(boundaryEdges.map((_, index) => index));
  const adjacency = new Map();
  boundaryEdges.forEach((edge, index) => {
    edge.keys.forEach((key) => {
      if (!adjacency.has(key)) adjacency.set(key, []);
      adjacency.get(key).push(index);
    });
  });

  const loops = [];
  while (unused.size) {
    const firstIndex = unused.values().next().value;
    const first = boundaryEdges[firstIndex];
    unused.delete(firstIndex);
    const loopKeys = [first.keys[0], first.keys[1]];
    const pointByKey = new Map(first.keys.map((key, i) => [key, first.points[i].clone()]));
    let currentKey = first.keys[1];
    let guard = 0;

    while (guard < boundaryEdges.length + 2) {
      guard += 1;
      const nextIndex = (adjacency.get(currentKey) || []).find((index) => unused.has(index));
      if (nextIndex == null) break;
      const edge = boundaryEdges[nextIndex];
      unused.delete(nextIndex);
      edge.keys.forEach((key, i) => {
        if (!pointByKey.has(key)) pointByKey.set(key, edge.points[i].clone());
      });
      const nextKey = edge.keys[0] === currentKey ? edge.keys[1] : edge.keys[0];
      if (nextKey === loopKeys[0]) break;
      loopKeys.push(nextKey);
      currentKey = nextKey;
    }

    const points = loopKeys.map((key) => pointByKey.get(key)).filter(Boolean);
    loops.push({
      points,
      edgeCount: Math.max(1, loopKeys.length),
      simple: points.length >= 3 && guard <= boundaryEdges.length + 1,
    });
  }
  return loops;
}

function geometryFromPositions(positions) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function analyzeMeshRepairGeometry(geometry) {
  const { boundaryEdges, holes, degenerateFaceCount } = buildBoundaryData(geometry);
  const looseIslandCount = countLooseIslands(geometry);
  return {
    holes,
    holeCount: holes.length,
    boundaryEdgeCount: boundaryEdges.length,
    degenerateFaceCount,
    looseIslandCount,
  };
}

export function fillHolesGeometry(sourceGeometry, maxLoopEdges = 240) {
  const geometry = makeNonIndexed(sourceGeometry);
  const positions = Array.from(geometry.attributes.position.array);
  const analysis = analyzeMeshRepairGeometry(geometry);
  let filled = 0;
  let skipped = 0;

  analysis.holes.forEach((hole) => {
    if (!hole.simple || hole.points.length < 3 || hole.points.length > maxLoopEdges) {
      skipped += 1;
      return;
    }
    const center = hole.points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / hole.points.length);
    for (let i = 0; i < hole.points.length; i += 1) {
      const a = hole.points[i];
      const b = hole.points[(i + 1) % hole.points.length];
      [a, b, center].forEach((point) => positions.push(point.x, point.y, point.z));
    }
    filled += 1;
  });

  geometry.dispose();
  return { geometry: geometryFromPositions(positions), filled, skipped, analysis };
}

export function mergeCloseVerticesGeometry(sourceGeometry, tolerance = 0.01) {
  const geometry = makeNonIndexed(sourceGeometry);
  const position = geometry.attributes.position;
  const precision = Math.max(1, Math.round(1 / Math.max(0.000001, tolerance)));
  const canonical = new Map();
  const positions = [];

  for (let i = 0; i < position.count; i += 1) {
    const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
    const key = vertexKey(vertex, precision);
    const merged = canonical.get(key) || vertex;
    canonical.set(key, merged);
    positions.push(merged.x, merged.y, merged.z);
  }

  geometry.dispose();
  return {
    geometry: geometryFromPositions(positions),
    mergedVertices: Math.max(0, position.count - canonical.size),
  };
}

export function removeDegenerateFacesGeometry(sourceGeometry, threshold = DEGENERATE_AREA) {
  const geometry = makeNonIndexed(sourceGeometry);
  const vertices = readPositions(geometry);
  const positions = [];
  let removed = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const area = triangleArea(vertices[i], vertices[i + 1], vertices[i + 2]);
    if (area <= threshold) {
      removed += 1;
      continue;
    }
    [vertices[i], vertices[i + 1], vertices[i + 2]].forEach((point) => positions.push(point.x, point.y, point.z));
  }
  geometry.dispose();
  return { geometry: geometryFromPositions(positions), removedFaces: removed };
}

export function removeLooseFacesGeometry(sourceGeometry) {
  const geometry = makeNonIndexed(sourceGeometry);
  const vertices = readPositions(geometry);
  const triangleCount = Math.floor(vertices.length / 3);
  const vertexToTriangles = new Map();
  const triangleKeys = [];

  for (let tri = 0; tri < triangleCount; tri += 1) {
    const keys = [0, 1, 2].map((offset) => vertexKey(vertices[tri * 3 + offset]));
    triangleKeys.push(keys);
    keys.forEach((key) => {
      if (!vertexToTriangles.has(key)) vertexToTriangles.set(key, []);
      vertexToTriangles.get(key).push(tri);
    });
  }

  const visited = new Set();
  const islands = [];
  for (let tri = 0; tri < triangleCount; tri += 1) {
    if (visited.has(tri)) continue;
    const queue = [tri];
    const island = [];
    visited.add(tri);
    while (queue.length) {
      const current = queue.shift();
      island.push(current);
      triangleKeys[current].forEach((key) => {
        (vertexToTriangles.get(key) || []).forEach((next) => {
          if (visited.has(next)) return;
          visited.add(next);
          queue.push(next);
        });
      });
    }
    islands.push(island);
  }

  const largest = islands.sort((a, b) => b.length - a.length)[0] || [];
  const keep = new Set(largest);
  const positions = [];
  let removedTriangles = 0;
  for (let tri = 0; tri < triangleCount; tri += 1) {
    if (!keep.has(tri)) {
      removedTriangles += 1;
      continue;
    }
    [0, 1, 2].forEach((offset) => {
      const point = vertices[tri * 3 + offset];
      positions.push(point.x, point.y, point.z);
    });
  }

  geometry.dispose();
  return { geometry: geometryFromPositions(positions), removedTriangles, islandCount: islands.length };
}

function countLooseIslands(geometry) {
  const result = removeLooseFacesGeometry(geometry);
  const count = result.islandCount || 0;
  result.geometry.dispose();
  return count;
}

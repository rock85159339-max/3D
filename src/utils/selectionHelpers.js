export function getTrianglePoints(mesh, faceIndex, THREE) {
  if (!mesh?.geometry?.attributes?.position || faceIndex == null) return null;
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  const indices = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const rawIndex = faceIndex * 3 + offset;
    indices.push(geometry.index ? geometry.index.getX(rawIndex) : rawIndex);
  }
  if (indices.some((index) => index < 0 || index >= position.count)) return null;
  mesh.updateWorldMatrix(true, false);
  const points = indices.map((index) => new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld));
  return { points, indices };
}

export function getClosestEdgeFromIntersection(hit, THREE) {
  const triangle = getTrianglePoints(hit?.object, hit?.faceIndex, THREE);
  if (!triangle || !hit?.point) return null;
  const edges = [
    { index: 0, a: triangle.points[0], b: triangle.points[1], vertexIndices: [triangle.indices[0], triangle.indices[1]] },
    { index: 1, a: triangle.points[1], b: triangle.points[2], vertexIndices: [triangle.indices[1], triangle.indices[2]] },
    { index: 2, a: triangle.points[2], b: triangle.points[0], vertexIndices: [triangle.indices[2], triangle.indices[0]] },
  ];
  const closest = edges.reduce((best, edge) => {
    const line = new THREE.Line3(edge.a, edge.b);
    const point = new THREE.Vector3();
    line.closestPointToPoint(hit.point, true, point);
    const distance = point.distanceTo(hit.point);
    return !best || distance < best.distance ? { ...edge, point, distance } : best;
  }, null);
  if (!closest) return null;
  return {
    edgeIndex: `${hit.faceIndex}:${closest.index}`,
    points: [closest.a.clone(), closest.b.clone()],
    vertexIndices: closest.vertexIndices,
    center: closest.point.clone(),
    distance: closest.distance,
    length: closest.a.distanceTo(closest.b),
    faceIndex: hit.faceIndex,
    mesh: hit.object,
  };
}

export function getClosestVertexFromIntersection(hit, THREE) {
  const triangle = getTrianglePoints(hit?.object, hit?.faceIndex, THREE);
  if (!triangle || !hit?.point) return null;
  const closest = triangle.points.reduce((best, point, index) => {
    const distance = point.distanceTo(hit.point);
    return !best || distance < best.distance ? { point, index, distance } : best;
  }, null);
  if (!closest) return null;
  const vertexIndex = triangle.indices[closest.index];
  const mesh = hit.object;
  const localPosition = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, vertexIndex);
  const normalAttribute = mesh.geometry.attributes.normal;
  if (!normalAttribute) mesh.geometry.computeVertexNormals();
  const nextNormalAttribute = mesh.geometry.attributes.normal;
  const normal = nextNormalAttribute
    ? new THREE.Vector3().fromBufferAttribute(nextNormalAttribute, vertexIndex).normalize()
    : null;
  return {
    vertexIndex,
    positionIndex: vertexIndex,
    localPosition,
    worldPosition: closest.point.clone(),
    normal,
    point: closest.point.clone(),
    distance: closest.distance,
    faceIndex: hit.faceIndex,
    mesh,
  };
}

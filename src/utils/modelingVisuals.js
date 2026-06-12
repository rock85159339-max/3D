export function createEdgeHighlight(points, THREE) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xfacc15,
    linewidth: 2,
    depthTest: false,
    transparent: true,
    opacity: 0.96,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 45;
  line.userData.helper = true;
  return line;
}

export function createVertexHighlight(point, THREE) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false }),
  );
  mesh.position.copy(point);
  mesh.renderOrder = 46;
  mesh.userData.helper = true;
  return mesh;
}

export function createVertexCloud(object, THREE, maxPoints = 1200) {
  const group = new THREE.Group();
  group.name = '頂點輔助';
  group.userData.helper = true;
  const points = [];
  object.traverse((child) => {
    if (!child.isMesh || !child.geometry?.attributes?.position || child.userData.helper) return;
    child.updateWorldMatrix(true, false);
    const position = child.geometry.attributes.position;
    const stride = Math.max(1, Math.ceil(position.count / maxPoints));
    for (let i = 0; i < position.count; i += stride) {
      points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld));
    }
  });
  if (!points.length) return group;
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.PointsMaterial({
    color: 0x38bdf8,
    size: 3,
    sizeAttenuation: false,
    depthTest: false,
    transparent: true,
    opacity: 0.82,
  });
  const cloud = new THREE.Points(geometry, material);
  cloud.renderOrder = 42;
  cloud.userData.helper = true;
  group.add(cloud);
  return group;
}

export function createWireframeOverlay(object, THREE) {
  const group = new THREE.Group();
  group.name = '線框輔助';
  group.userData.helper = true;
  object.traverse((child) => {
    if (!child.isMesh || !child.geometry || child.userData.helper) return;
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(child.geometry),
      new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.25, depthTest: false }),
    );
    child.updateWorldMatrix(true, false);
    wire.applyMatrix4(child.matrixWorld);
    wire.renderOrder = 41;
    wire.userData.helper = true;
    group.add(wire);
  });
  return group;
}

import * as THREE from 'three';

function makePlaneGeometry(size) {
  return new THREE.PlaneGeometry(Math.max(size, 1), Math.max(size, 1));
}

function orientPlane(helper, axis, position) {
  helper.position.set(0, 0, 0);
  helper.rotation.set(0, 0, 0);
  if (axis === 'x') {
    helper.rotation.y = Math.PI / 2;
    helper.position.x = position;
  } else if (axis === 'y') {
    helper.rotation.x = Math.PI / 2;
    helper.position.y = position;
  } else {
    helper.position.z = position;
  }
}

export function createPlaneCutPreview(axis = 'z', position = 0, size = 120) {
  const group = new THREE.Group();
  group.name = 'Plane Cut Preview';
  group.userData.helper = true;

  const plane = new THREE.Mesh(
    makePlaneGeometry(size),
    new THREE.MeshBasicMaterial({
      color: '#22d3ee',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  plane.userData.helper = true;

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(plane.geometry),
    new THREE.LineBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.95 }),
  );
  edges.userData.helper = true;

  group.add(plane, edges);
  updatePlaneCutPreview(group, axis, position, size);
  return group;
}

export function updatePlaneCutPreview(helper, axis = 'z', position = 0, size = 120) {
  if (!helper) return helper;
  const nextSize = Math.max(Number(size) || 120, 1);
  helper.children.forEach((child) => {
    if (child.geometry) {
      child.geometry.dispose();
      if (child.isLineSegments) {
        const planeGeometry = makePlaneGeometry(nextSize);
        child.geometry = new THREE.EdgesGeometry(planeGeometry);
        planeGeometry.dispose();
      } else {
        child.geometry = makePlaneGeometry(nextSize);
      }
    }
  });
  orientPlane(helper, axis, Number(position) || 0);
  helper.visible = true;
  return helper;
}

export function removePlaneCutPreview(scene, helper) {
  if (!scene || !helper) return;
  scene.remove(helper);
  helper.traverse((child) => {
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  });
}

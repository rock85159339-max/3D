import * as THREE from 'three';

export const CAMERA_VIEW_POSITIONS = {
  front: [0, -340, 80],
  back: [0, 340, 80],
  left: [-340, 0, 80],
  right: [340, 0, 80],
  top: [0, 0, 340],
  bottom: [0, 0, -340],
  iso: [220, -260, 180],
};

export function applyCameraView(camera, orbit, view, target = new THREE.Vector3(0, 0, 25)) {
  if (!camera || !orbit) return;
  const position = CAMERA_VIEW_POSITIONS[view] || CAMERA_VIEW_POSITIONS.iso;
  camera.position.set(...position);
  camera.up.set(0, 0, 1);
  if (view === 'top' || view === 'bottom') camera.up.set(0, 1, 0);
  orbit.target.copy(target);
  orbit.update();
}

export function focusCameraOnBox(camera, orbit, box, fallbackDistance = 220) {
  if (!camera || !orbit || !box || box.isEmpty()) return;
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  const radius = Math.max(size.x, size.y, size.z, 20) * 0.5;
  const direction = camera.position.clone().sub(orbit.target);
  if (direction.lengthSq() < 1) direction.set(1, -1, 0.7);
  direction.normalize();
  const fov = THREE.MathUtils.degToRad(camera.fov || 45);
  const distance = Math.max(fallbackDistance, radius / Math.tan(fov / 2) + radius);
  orbit.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.near = 0.1;
  camera.far = Math.max(3000, distance * 8);
  camera.updateProjectionMatrix();
  orbit.update();
}

export function toggleCameraProjectionFov(camera, currentProjection) {
  if (!camera) return currentProjection;
  const next = currentProjection === 'perspective' ? 'orthographic' : 'perspective';
  camera.fov = next === 'orthographic' ? 8 : 45;
  camera.updateProjectionMatrix();
  return next;
}

export function applyOrbitControlStyle(orbit, THREERef, style, sensitivity = 1) {
  if (!orbit) return;
  const speed = Math.max(0.1, Number(sensitivity) || 1);
  orbit.rotateSpeed = speed;
  orbit.panSpeed = speed;
  orbit.zoomSpeed = speed;
  if (style === 'maya') {
    orbit.mouseButtons = {
      LEFT: THREERef.MOUSE.ROTATE,
      MIDDLE: THREERef.MOUSE.PAN,
      RIGHT: THREERef.MOUSE.DOLLY,
    };
  } else {
    orbit.mouseButtons = {
      LEFT: null,
      MIDDLE: THREERef.MOUSE.ROTATE,
      RIGHT: THREERef.MOUSE.PAN,
    };
  }
}

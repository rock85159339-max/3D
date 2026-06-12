import * as THREE from 'three';

export function getSelectionWorldBox(selectedObjects = []) {
  const box = new THREE.Box3();
  let hasObject = false;
  selectedObjects.forEach((object) => {
    if (!object || object.visible === false) return;
    object.updateWorldMatrix(true, true);
    const objectBox = new THREE.Box3().setFromObject(object);
    if (objectBox.isEmpty()) return;
    box.union(objectBox);
    hasObject = true;
  });
  return hasObject ? box : null;
}

export function getSelectionWorldCenter(selectedObjects = []) {
  const box = getSelectionWorldBox(selectedObjects);
  if (!box) return null;
  return box.getCenter(new THREE.Vector3());
}

export function updateTransformPivot(pivot, selectedObjects = []) {
  if (!pivot) return null;
  const center = getSelectionWorldCenter(selectedObjects);
  if (!center) return null;
  pivot.position.copy(center);
  pivot.rotation.set(0, 0, 0);
  pivot.scale.set(1, 1, 1);
  pivot.updateMatrixWorld(true);
  return center;
}

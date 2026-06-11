import * as THREE from 'three';

export function roundNumber(value, digits = 2) {
  return Number(value.toFixed(digits));
}

export function getObjectBounds(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return { box, size, center };
}

export function getScenePrintStats(objects, printerSize) {
  const allBox = new THREE.Box3();
  let hasBox = false;
  let solidCount = 0;
  let holeCount = 0;
  let floatingCount = 0;
  let belowPlatformCount = 0;
  let outsideCount = 0;
  let thinCount = 0;
  const halfX = printerSize.x / 2;
  const halfY = printerSize.y / 2;

  objects.forEach((object) => {
    const { box, size } = getObjectBounds(object);
    if (!box.isEmpty()) {
      allBox.union(box);
      hasBox = true;
    }
    if (object.userData.mode === 'hole') holeCount += 1;
    else solidCount += 1;
    if (box.min.z > 0.15) floatingCount += 1;
    if (box.min.z < -0.01) belowPlatformCount += 1;
    if (size.x < 1 || size.y < 1 || size.z < 1) thinCount += 1;
    if (
      box.min.x < -halfX ||
      box.max.x > halfX ||
      box.min.y < -halfY ||
      box.max.y > halfY ||
      box.max.z > printerSize.z
    ) {
      outsideCount += 1;
    }
  });

  const totalSize = new THREE.Vector3();
  if (hasBox) allBox.getSize(totalSize);

  return {
    objectCount: objects.length,
    solidCount,
    holeCount,
    floatingCount,
    belowPlatformCount,
    outsideCount,
    thinCount,
    totalSize: {
      x: roundNumber(totalSize.x),
      y: roundNumber(totalSize.y),
      z: roundNumber(totalSize.z),
    },
  };
}

export function printCheck(object, printerSize) {
  if (!object) return null;
  const { box, size } = getObjectBounds(object);
  const halfX = printerSize.x / 2;
  const halfY = printerSize.y / 2;
  const outside =
    box.min.x < -halfX ||
    box.max.x > halfX ||
    box.min.y < -halfY ||
    box.max.y > halfY ||
    box.max.z > printerSize.z;
  const belowPlatform = box.min.z < -0.01;
  const floating = box.min.z > 0.15;
  const tooThin = size.x < 1 || size.y < 1 || size.z < 1;
  return {
    outside,
    belowPlatform,
    floating,
    tooThin,
    dimensions: { x: roundNumber(size.x), y: roundNumber(size.y), z: roundNumber(size.z) },
  };
}

export function createSceneSnapshot(objects, options = {}) {
  return {
    version: 2,
    printerKey: options.printerKey,
    customSize: options.customSize,
    objects: objects.map(options.serializeObject),
  };
}

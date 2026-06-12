function hasTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

async function loadTauriApis() {
  if (!hasTauriRuntime()) return null;
  const [{ invoke }, { open, save }] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/plugin-dialog'),
  ]);
  return { invoke, open, save };
}

function normalizePath(path) {
  if (Array.isArray(path)) return path[0] || null;
  return path || null;
}

function getExtension(defaultName) {
  const match = /\.([^.]+)$/.exec(defaultName);
  return match ? match[1] : '*';
}

function getFileFilters(defaultName) {
  const extension = getExtension(defaultName);
  if (extension === 'json') return [{ name: 'JSON project', extensions: ['json'] }];
  if (extension === 'stl') return [{ name: 'STL model', extensions: ['stl'] }];
  if (extension === 'obj') return [{ name: 'OBJ model', extensions: ['obj'] }];
  return [{ name: 'All files', extensions: ['*'] }];
}

export function isDesktop() {
  return hasTauriRuntime();
}

export function getRuntimeLabel() {
  return isDesktop() ? 'Desktop' : 'Web';
}

export async function saveTextFileDesktop(defaultName, content) {
  const apis = await loadTauriApis();
  if (!apis) return false;
  const path = await apis.save({
    defaultPath: defaultName,
    filters: getFileFilters(defaultName),
  });
  if (!path) return null;
  await apis.invoke('write_text_file', { path, contents: content });
  return true;
}

export async function openTextFileDesktop(defaultName = 'project.json') {
  const apis = await loadTauriApis();
  if (!apis) return null;
  const path = normalizePath(await apis.open({
    multiple: false,
    filters: getFileFilters(defaultName),
  }));
  if (!path) return { canceled: true };
  const contents = await apis.invoke('read_text_file', { path });
  return { path, contents };
}

export async function saveBinaryFileDesktop(defaultName, bytes) {
  const apis = await loadTauriApis();
  if (!apis) return false;
  const path = await apis.save({
    defaultPath: defaultName,
    filters: getFileFilters(defaultName),
  });
  if (!path) return null;
  await apis.invoke('write_binary_file', { path, bytes: Array.from(bytes) });
  return true;
}

export async function openBinaryFileDesktop(defaultName = 'model.stl') {
  const apis = await loadTauriApis();
  if (!apis) return null;
  const path = normalizePath(await apis.open({
    multiple: false,
    filters: getFileFilters(defaultName),
  }));
  if (!path) return { canceled: true };
  const bytes = await apis.invoke('read_binary_file', { path });
  return { path, bytes: new Uint8Array(bytes) };
}

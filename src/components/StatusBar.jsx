import React from 'react';

export default function StatusBar({ workflow, editMode, mode, selectedCount, lockedAxis, operationStyle, brushMode, boxSelectActive, appInfo, version }) {
  const tool = editMode === 'sculpt' ? `Sculpt ${brushMode}` : boxSelectActive ? 'Box Select' : mode;
  const hint = operationStyle === 'maya'
    ? 'Maya: Left drag rotate, Shift+Left pan, wheel zoom, F focus, A frame all'
    : 'Blender: Left/Middle drag rotate, Shift+Left/Middle pan, G move, R rotate, S scale';
  return (
    <footer className="status-bar">
      <span>{appInfo.name} {version}</span>
      <span>{appInfo.repo}</span>
      <span>Mode: {workflow} / {editMode}</span>
      <span>Tool: {tool}</span>
      <span>Selected: {selectedCount}</span>
      <span>Axis: {lockedAxis ? lockedAxis.toUpperCase() : 'None'}</span>
      <span>{hint}</span>
    </footer>
  );
}

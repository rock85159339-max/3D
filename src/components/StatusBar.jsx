import React from 'react';

export default function StatusBar({ workflow, editMode, mode, selectedCount, lockedAxis, operationStyle, brushMode, boxSelectActive, appInfo, version }) {
  const tool = editMode === 'sculpt' ? `Sculpt ${brushMode}` : boxSelectActive ? 'Box Select' : mode;
  const hint = operationStyle === 'maya'
    ? 'Maya: Left drag rotate, Shift+Left pan, Alt+Left rotates while editing'
    : 'Blender: Left/Middle rotate, Shift+Left pan, Alt+Left rotates while editing';
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

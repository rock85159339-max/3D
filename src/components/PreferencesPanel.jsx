import React from 'react';

export default function PreferencesPanel({ preferences, cameraProjection, onChange, onClose, onProjectionChange }) {
  return (
    <section className="preferences-panel" onClick={(event) => event.stopPropagation()}>
      <div className="panel-title-row">
        <strong>Preferences</strong>
        <button onClick={onClose}>Close</button>
      </div>
      <div className="settings-grid">
        <label className="field">
          <span>Operation mode</span>
          <select value={preferences.operationStyle} onChange={(event) => onChange('operationStyle', event.target.value)}>
            <option value="blender">Blender Style</option>
            <option value="maya">Maya Style</option>
          </select>
        </label>
        <label className="field">
          <span>Default camera</span>
          <select
            value={preferences.defaultCamera}
            onChange={(event) => {
              onChange('defaultCamera', event.target.value);
              if (event.target.value !== cameraProjection) onProjectionChange();
            }}
          >
            <option value="perspective">Perspective</option>
            <option value="orthographic">Orthographic</option>
          </select>
        </label>
        <label className="field">
          <span>Mouse sensitivity</span>
          <input type="number" min="0.1" max="5" step="0.1" value={preferences.mouseSensitivity} onChange={(event) => onChange('mouseSensitivity', Number(event.target.value) || 1)} />
        </label>
        <label className="field">
          <span>Grid size mm</span>
          <input type="number" min="1" step="1" value={preferences.gridSize} onChange={(event) => onChange('gridSize', Math.max(1, Number(event.target.value) || 10))} />
        </label>
        <label className="field">
          <span>Snap distance mm</span>
          <input type="number" min="0.1" step="0.1" value={preferences.snapDistance} onChange={(event) => onChange('snapDistance', Math.max(0.1, Number(event.target.value) || 1))} />
        </label>
        <label className="field">
          <span>Theme density</span>
          <select value={preferences.density} onChange={(event) => onChange('density', event.target.value)}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
      </div>
      <div className="preference-footer">
        <span>Camera: {cameraProjection === 'orthographic' ? 'Ortho' : 'Perspective'}</span>
        <button onClick={onProjectionChange}>Toggle Ortho / Perspective</button>
      </div>
    </section>
  );
}

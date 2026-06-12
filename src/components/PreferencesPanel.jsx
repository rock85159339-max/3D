import React from 'react';

export default function PreferencesPanel({ preferences, cameraProjection, onChange, onClose, onProjectionChange }) {
  return (
    <section className="preferences-panel" onClick={(event) => event.stopPropagation()}>
      <div className="panel-title-row">
        <strong>偏好設定</strong>
        <button onClick={onClose}>關閉</button>
      </div>
      <div className="settings-grid">
        <label className="field">
          <span>操作模式</span>
          <select value={preferences.operationStyle} onChange={(event) => onChange('operationStyle', event.target.value)}>
            <option value="blender">Blender 風格</option>
            <option value="maya">Maya 風格</option>
          </select>
        </label>
        <label className="field">
          <span>預設相機</span>
          <select
            value={preferences.defaultCamera}
            onChange={(event) => {
              onChange('defaultCamera', event.target.value);
              if (event.target.value !== cameraProjection) onProjectionChange();
            }}
          >
            <option value="perspective">透視</option>
            <option value="orthographic">正交</option>
          </select>
        </label>
        <label className="field">
          <span>滑鼠靈敏度</span>
          <input type="number" min="0.1" max="5" step="0.1" value={preferences.mouseSensitivity} onChange={(event) => onChange('mouseSensitivity', Number(event.target.value) || 1)} />
        </label>
        <label className="field">
          <span>格線大小 mm</span>
          <input type="number" min="1" step="1" value={preferences.gridSize} onChange={(event) => onChange('gridSize', Math.max(1, Number(event.target.value) || 10))} />
        </label>
        <label className="field">
          <span>吸附距離 mm</span>
          <input type="number" min="0.1" step="0.1" value={preferences.snapDistance} onChange={(event) => onChange('snapDistance', Math.max(0.1, Number(event.target.value) || 1))} />
        </label>
        <label className="field">
          <span>介面密度</span>
          <select value={preferences.density} onChange={(event) => onChange('density', event.target.value)}>
            <option value="comfortable">舒適</option>
            <option value="compact">緊湊</option>
          </select>
        </label>
      </div>
      <div className="preference-footer">
        <span>相機：{cameraProjection === 'orthographic' ? '正交' : '透視'}</span>
        <button onClick={onProjectionChange}>切換透視 / 正交</button>
      </div>
    </section>
  );
}

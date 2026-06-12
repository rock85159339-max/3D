import React from 'react';
import { RotateCcw, RotateCw, Settings, Trash2 } from 'lucide-react';
import IconButton from './IconButton.jsx';
import BeginnerModeToggle from './BeginnerModeToggle.jsx';

export default function TopAppBar({
  projectName,
  onProjectNameChange,
  lastAutosave,
  canUndo,
  canRedo,
  canDelete,
  onUndo,
  onRedo,
  onDelete,
  uiMode,
  onUiModeChange,
  snapEnabled,
  snapDistance,
  onSnapChange,
  printerKey,
  printers,
  onPrinterChange,
  onPreferences,
}) {
  return (
    <header className="top-app-bar">
      <div className="app-title-cluster">
        <strong className="desktop-app-name">3D列印建模器</strong>
        <input
          className="project-name-input"
          value={projectName}
          placeholder="未命名模型"
          onChange={(event) => onProjectNameChange(event.target.value || '未命名模型')}
        />
        <span className="autosave-status">{lastAutosave ? `已自動儲存：${lastAutosave}` : '自動儲存待命'}</span>
      </div>

      <div className="top-action-cluster">
        <IconButton icon={RotateCcw} label="復原" shortcut="Ctrl+Z" disabled={!canUndo} onClick={onUndo} />
        <IconButton icon={RotateCw} label="重做" shortcut="Ctrl+Y" disabled={!canRedo} onClick={onRedo} />
        <IconButton icon={Trash2} label="刪除" shortcut="Del" danger disabled={!canDelete} onClick={onDelete} />
      </div>

      <div className="top-settings-cluster">
        <BeginnerModeToggle value={uiMode} onChange={onUiModeChange} />
        <label className="compact-switch" title="啟用或關閉吸附">
          <input type="checkbox" checked={snapEnabled} onChange={(event) => onSnapChange(event.target.checked)} />
          <span>{snapEnabled ? `吸附 ${snapDistance} mm` : '吸附 關'}</span>
        </label>
        <label className="compact-select">
          <span>列印機</span>
          <select value={printerKey} onChange={(event) => onPrinterChange(event.target.value)}>
            {Object.entries(printers).map(([key, printer]) => (
              <option key={key} value={key}>{printer.label}</option>
            ))}
          </select>
        </label>
        <IconButton icon={Settings} label="偏好設定" onClick={onPreferences} />
      </div>
    </header>
  );
}

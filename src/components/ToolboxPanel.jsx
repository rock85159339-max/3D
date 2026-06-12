import React from 'react';
import { Type } from 'lucide-react';
import LeftToolTabs from './LeftToolTabs.jsx';
import CommonToolsPanel from './CommonToolsPanel.jsx';

const shapeLabels = {
  cube: '方塊',
  sphere: '球體',
  cylinder: '圓柱',
  torus: '圓環',
  cone: '圓錐',
};

const modeLabels = {
  object: '物件',
  face: '面',
  edge: '邊',
  vertex: '點',
  sculpt: '雕刻',
};

export default function ToolboxPanel({
  activeTab,
  onTabChange,
  resolution,
  resolutionPresets,
  onResolutionChange,
  shapes,
  onAddShape,
  onAddText,
  hasSelection,
  onCenter,
  onDrop,
  onRowDuplicate,
  onMatrixDuplicate,
  onSetHole,
  onSetSolid,
  modelingMode,
  onModelingModeChange,
  uiMode,
  onSetAdvancedMode,
  onOpenRepairTools,
}) {
  const presets = resolutionPresets || {};
  const selectedPreset = presets[resolution] || presets.low;

  return (
    <section className="left-toolbox-shell">
      <div className="brand compact-brand toolbox-brand">
        <span className="brand-mark">mm</span>
        <span>工具箱</span>
      </div>
      <LeftToolTabs value={activeTab} onChange={onTabChange} />

      <div className="left-tool-content">
        {activeTab === 'create' && (
          <>
            <div className="tool-section compact-tool-section">
              <label className="field resolution-select-field">
                <span>
                  解析度
                  <small className="resolution-help" title="細分越高，模型越平滑，但檔案與運算會變重。">?</small>
                </span>
                <select value={resolution} onChange={(event) => onResolutionChange(event.target.value)}>
                  {Object.entries(presets).map(([key, preset]) => (
                    <option key={key} value={key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedPreset && (
                <>
                  <p className="resolution-hint">{selectedPreset.hint}</p>
                  <div className="resolution-details" aria-label="目前細分">
                    <strong>目前細分</strong>
                    <span>球體 {selectedPreset.sphere[0]}×{selectedPreset.sphere[1]}</span>
                    <span>圓柱 {selectedPreset.cylinder}</span>
                    <span>圓錐 {selectedPreset.cone}</span>
                    <span>圓環 {selectedPreset.torus[0]}×{selectedPreset.torus[1]}</span>
                  </div>
                </>
              )}
            </div>

            <div className="tool-section compact-tool-section">
              <span className="section-label">基本形狀</span>
              {Object.entries(shapes).map(([type, shape]) => {
                const Icon = shape.icon;
                return (
                  <button key={type} className="tool-button primary-tool" onClick={() => onAddShape(type)}>
                    <Icon size={18} />
                    <span>{shapeLabels[type] || shape.label}</span>
                  </button>
                );
              })}
              <button className="tool-button primary-tool" onClick={onAddText}>
                <Type size={18} />
                <span>3D 文字</span>
              </button>
            </div>
          </>
        )}

        {activeTab === 'common' && (
          <CommonToolsPanel
            disabled={!hasSelection}
            onCenter={onCenter}
            onDrop={onDrop}
            onRowDuplicate={onRowDuplicate}
            onMatrixDuplicate={onMatrixDuplicate}
            onSetHole={onSetHole}
            onSetSolid={onSetSolid}
          />
        )}

        {activeTab === 'modeling' && (
          <div className="tool-section workflow-hint">
            <span className="section-label">建模模式</span>
            <div className="left-mode-buttons">
              {Object.entries(modeLabels).map(([key, label]) => (
                <button key={key} className={modelingMode === key ? 'active' : ''} onClick={() => onModelingModeChange(key)}>
                  {label}
                </button>
              ))}
            </div>
            <p>物件模式：移動、旋轉、縮放整個物件。</p>
            <p>面模式：選面後可拉伸或內縮。</p>
            <p>邊模式：選邊後可倒角或切割。</p>
            <p>點模式：選頂點後可局部調整。</p>
            <p>雕刻模式：用筆刷推拉表面。</p>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="tool-section workflow-hint">
            <span className="section-label">進階工具</span>
            <p>修復工具與網格檢查在右側「修復工具」分頁中使用。</p>
            <p>包含重新整理網格、重建網格、修正表面方向與網格修復。</p>
            {uiMode === 'beginner' ? (
              <>
                <p>切換到進階模式後可使用完整修復工具。</p>
                <button className="tool-button primary-tool" onClick={onSetAdvancedMode}>切換到進階模式</button>
              </>
            ) : (
              <button className="tool-button primary-tool" onClick={onOpenRepairTools}>開啟修復工具</button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

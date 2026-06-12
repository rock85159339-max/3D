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

export default function ToolboxPanel({
  activeTab,
  onTabChange,
  resolution,
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
              <span className="section-label">解析度</span>
              <div className="segmented text-segmented resolution-toggle">
                {[
                  ['low', '低'],
                  ['medium', '中'],
                  ['high', '高'],
                ].map(([key, label]) => (
                  <button key={key} className={resolution === key ? 'active' : ''} onClick={() => onResolutionChange(key)}>
                    {label}
                  </button>
                ))}
              </div>
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
              {[
                ['object', '物件'],
                ['face', '面'],
                ['edge', '邊'],
                ['vertex', '點'],
                ['sculpt', '雕刻'],
              ].map(([key, label]) => (
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

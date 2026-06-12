import React from 'react';
import { Box, ChevronLeft, ChevronRight, Circle, CircleSlash, Cylinder, Download, Grid3X3, Move3D, Type } from 'lucide-react';
import IconButton from './IconButton.jsx';

const modeText = {
  object: '物件模式',
  face: '面模式',
  edge: '邊模式',
  vertex: '點模式',
  sculpt: '雕刻模式',
};

export default function ContextToolShelf({
  collapsed,
  onToggleCollapsed,
  modelingMode,
  resolution,
  resolutionPresets,
  onResolutionChange,
  onAddShape,
  onAddText,
  hasSelection,
  faceSelection,
  edgeSelection,
  vertexSelection,
  sculptSettings,
  onSculptSettingChange,
  onCenter,
  onDrop,
  onRowDuplicate,
  onMatrixDuplicate,
  onSetSolid,
  onSetHole,
  onExtrude,
  onInset,
  onDeleteFace,
  onFlipFace,
  onStub,
}) {
  const preset = resolutionPresets[resolution] || resolutionPresets.low;
  if (collapsed) {
    return (
      <aside className="context-tool-shelf collapsed">
        <button className="shelf-collapse-button" onClick={onToggleCollapsed} title="展開工具架">
          <ChevronRight size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="context-tool-shelf">
      <header className="shelf-header">
        <div>
          <span>工具架</span>
          <strong>{modeText[modelingMode] || '物件模式'}</strong>
        </div>
        <button className="shelf-collapse-button" onClick={onToggleCollapsed} title="收合工具架">
          <ChevronLeft size={18} />
        </button>
      </header>

      {modelingMode === 'object' && (
        <div className="shelf-scroll">
          <section className="shelf-section">
            <span className="section-label">建立常用形狀</span>
            <div className="shelf-icon-grid">
              <IconButton icon={Box} label="方塊" onClick={() => onAddShape('cube')} />
              <IconButton icon={Circle} label="球體" onClick={() => onAddShape('sphere')} />
              <IconButton icon={Cylinder} label="圓柱" onClick={() => onAddShape('cylinder')} />
              <IconButton icon={Circle} label="圓環" badge="T" onClick={() => onAddShape('torus')} />
              <IconButton icon={Cylinder} label="圓錐" badge="▲" onClick={() => onAddShape('cone')} />
              <IconButton icon={Type} label="3D 文字" onClick={onAddText} />
            </div>
          </section>

          <section className="shelf-section">
            <label className="field resolution-select-field">
              <span>細分品質</span>
              <select value={resolution} onChange={(event) => onResolutionChange(event.target.value)}>
                {Object.entries(resolutionPresets).map(([key, item]) => (
                  <option key={key} value={key}>{item.label}</option>
                ))}
              </select>
            </label>
            <p className="resolution-hint">{preset?.hint}</p>
            {preset && <div className="mini-readout">球體 {preset.sphere[0]}×{preset.sphere[1]} / 圓環 {preset.torus[0]}×{preset.torus[1]}</div>}
          </section>

          <section className="shelf-section">
            <span className="section-label">常用工具</span>
            <button onClick={onCenter} disabled={!hasSelection}>置中到平台</button>
            <button onClick={onDrop} disabled={!hasSelection}>貼齊平台</button>
            <button onClick={onRowDuplicate} disabled={!hasSelection}>複製一排</button>
            <button onClick={onMatrixDuplicate} disabled={!hasSelection}>複製矩陣</button>
          </section>

          <section className="shelf-section">
            <span className="section-label">Solid / Hole</span>
            <button onClick={onSetSolid} disabled={!hasSelection}>轉成實體</button>
            <button onClick={onSetHole} disabled={!hasSelection}>轉成挖洞</button>
          </section>
        </div>
      )}

      {modelingMode === 'face' && (
        <div className="shelf-scroll">
          <section className="shelf-section">
            <span className="section-label">面工具</span>
            <button onClick={onExtrude} disabled={!faceSelection}>拉伸</button>
            <button onClick={onInset} disabled={!faceSelection}>內縮</button>
            <button onClick={onDeleteFace} disabled={!faceSelection}>刪除面</button>
            <button onClick={onFlipFace} disabled={!faceSelection}>翻轉面</button>
            <div className="mini-readout">{faceSelection ? `目前選取 Face #${faceSelection.faceIndex}` : '尚未選取面'}</div>
          </section>
        </div>
      )}

      {modelingMode === 'edge' && (
        <div className="shelf-scroll">
          <section className="shelf-section">
            <span className="section-label">邊工具</span>
            <button onClick={() => onStub('倒角工具下一版開放')}>倒角</button>
            <button onClick={() => onStub('環切工具下一版開放')}>環切</button>
            <button onClick={() => onStub('分割工具下一版開放')}>分割</button>
            <div className="mini-readout">{edgeSelection ? `已選取邊 #${edgeSelection.edgeIndex ?? '-'}` : '尚未選取邊'}</div>
          </section>
        </div>
      )}

      {modelingMode === 'vertex' && (
        <div className="shelf-scroll">
          <section className="shelf-section">
            <span className="section-label">點工具</span>
            <button onClick={() => onStub('移動頂點工具下一版開放')}>移動頂點</button>
            <button onClick={() => onStub('合併頂點工具下一版開放')}>合併頂點</button>
            <button onClick={() => onStub('平滑頂點工具下一版開放')}>平滑頂點</button>
            <div className="mini-readout">{vertexSelection ? `已選取頂點 #${vertexSelection.vertexIndex ?? '-'}` : '尚未選取頂點'}</div>
          </section>
        </div>
      )}

      {modelingMode === 'sculpt' && (
        <div className="shelf-scroll">
          <section className="shelf-section">
            <span className="section-label">雕刻筆刷</span>
            <select value={sculptSettings.brushMode} onChange={(event) => onSculptSettingChange('brushMode', event.target.value)}>
              <option value="raise">推起</option>
              <option value="lower">壓下</option>
              <option value="smooth">平滑</option>
            </select>
            <label className="field"><span>半徑</span><input type="number" value={sculptSettings.radius} onChange={(event) => onSculptSettingChange('radius', event.target.value)} /></label>
            <label className="field"><span>強度</span><input type="number" step="0.05" min="0" max="1" value={sculptSettings.strength} onChange={(event) => onSculptSettingChange('strength', event.target.value)} /></label>
            <button onClick={() => onStub('請在高細分模型表面按住左鍵拖曳測試筆刷')}>筆刷測試</button>
            <div className="notice">雕刻建議使用高、超高或雕刻級解析度建立模型。</div>
          </section>
        </div>
      )}
    </aside>
  );
}

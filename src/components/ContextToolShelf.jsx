import React from 'react';
import { Box, ChevronLeft, ChevronRight, Circle, Cylinder, Type } from 'lucide-react';
import IconButton from './IconButton.jsx';

const modeText = {
  object: '物件模式',
  face: '面模式',
  edge: '邊模式',
  vertex: '點模式',
  sculpt: '雕刻模式',
};

function formatNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return Number(number.toFixed(digits)).toString();
}

function VectorReadout({ label, value, digits = 2 }) {
  return (
    <div className="vector-readout">
      <span>{label}</span>
      <strong>
        X {formatNumber(value?.x, digits)} / Y {formatNumber(value?.y, digits)} / Z {formatNumber(value?.z, digits)}
      </strong>
    </div>
  );
}

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
  vertexOffset,
  softSelection,
  affectedVertexCount,
  onVertexOffsetChange,
  onSoftSelectionChange,
  onApplyVertexOffset,
  onResetVertexOffset,
  onVertexNormalPush,
  onVertexNormalPull,
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
  const hasVertex = !!vertexSelection?.mesh && vertexSelection.positionIndex != null;
  const affectedCountLabel = affectedVertexCount == null ? '-' : affectedVertexCount;

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
            {preset && <div className="mini-readout">球體 {preset.sphere[0]}x{preset.sphere[1]} / 圓環 {preset.torus[0]}x{preset.torus[1]}</div>}
          </section>

          <section className="shelf-section">
            <span className="section-label">常用工具</span>
            <button onClick={onCenter} disabled={!hasSelection}>置中到平台</button>
            <button onClick={onDrop} disabled={!hasSelection}>貼齊平台</button>
            <button onClick={onRowDuplicate} disabled={!hasSelection}>複製一排</button>
            <button onClick={onMatrixDuplicate} disabled={!hasSelection}>複製矩陣</button>
          </section>

          <section className="shelf-section">
            <span className="section-label">實體 / 挖洞</span>
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
            <span className="section-label">頂點編輯</span>
            <div className="mini-readout">{hasVertex ? `目前頂點 #${vertexSelection.positionIndex}` : '尚未選取頂點'}</div>
            {hasVertex ? (
              <>
                <VectorReadout label="本地座標" value={vertexSelection.localPosition} />
                <VectorReadout label="世界座標" value={vertexSelection.worldPosition} />
                <VectorReadout label="法線" value={vertexSelection.normal} />
              </>
            ) : (
              <div className="notice">請點選模型上的頂點。此物件目前若沒有可用 geometry，將無法編輯頂點。</div>
            )}
            <div className="axis-input-grid">
              {['x', 'y', 'z'].map((axis) => (
                <label key={axis} className="field">
                  <span>{axis.toUpperCase()} 位移 mm</span>
                  <input
                    type="number"
                    step="0.1"
                    value={vertexOffset?.[axis] ?? 0}
                    onChange={(event) => onVertexOffsetChange(axis, event.target.value)}
                    disabled={!hasVertex}
                  />
                </label>
              ))}
            </div>
            <button className="primary-action" onClick={onApplyVertexOffset} disabled={!hasVertex}>套用位移</button>
            <button onClick={onResetVertexOffset} disabled={!hasVertex}>重設輸入</button>
            <button onClick={onVertexNormalPush} disabled={!hasVertex}>沿法線推出 2 mm</button>
            <button onClick={onVertexNormalPull} disabled={!hasVertex}>沿法線拉回 2 mm</button>
            <div className="soft-selection-panel">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={!!softSelection?.enabled}
                  onChange={(event) => onSoftSelectionChange('enabled', event.target.checked)}
                />
                <span>啟用軟選取</span>
              </label>
              <label className="field">
                <span>影響半徑 mm</span>
                <input
                  type="number"
                  min="1"
                  max="200"
                  step="0.5"
                  value={softSelection?.radius ?? 20}
                  onChange={(event) => onSoftSelectionChange('radius', event.target.value)}
                  disabled={!softSelection?.enabled}
                />
              </label>
              <label className="field">
                <span>衰減模式</span>
                <select
                  value={softSelection?.falloff ?? 'smooth'}
                  onChange={(event) => onSoftSelectionChange('falloff', event.target.value)}
                  disabled={!softSelection?.enabled}
                >
                  <option value="smooth">Smooth 平滑</option>
                  <option value="linear">Linear 線性</option>
                  <option value="sharp">Sharp 尖銳</option>
                </select>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={!!softSelection?.preview}
                  onChange={(event) => onSoftSelectionChange('preview', event.target.checked)}
                  disabled={!softSelection?.enabled}
                />
                <span>預覽影響範圍</span>
              </label>
              <div className="mini-readout">受影響頂點：{softSelection?.enabled ? affectedCountLabel : hasVertex ? 1 : '-'}</div>
            </div>
            <div className="notice">頂點編輯會直接改變模型形狀，可用 Undo 復原。啟用軟選取後，移動頂點會平滑帶動附近頂點。</div>
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

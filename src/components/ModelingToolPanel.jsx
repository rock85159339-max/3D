import React from 'react';

export default function ModelingToolPanel({
  modelingMode,
  faceSelection,
  edgeSelection,
  vertexSelection,
  sculptSettings,
  onSculptSettingChange,
  onExtrude,
  onInset,
  onDeleteFace,
  onFlipFace,
  onStub,
}) {
  if (modelingMode === 'object') {
    return (
      <section className="printer-card">
        <div className="card-title">建模工具</div>
        <div className="notice">物件模式可使用右側物件工具進行對齊、合併、挖洞與陣列複製。</div>
      </section>
    );
  }

  if (modelingMode === 'face') {
    return (
      <section className="printer-card">
        <div className="card-title">面工具</div>
        {faceSelection ? (
          <div className="dimension-readout">
            <span>目前面：Face #{faceSelection.faceIndex}</span>
            <span>法線：{faceSelection.normal.x} / {faceSelection.normal.y} / {faceSelection.normal.z}</span>
          </div>
        ) : (
          <div className="notice">請點選模型表面的一個三角面。</div>
        )}
        <div className="prep-grid">
          <button className="primary-action" onClick={onExtrude} disabled={!faceSelection}>拉伸 Extrude</button>
          <button onClick={onInset} disabled={!faceSelection}>內縮 Inset</button>
          <button className="danger" onClick={onDeleteFace} disabled={!faceSelection}>刪除面</button>
          <button onClick={onFlipFace} disabled={!faceSelection}>翻轉面</button>
        </div>
      </section>
    );
  }

  if (modelingMode === 'edge') {
    return (
      <section className="printer-card">
        <div className="card-title">邊工具</div>
        {edgeSelection ? (
          <div className="dimension-readout">
            <span>目前邊：{edgeSelection.edgeIndex}</span>
            <span>長度：{edgeSelection.length} mm</span>
          </div>
        ) : (
          <div className="notice">請點選模型上的邊線附近。</div>
        )}
        <div className="prep-grid">
          <button onClick={() => onStub('倒角工具下一版開放')}>倒角 Bevel</button>
          <button onClick={() => onStub('環切工具下一版開放')}>環切 Loop Cut</button>
          <button onClick={() => onStub('分割工具下一版開放')}>分割 Split</button>
        </div>
      </section>
    );
  }

  if (modelingMode === 'vertex') {
    return (
      <section className="printer-card">
        <div className="card-title">點工具</div>
        {vertexSelection ? (
          <div className="dimension-readout">
            <span>目前頂點：#{vertexSelection.vertexIndex}</span>
            <span>{vertexSelection.point.x} / {vertexSelection.point.y} / {vertexSelection.point.z} mm</span>
          </div>
        ) : (
          <div className="notice">請點選模型頂點附近。</div>
        )}
        <div className="prep-grid">
          <button onClick={() => onStub('移動頂點工具下一版開放')}>移動頂點</button>
          <button onClick={() => onStub('合併頂點工具下一版開放')}>合併頂點</button>
          <button onClick={() => onStub('平滑頂點工具下一版開放')}>平滑頂點</button>
        </div>
      </section>
    );
  }

  return (
    <section className="printer-card">
      <div className="card-title">雕刻工具</div>
      <div className="notice">滑鼠移到模型表面會顯示筆刷範圍。第一版以安全預覽為主。</div>
      <label className="field">
        <span>筆刷模式</span>
        <select value={sculptSettings.tool} onChange={(event) => onSculptSettingChange('tool', event.target.value)}>
          <option value="pull">推起 Pull</option>
          <option value="push">壓下 Push</option>
          <option value="smooth">平滑 Smooth</option>
        </select>
      </label>
      <div className="row-fields">
        <label className="field"><span>半徑 mm</span><input type="number" min="1" step="1" value={sculptSettings.radius} onChange={(event) => onSculptSettingChange('radius', event.target.value)} /></label>
        <label className="field"><span>強度</span><input type="number" min="0" max="1" step="0.05" value={sculptSettings.strength} onChange={(event) => onSculptSettingChange('strength', event.target.value)} /></label>
      </div>
      <button onClick={() => onStub('此模型需要先重建網格後才能雕刻')}>測試筆刷</button>
    </section>
  );
}

import React from 'react';

export default function PlaneCutPanel({
  active,
  settings,
  hasValidTarget,
  onEnable,
  onChange,
  onApply,
  onCancel,
}) {
  const update = (key, value) => onChange?.(key, value);

  return (
    <div className="plane-cut-panel">
      <button className={active ? 'active' : ''} onClick={onEnable} disabled={!hasValidTarget}>
        {active ? '切割模式已啟用' : '啟用切割模式'}
      </button>
      <label className="field">
        <span>切割軸</span>
        <select value={settings.axis} onChange={(event) => update('axis', event.target.value)} disabled={!active}>
          <option value="x">X</option>
          <option value="y">Y</option>
          <option value="z">Z</option>
        </select>
      </label>
      <label className="field">
        <span>切割位置 mm</span>
        <input
          type="number"
          step="1"
          value={settings.position}
          onChange={(event) => update('position', event.target.value)}
          disabled={!active}
        />
      </label>
      <label className="field">
        <span>保留方式</span>
        <select value={settings.keep} onChange={(event) => update('keep', event.target.value)} disabled={!active}>
          <option value="positive">保留正向</option>
          <option value="negative">保留負向</option>
          <option value="both">保留兩邊</option>
        </select>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={!!settings.showPreview}
          onChange={(event) => update('showPreview', event.target.checked)}
          disabled={!active}
        />
        <span>顯示切割平面</span>
      </label>
      <div className="plane-cut-actions">
        <button className="primary-action" onClick={onApply} disabled={!active || !hasValidTarget}>套用切割</button>
        <button onClick={onCancel} disabled={!active}>取消切割</button>
      </div>
      {!hasValidTarget && <div className="notice">請選取一個實體物件後使用平面切割。</div>}
    </div>
  );
}

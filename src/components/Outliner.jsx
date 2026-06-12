import React from 'react';

export default function Outliner({ objects, selectedIds, onSelect, onRename, onToggleVisibility, onToggleLock }) {
  if (!objects.length) return <div className="empty-state compact">尚無物件</div>;
  return (
    <div className="outliner-list">
      {objects.map((object) => (
        <div key={object.uuid} className={`outliner-row ${selectedIds.includes(object.uuid) ? 'selected' : ''} ${object.userData.locked ? 'locked' : ''}`} onClick={(event) => onSelect(object, event.shiftKey)}>
          <input
            className="outliner-name"
            value={object.name}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onRename(object, event.target.value)}
          />
          <span className={`mode-pill ${object.userData.mode === 'hole' ? 'hole' : 'solid'}`}>{object.userData.mode === 'hole' ? '挖洞' : '實體'}</span>
          <button title={object.visible === false ? '顯示' : '隱藏'} onClick={(event) => { event.stopPropagation(); onToggleVisibility(object); }}>{object.visible === false ? '顯示' : '隱藏'}</button>
          <button title={object.userData.locked ? '解鎖' : '鎖定'} onClick={(event) => { event.stopPropagation(); onToggleLock(object); }}>{object.userData.locked ? '解鎖' : '鎖定'}</button>
        </div>
      ))}
    </div>
  );
}

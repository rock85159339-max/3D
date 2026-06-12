import React from 'react';

export default function Outliner({ objects, selectedIds, onSelect, onRename, onToggleVisibility, onToggleLock }) {
  if (!objects.length) {
    return (
      <div className="empty-state compact">
        <strong>尚無物件</strong>
        <p>請從上方建立工具新增方塊、球體或圓柱開始。</p>
      </div>
    );
  }

  return (
    <div className="outliner-list">
      {objects.map((object) => {
        const isHole = object.userData.mode === 'hole';
        const isHidden = object.visible === false;
        const isLocked = !!object.userData.locked;
        return (
          <div
            key={object.uuid}
            className={`outliner-row ${selectedIds.includes(object.uuid) ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
            onClick={(event) => onSelect(object, event.shiftKey)}
          >
            <input
              className="outliner-name"
              value={object.name}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onRename(object, event.target.value)}
              title="重新命名物件"
            />
            <span className={`mode-pill ${isHole ? 'hole' : 'solid'}`}>
              {isHole ? '挖洞' : '實體'}
            </span>
            <button
              title={isHidden ? '顯示' : '隱藏'}
              onClick={(event) => {
                event.stopPropagation();
                onToggleVisibility(object);
              }}
            >
              {isHidden ? '顯示' : '隱藏'}
            </button>
            <button
              title={isLocked ? '解鎖' : '鎖定'}
              onClick={(event) => {
                event.stopPropagation();
                onToggleLock(object);
              }}
            >
              {isLocked ? '解鎖' : '鎖定'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

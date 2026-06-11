import React from 'react';

export default function Outliner({ objects, selectedIds, onSelect, onRename, onToggleVisibility, onToggleLock }) {
  if (!objects.length) return <div className="empty-state compact">No objects yet</div>;
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
          <span className={`mode-pill ${object.userData.mode === 'hole' ? 'hole' : 'solid'}`}>{object.userData.mode === 'hole' ? 'Hole' : 'Solid'}</span>
          <button title="Show / hide" onClick={(event) => { event.stopPropagation(); onToggleVisibility(object); }}>{object.visible === false ? 'Show' : 'Hide'}</button>
          <button title="Lock / unlock" onClick={(event) => { event.stopPropagation(); onToggleLock(object); }}>{object.userData.locked ? 'Unlock' : 'Lock'}</button>
        </div>
      ))}
    </div>
  );
}

import React from 'react';

export default function ViewCube({ cameraProjection, onView, onToggleProjection }) {
  return (
    <div className="view-buttons">
      {['front', 'back', 'left', 'right', 'top', 'bottom', 'iso'].map((view) => (
        <button key={view} onClick={() => onView(view)}>{view === 'iso' ? 'ISO' : view[0].toUpperCase() + view.slice(1)}</button>
      ))}
      <button className="projection-toggle" onClick={onToggleProjection}>{cameraProjection === 'orthographic' ? 'Ortho' : 'Perspective'}</button>
    </div>
  );
}

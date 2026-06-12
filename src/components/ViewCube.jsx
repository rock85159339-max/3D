import React from 'react';

export default function ViewCube({ cameraProjection, onView, onToggleProjection }) {
  const labels = {
    front: ['前', '前視圖'],
    back: ['後', '後視圖'],
    left: ['左', '左視圖'],
    right: ['右', '右視圖'],
    top: ['上', '上視圖'],
    bottom: ['下', '下視圖'],
    iso: ['等角', '等角視圖'],
  };
  return (
    <div className="view-buttons">
      {['front', 'back', 'left', 'right', 'top', 'bottom', 'iso'].map((view) => (
        <button key={view} title={labels[view][1]} onClick={() => onView(view)}>{labels[view][0]}</button>
      ))}
      <button
        className="projection-toggle"
        title={cameraProjection === 'orthographic' ? '正交視角' : '透視視角'}
        onClick={onToggleProjection}
      >
        {cameraProjection === 'orthographic' ? '正交' : '透視'}
      </button>
    </div>
  );
}

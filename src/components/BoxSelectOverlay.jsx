import React from 'react';

export default function BoxSelectOverlay({ rect, mountRef }) {
  if (!rect) return null;
  const viewportRect = mountRef.current?.getBoundingClientRect();
  return (
    <div
      className="box-select-rect"
      style={{
        left: rect.x - (viewportRect?.left || 0),
        top: rect.y - (viewportRect?.top || 0),
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}

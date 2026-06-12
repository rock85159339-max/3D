import React from 'react';

function formatSize(size) {
  return `${size.x} × ${size.y} × ${size.z} mm`;
}

export default function SelectionSizeInfo({ info }) {
  return (
    <section className="selection-size-info">
      <strong>{info.title}</strong>
      <span>{formatSize(info.size)}</span>
      <small>{info.caption}</small>
    </section>
  );
}

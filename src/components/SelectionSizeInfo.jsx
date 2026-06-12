import React from 'react';

function formatNumber(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(digits).replace(/\.0$/, '');
}

function formatSize(size) {
  return `${formatNumber(size.x)} × ${formatNumber(size.y)} × ${formatNumber(size.z)} mm`;
}

function formatScale(scale) {
  if (!scale) return '多選不適用';
  return `${formatNumber(scale.x, 2)} × ${formatNumber(scale.y, 2)} × ${formatNumber(scale.z, 2)}`;
}

export default function SelectionSizeInfo({ info }) {
  return (
    <section className="selection-size-info">
      <strong>{info.title}</strong>
      <span>{formatSize(info.size)}</span>
      <small>{info.caption}</small>
      <small>縮放：{formatScale(info.scale)}</small>
    </section>
  );
}

import React from 'react';

export default function CommonToolsPanel({
  disabled,
  onCenter,
  onDrop,
  onRowDuplicate,
  onMatrixDuplicate,
  onSetHole,
  onSetSolid,
}) {
  return (
    <div className="tool-section common-tools-section">
      <span className="section-label">常用工具</span>
      <button className="tool-button" onClick={onCenter} disabled={disabled}>置中到平台</button>
      <button className="tool-button" onClick={onDrop} disabled={disabled}>貼齊平台</button>
      <button className="tool-button" onClick={onRowDuplicate} disabled={disabled}>複製一排</button>
      <button className="tool-button" onClick={onMatrixDuplicate} disabled={disabled}>複製矩陣</button>
      <button className="tool-button" onClick={onSetHole} disabled={disabled}>轉成挖洞物件</button>
      <button className="tool-button" onClick={onSetSolid} disabled={disabled}>轉成實體物件</button>
    </div>
  );
}

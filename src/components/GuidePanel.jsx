import React from 'react';

export default function GuidePanel({ onClose, onNeverShow }) {
  return (
    <section className="guide-panel">
      <div>
        <strong>操作指南</strong>
        <p>基本操作：左鍵拖曳旋轉視角，Shift + 左鍵平移，Alt + 左鍵可在編輯/雕刻時強制旋轉視角，滾輪縮放，G 移動，R 旋轉，S 縮放。</p>
        <ol>
          <li>新增基本物件。</li>
          <li>用 G / R / S 調整位置、旋轉與尺寸。</li>
          <li>用 Face Mode 推拉表面。</li>
          <li>用 Sculpt Mode 雕刻。</li>
          <li>用 Print Prep 檢查與修復。</li>
          <li>匯出 STL 進行 3D 列印。</li>
        </ol>
        <p>更多快捷鍵：Shift+D 複製，X/Y/Z 鎖定軸，B 框選，Home 縮放到全部物件，Numpad 1/3/7 切視角，Numpad 5 切換 Ortho / Perspective。</p>
      </div>
      <div className="guide-actions">
        <button onClick={onClose}>關閉</button>
        <button onClick={onNeverShow}>不再顯示</button>
      </div>
    </section>
  );
}

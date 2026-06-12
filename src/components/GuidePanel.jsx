import React from 'react';

export default function GuidePanel({ onClose, onNeverShow }) {
  return (
    <section className="guide-panel">
      <div>
        <strong>操作指南</strong>
        <p>基本操作：中鍵拖曳旋轉視角，Shift + 中鍵平移，滾輪縮放，G 移動，R 旋轉，S 縮放，F 聚焦選取物件。</p>
        <ol>
          <li>從左側新增基本物件。</li>
          <li>使用移動、旋轉、縮放調整形狀。</li>
          <li>切到面編輯進行推拉與擠出。</li>
          <li>切到雕刻模式進行筆刷變形。</li>
          <li>使用列印修復檢查模型。</li>
          <li>匯出 STL 進行 3D 列印。</li>
        </ol>
        <p>更多快捷鍵：Shift + D 複製，X / Y / Z 鎖定軸，B 框選，Home 縮放到全部物件，Tab 切換物件 / 面編輯模式。</p>
      </div>
      <div className="guide-actions">
        <button onClick={onClose}>關閉</button>
        <button onClick={onNeverShow}>不再顯示</button>
      </div>
    </section>
  );
}

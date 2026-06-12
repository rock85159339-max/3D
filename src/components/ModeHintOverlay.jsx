import React, { useEffect, useState } from 'react';

const hints = {
  object: '物件模式：選取整個物件並移動、旋轉、縮放。',
  face: '面模式：點選模型表面，可拉伸或內縮。',
  edge: '邊模式：點選模型邊線，可倒角或分割。',
  vertex: '點模式：點選頂點，可調整局部形狀。',
  sculpt: '雕刻模式：用筆刷推拉模型表面。',
};

export default function ModeHintOverlay({ mode }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 2400);
    return () => window.clearTimeout(timer);
  }, [mode]);

  if (!visible) return null;
  return <div className="mode-hint-overlay">{hints[mode] || hints.object}</div>;
}

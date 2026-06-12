import React from 'react';
import { Box, Download, Type, Wrench } from 'lucide-react';

const cards = [
  {
    key: 'basic',
    icon: Box,
    title: '建立基本模型',
    description: '先放入方塊、球體或圓柱，再用移動、旋轉、縮放調整外型。',
    action: '新增方塊',
  },
  {
    key: 'import',
    icon: Download,
    title: '匯入 STL / OBJ',
    description: '之後可用來載入既有模型；目前會顯示匯入提示。',
    action: '匯入模型',
  },
  {
    key: 'box',
    icon: Wrench,
    title: '製作盒子 / 收納架',
    description: '建立一個簡單開口盒，適合測試尺寸、壁厚與列印檢查。',
    action: '建立盒子',
  },
  {
    key: 'text',
    icon: Type,
    title: '製作文字牌',
    description: '建立一個底板加 3D 文字，適合做標籤或展示牌。',
    action: '建立文字牌',
  },
];

export default function QuickStartCards({ onBasic, onImport, onBox, onTextSign }) {
  const handlers = {
    basic: onBasic,
    import: onImport,
    box: onBox,
    text: onTextSign,
  };

  return (
    <div className="quick-start-card quick-start-grid-card">
      <div className="quick-start-heading">
        <span className="quick-start-kicker">快速開始</span>
        <h2>開始建立你的 3D 模型</h2>
        <p>選一個入口開始，之後可以用左側工具和右側屬性繼續調整。</p>
      </div>
      <div className="quick-card-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button key={card.key} className="quick-card" onClick={handlers[card.key]}>
              <Icon size={24} />
              <strong>{card.title}</strong>
              <span>{card.description}</span>
              <em>{card.action}</em>
            </button>
          );
        })}
      </div>
    </div>
  );
}

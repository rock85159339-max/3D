import React from 'react';
import { BoxSelect, Brush, Camera, Dot, Grid2X2, Ruler, Settings, SquareDashedMousePointer, Triangle } from 'lucide-react';
import IconButton from './IconButton.jsx';

const modeItems = [
  { key: 'object', label: '物件模式', icon: SquareDashedMousePointer },
  { key: 'face', label: '面模式', icon: Grid2X2 },
  { key: 'edge', label: '邊模式', icon: Triangle },
  { key: 'vertex', label: '點模式', icon: Dot },
  { key: 'sculpt', label: '雕刻模式', icon: Brush },
];

export default function LeftVerticalToolbar({ mode, onModeChange, measureActive, onMeasureToggle, onViewTools, onSettings }) {
  return (
    <aside className="left-vertical-toolbar" aria-label="模式工具列">
      {modeItems.map((item) => (
        <IconButton
          key={item.key}
          icon={item.icon}
          label={item.label}
          active={mode === item.key}
          onClick={() => onModeChange(item.key)}
        />
      ))}
      <div className="left-toolbar-spacer" />
      <IconButton icon={Ruler} label="測量" active={measureActive} onClick={onMeasureToggle} />
      <IconButton icon={Camera} label="視角工具" onClick={onViewTools} />
      <IconButton icon={Settings} label="設定" onClick={onSettings} />
    </aside>
  );
}

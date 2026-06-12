import React from 'react';
import { Box, Brush, CircleDot, Hexagon, Move3D } from 'lucide-react';

const modes = [
  { key: 'object', label: '物件模式', icon: Box },
  { key: 'face', label: '面模式', icon: Hexagon },
  { key: 'edge', label: '邊模式', icon: Move3D },
  { key: 'vertex', label: '點模式', icon: CircleDot },
  { key: 'sculpt', label: '雕刻模式', icon: Brush },
];

export default function ModelingModeToolbar({ value, onChange }) {
  return (
    <div className="modeling-mode-toolbar" aria-label="建模模式">
      {modes.map((mode) => {
        const Icon = mode.icon;
        return (
          <button key={mode.key} className={value === mode.key ? 'active' : ''} onClick={() => onChange(mode.key)}>
            <Icon size={16} />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

import React from 'react';

export default function BeginnerModeToggle({ value, onChange }) {
  return (
    <div className="beginner-mode-toggle" aria-label="操作模式">
      <button className={value === 'beginner' ? 'active' : ''} onClick={() => onChange('beginner')}>
        新手模式
      </button>
      <button className={value === 'advanced' ? 'active' : ''} onClick={() => onChange('advanced')}>
        進階模式
      </button>
    </div>
  );
}

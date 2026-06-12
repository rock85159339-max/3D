import React from 'react';

const tabs = [
  { key: 'create', label: '建立' },
  { key: 'common', label: '常用' },
  { key: 'modeling', label: '建模' },
  { key: 'advanced', label: '進階' },
];

export default function LeftToolTabs({ value, onChange }) {
  return (
    <div className="left-tool-tabs" role="tablist" aria-label="工具箱分頁">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={value === tab.key ? 'active' : ''}
          onClick={() => onChange(tab.key)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

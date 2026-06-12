import React from 'react';

const tabLabels = {
  object: '物件',
  scene: '場景',
  print: '列印',
  modifiers: '進階修改器',
  history: '歷史',
};

export default function RightInspectorPanel({ activeTab, onTabChange, children }) {
  return (
    <aside className="right-inspector-panel">
      <div className="inspector-tabs" role="tablist" aria-label="右側檢查器">
        {Object.entries(tabLabels).map(([key, label]) => (
          <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => onTabChange(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="inspector-content">
        {children}
      </div>
    </aside>
  );
}

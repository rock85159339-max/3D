import React from 'react';

const tabLabels = {
  properties: '物件屬性',
  check: '列印檢查',
  repair: '修復工具',
};

export default function RightPanelTabs({ activeTab, onTabChange, expertMode, children }) {
  const tabs = ['properties', 'check', 'repair'];

  return (
    <div className="right-panel-tabs">
      <div className="panel-tab-list" role="tablist" aria-label="右側工具分頁">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => onTabChange(tab)}
            title={tab === 'repair' && !expertMode ? '修復工具在進階模式中使用' : tabLabels[tab]}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>
      <div className="panel-tab-content">
        {children}
      </div>
    </div>
  );
}

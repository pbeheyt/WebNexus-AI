import React from 'react';
import { useTabs } from '../../contexts/TabContext';

const TabNavigation = () => {
  const { TABS, activeTab, switchTab } = useTabs();
  
  const tabsConfig = [
    { id: TABS.PROMPT_MANAGEMENT, label: 'Prompts' },
    { id: TABS.API_SETTINGS, label: 'API Settings' }
  ];
  
  return (
    <div className="tab-nav flex mb-6 border-b border-theme flex-wrap">
      {tabsConfig.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn relative py-3 px-5 text-base cursor-pointer bg-transparent border-none transition-colors ${
            activeTab === tab.id 
              ? 'text-primary font-medium after:content-[""] after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-0.5 after:bg-primary' 
              : 'text-theme-secondary hover:text-theme-primary'
          }`}
          onClick={() => switchTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default TabNavigation;

import React from 'react';
import { useTabs } from '../../contexts/TabContext';
import PromptManagement from '../tabs/PromptManagement';
import ApiSettings from '../tabs/ApiSettings';

const TabContent = () => {
  const { TABS, activeTab } = useTabs();
  
  return (
    <div className="tabs-container relative min-h-[400px]">
      <div className={`tab-content ${activeTab === TABS.API_SETTINGS ? 'active' : ''}`} id={TABS.API_SETTINGS}>
        {activeTab === TABS.API_SETTINGS && <ApiSettings />}
      </div>

      <div className={`tab-content ${activeTab === TABS.PROMPT_MANAGEMENT ? 'active' : ''}`} id={TABS.PROMPT_MANAGEMENT}>
        {activeTab === TABS.PROMPT_MANAGEMENT && <PromptManagement />}
      </div>
      
    </div>
  );
};

export default TabContent;

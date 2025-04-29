import React from 'react';

import { useTabs } from '../../contexts/TabContext';
import PromptManagement from '../tabs/PromptManagement';
import ApiSettings from '../tabs/ApiSettings';

const TabContent = () => {
  const { TABS, activeTab } = useTabs();
  return (
    <>
      {/* Render both tabs but hide the inactive one */}
      <div
        className={`relative min-h-[400px] ${activeTab !== TABS.API_SETTINGS ? 'hidden' : ''}`}
        id={TABS.API_SETTINGS}
      >
        <ApiSettings />
      </div>

      <div
        className={`relative min-h-[400px] ${activeTab !== TABS.PROMPT_MANAGEMENT ? 'hidden' : ''}`}
        id={TABS.PROMPT_MANAGEMENT}
      >
        <PromptManagement />
      </div>
    </>
  );
};

export default TabContent;

import React from 'react';

import { useTabs } from '../../contexts/TabContext';
import PromptManagement from '../tabs/PromptManagement';
import ApiSettings from '../tabs/ApiSettings';
import DataManagementTab from '../tabs/DataManagementTab';
import { ApiSettingsProvider } from '../../contexts/ApiSettingsContext';

const TabContent = () => {
  const { TABS, activeTab } = useTabs();
  return (
    <>
      {/* Render both tabs but hide the inactive one */}
      <div
        className={`relative min-h-[400px] ${activeTab !== TABS.API_SETTINGS ? 'hidden' : ''}`}
        id={TABS.API_SETTINGS}
      >
        <ApiSettingsProvider>
          <ApiSettings />
        </ApiSettingsProvider>
      </div>

      <div
        className={`relative min-h-[400px] ${activeTab !== TABS.PROMPT_MANAGEMENT ? 'hidden' : ''}`}
        id={TABS.PROMPT_MANAGEMENT}
      >
        <PromptManagement />
      </div>

      {/* New Data Management Tab Content */}
      <div
        className={`relative min-h-[400px] ${activeTab !== TABS.DATA_MANAGEMENT ? 'hidden' : ''}`}
        id={TABS.DATA_MANAGEMENT}
      >
        <DataManagementTab />
      </div>
    </>
  );
};

export default TabContent;

import React, { lazy, Suspense } from 'react';

import { SpinnerIcon } from '../../../components';
import { useTabs } from '../../contexts/TabContext';
const LazyPromptManagement = lazy(() => import('../tabs/PromptManagement'));
const LazyApiSettings = lazy(() => import('../tabs/ApiSettings'));
const LazyDataManagementTab = lazy(() => import('../tabs/DataManagementTab'));
const LazyKeyboardShortcutsTab = lazy(() => import('../tabs/KeyboardShortcutsTab'));
import { ApiSettingsProvider } from '../../contexts/ApiSettingsContext';

const TabContent = () => {
  const { TABS, activeTab } = useTabs();
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <SpinnerIcon className="w-8 h-8 text-theme-secondary" />
        <span className="sr-only">Loading tab content...</span>
      </div>
    }>
      {/* Render both tabs but hide the inactive one */}
      <div
        className={`relative min-h-[400px] ${activeTab !== TABS.API_SETTINGS ? 'hidden' : ''}`}
        id={TABS.API_SETTINGS}
      >
        <ApiSettingsProvider>
          <LazyApiSettings />
        </ApiSettingsProvider>
      </div>

      <div
        className={`relative min-h-[400px] ${activeTab !== TABS.PROMPT_MANAGEMENT ? 'hidden' : ''}`}
        id={TABS.PROMPT_MANAGEMENT}
      >
        <LazyPromptManagement />
      </div>

      {/* Data Management Tab Content */}
      <div
        className={`relative min-h-[400px] ${activeTab !== TABS.DATA_MANAGEMENT ? 'hidden' : ''}`}
        id={TABS.DATA_MANAGEMENT}
      >
        <LazyDataManagementTab />
      </div>

      {/* Keyboard Shortcuts Tab Content */}
      <div
        className={`relative min-h-[400px] ${activeTab !== TABS.KEYBOARD_SHORTCUTS ? 'hidden' : ''}`}
        id={TABS.KEYBOARD_SHORTCUTS}
      >
        <LazyKeyboardShortcutsTab />
      </div>
    </Suspense>
  );
};

export default TabContent;
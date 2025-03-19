import React, { Suspense, lazy } from 'react';
import { useTabs } from '../../contexts/TabContext';

// Lazy load tab components to improve initial load performance
const PromptManagement = lazy(() => import('../tabs/PromptManagement'));
const ContentConfiguration = lazy(() => import('../tabs/ContentConfiguration'));
const TemplateCustomization = lazy(() => import('../tabs/TemplateCustomization'));
const Shortcuts = lazy(() => import('../tabs/Shortcuts'));
const ApiSettings = lazy(() => import('../tabs/ApiSettings'));

const LoadingFallback = () => (
  <div className="py-16 text-center">
    <div className="inline-block animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
    <p className="mt-4 text-theme-secondary">Loading...</p>
  </div>
);

const TabContent = () => {
  const { TABS, activeTab } = useTabs();
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      <div className="tabs-container relative min-h-[400px]">
        <div className={`tab-content ${activeTab === TABS.PROMPT_MANAGEMENT ? 'active' : ''}`} id={TABS.PROMPT_MANAGEMENT}>
          {activeTab === TABS.PROMPT_MANAGEMENT && <PromptManagement />}
        </div>
        
        <div className={`tab-content ${activeTab === TABS.CONTENT_CONFIGURATION ? 'active' : ''}`} id={TABS.CONTENT_CONFIGURATION}>
          {activeTab === TABS.CONTENT_CONFIGURATION && <ContentConfiguration />}
        </div>
        
        <div className={`tab-content ${activeTab === TABS.TEMPLATE_CUSTOMIZATION ? 'active' : ''}`} id={TABS.TEMPLATE_CUSTOMIZATION}>
          {activeTab === TABS.TEMPLATE_CUSTOMIZATION && <TemplateCustomization />}
        </div>
        
        <div className={`tab-content ${activeTab === TABS.SHORTCUTS ? 'active' : ''}`} id={TABS.SHORTCUTS}>
          {activeTab === TABS.SHORTCUTS && <Shortcuts />}
        </div>
        
        <div className={`tab-content ${activeTab === TABS.API_SETTINGS ? 'active' : ''}`} id={TABS.API_SETTINGS}>
          {activeTab === TABS.API_SETTINGS && <ApiSettings />}
        </div>
      </div>
    </Suspense>
  );
};

export default TabContent;
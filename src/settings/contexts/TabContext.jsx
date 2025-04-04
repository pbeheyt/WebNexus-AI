import React, { createContext, useContext, useState, useEffect } from 'react';

// Tab IDs from the original constants.js
const TABS = {
  PROMPT_MANAGEMENT: 'prompt-management',
  SHORTCUTS: 'shortcuts',
  API_SETTINGS: 'api-settings'
};

const TabContext = createContext(null);

export const useTabs = () => useContext(TabContext);

export const TabProvider = ({ children }) => {
  const [activeTab, setActiveTab] = useState(TABS.API_SETTINGS);
  
  // Initialize from URL hash if present
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash && Object.values(TABS).includes(hash)) {
      setActiveTab(hash);
    }
  }, []);
  
  const switchTab = (tabId) => {
    if (tabId === activeTab) return;
    
    // Store current scroll position
    const scrollPosition = window.scrollY;
    
    // Update active tab
    setActiveTab(tabId);
    
    // Update URL hash without scrolling
    history.replaceState(null, null, `#${tabId}`);
    
    // Restore scroll position
    window.scrollTo(0, scrollPosition);
  };
  
  return (
    <TabContext.Provider value={{ TABS, activeTab, switchTab }}>
      {children}
    </TabContext.Provider>
  );
};

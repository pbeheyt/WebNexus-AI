// src/settings/SettingsApp.jsx
import React from 'react';
// Removed old Header import
import TabNavigation from './components/layout/TabNavigation';
import TabContent from './components/layout/TabContent';
import { Toast, AppHeader } from '../components'; // Import AppHeader

const SettingsApp = () => {
  return (
    <div className="container max-w-7xl mx-auto bg-theme-primary p-7 rounded-lg shadow-theme-medium text-theme-primary"> {/* Added text-theme-primary */}
      <div className="mb-6"> {/* Wrapper for AppHeader with bottom margin */}
        <AppHeader showSettingsButton={false}>
          {/* Close button */}
          <button
            onClick={() => window.close()}
            className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors" // Adjusted padding to p-1
            title="Close Settings"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" stroke="currentColor">
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </AppHeader>
      </div>
      <TabNavigation />
      <Toast />
      <TabContent />
    </div>
  );
};

export default SettingsApp;

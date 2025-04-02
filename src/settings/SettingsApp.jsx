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
        {/* Pass window.close directly to the new onClose prop */}
        <AppHeader showSettingsButton={false} onClose={window.close} />
        {/* Removed the explicit Close button from here */}
      </div>
      <TabNavigation />
      <Toast />
      <TabContent />
    </div>
  );
};

export default SettingsApp;

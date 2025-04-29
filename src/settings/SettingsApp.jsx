// src/settings/SettingsApp.jsx
import React from 'react';

import { Toast, AppHeader } from '../components';

import TabNavigation from './components/layout/TabNavigation';
import TabContent from './components/layout/TabContent';

const SettingsApp = () => {
  return (
    <div className='container max-w-7xl mx-auto bg-theme-primary p-7 rounded-lg shadow-theme-medium text-theme-primary select-none cursor-default'>
      <div className='mb-6'>
        <AppHeader
          showSettingsButton={false}
          onClose={window.close}
          className='py-2'
        />
      </div>
      <TabNavigation />
      <Toast />
      <TabContent />
    </div>
  );
};

export default SettingsApp;

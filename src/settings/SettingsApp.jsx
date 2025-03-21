import React from 'react';
import Header from './components/layout/Header';
import TabNavigation from './components/layout/TabNavigation';
import NotificationToast from './components/common/NotificationToast';
import TabContent from './components/layout/TabContent';

const SettingsApp = () => {
  return (
    <div className="container max-w-7xl mx-auto bg-theme-primary p-7 rounded-lg shadow-theme-medium">
      <Header />
      <TabNavigation />
      <NotificationToast />
      <TabContent />
    </div>
  );
};

export default SettingsApp;
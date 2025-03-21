// src/settings/SettingsApp.jsx
import React from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { TabProvider } from './contexts/TabContext';
import TabNavigation from './components/layout/TabNavigation';
import Header from './components/layout/Header';
import NotificationToast from './components/common/NotificationToast';
import TabContent from './components/layout/TabContent';

const SettingsApp = () => {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <TabProvider>
          <div className="container max-w-7xl mx-auto bg-theme-primary p-7 rounded-lg shadow-theme-medium">
            <Header />
            <TabNavigation />
            <NotificationToast />
            <TabContent />
          </div>
        </TabProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

export default SettingsApp;
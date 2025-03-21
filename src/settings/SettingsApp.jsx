// src/settings/SettingsApp.jsx
import React from 'react';
import Header from './components/layout/Header';
import TabNavigation from './components/layout/TabNavigation';
import TabContent from './components/layout/TabContent';
import { Toast } from '../components';

const SettingsApp = () => {
  return (
    <div className="container max-w-7xl mx-auto bg-theme-primary p-7 rounded-lg shadow-theme-medium">
      <Header />
      <TabNavigation />
      <Toast /> 
      <TabContent />
    </div>
  );
};

export default SettingsApp;
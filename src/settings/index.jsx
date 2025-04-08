// src/settings/index.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsApp from './SettingsApp';
import { UIProvider } from '../contexts/UIContext';
import { NotificationProvider } from '../components';
import { TabProvider } from './contexts/TabContext';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  
  root.render(
    <React.StrictMode>
      <UIProvider>
        <NotificationProvider>
          <TabProvider>
            <SettingsApp />
          </TabProvider>
        </NotificationProvider>
      </UIProvider>
    </React.StrictMode>
  );
});

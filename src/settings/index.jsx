import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsApp from './SettingsApp';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  
  root.render(
    <React.StrictMode>
      <SettingsApp />
    </React.StrictMode>
  );
});
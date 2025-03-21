// src/sidebar/index.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import SidebarApp from './SidebarApp';
import { ThemeProvider } from '../contexts/ThemeContext';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('sidebar-root');
  const root = createRoot(container);
  
  root.render(
    <ThemeProvider>
      <SidebarApp />
    </ThemeProvider>
  );
});
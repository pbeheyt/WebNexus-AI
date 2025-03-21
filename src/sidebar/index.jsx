import React from 'react';
import { createRoot } from 'react-dom/client';
import SidebarApp from './SidebarApp';
import { ThemeProvider } from '../contexts/ThemeContext';
import { SidebarPlatformProvider } from './contexts/SidebarPlatformContext';
import { SidebarChatProvider } from './contexts/SidebarChatContext';
import { SidebarContentProvider } from './contexts/SidebarContentContext';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('sidebar-root');
  const root = createRoot(container);
  
  root.render(
    <ThemeProvider>
      <SidebarContentProvider>
        <SidebarPlatformProvider>
          <SidebarChatProvider>
            <SidebarApp />
          </SidebarChatProvider>
        </SidebarPlatformProvider>
      </SidebarContentProvider>
    </ThemeProvider>
  );
});
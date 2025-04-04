import React from 'react';
import { createRoot } from 'react-dom/client';
import SidebarApp from './SidebarApp';
import { ThemeProvider } from '../contexts/ThemeContext';
import { SidebarPlatformProvider } from '../contexts/platform';
import { SidebarChatProvider } from './contexts/SidebarChatContext';
import { ContentProvider } from '../components';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('sidebar-root');
  const root = createRoot(container);
  
  root.render(
    <ThemeProvider>
      <ContentProvider>
        <SidebarPlatformProvider>
          <SidebarChatProvider>
            <SidebarApp />
          </SidebarChatProvider>
        </SidebarPlatformProvider>
      </ContentProvider>
    </ThemeProvider>
  );
});

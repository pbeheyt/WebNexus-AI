import React from 'react';
import { createRoot } from 'react-dom/client';

import { UIProvider } from '../contexts/UIContext';
import { SidebarPlatformProvider } from '../contexts/platform';
import { ContentProvider } from '../contexts/ContentContext';

import { SidebarChatProvider } from './contexts/SidebarChatContext';
import SidebarApp from './SidebarApp';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('sidebar-root');
  const root = createRoot(container);

  root.render(
    <UIProvider>
      <ContentProvider>
        <SidebarPlatformProvider>
          <SidebarChatProvider>
            <SidebarApp />
          </SidebarChatProvider>
        </SidebarPlatformProvider>
      </ContentProvider>
    </UIProvider>
  );
});

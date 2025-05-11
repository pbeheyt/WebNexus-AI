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

  const urlParams = new URLSearchParams(window.location.search);
  const tabId = parseInt(urlParams.get('tabId'), 10);

  if (isNaN(tabId)) {
    console.error('[Sidebar Index] Invalid or missing tabId in URL.');
    // Optionally render an error message in the sidebar
    root.render(<div>Error: Missing Tab ID. Cannot initialize sidebar.</div>);
  } else {
    root.render(
      <UIProvider>
        <ContentProvider>
          <SidebarPlatformProvider tabId={tabId}>
            <SidebarChatProvider tabId={tabId}>
              <SidebarApp tabId={tabId} /> {/* Ensure tabId is passed here */}
            </SidebarChatProvider>
          </SidebarPlatformProvider>
        </ContentProvider>
      </UIProvider>
    );
  }
});

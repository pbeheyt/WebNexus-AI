import React from 'react';
import { createRoot } from 'react-dom/client';

import { UIProvider } from '../contexts/UIContext';
import { SidePanelPlatformProvider } from '../contexts/platform';
import { ContentProvider } from '../contexts/ContentContext';
import { NotificationProvider } from '../components';

import { SidePanelChatProvider } from './contexts/SidePanelChatContext';
import SidePanelApp from './SidePanelApp';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('sidepanel-root');
  const root = createRoot(container);

  const urlParams = new URLSearchParams(window.location.search);
  const tabId = parseInt(urlParams.get('tabId'), 10);

  if (isNaN(tabId)) {
    console.error('[Sidepanel Index] Invalid or missing tabId in URL.');
    // Optionally render an error message in the sidepanel
    root.render(
      <div>Error: Missing Tab ID. Cannot initialize Side Panel.</div>
    );
  } else {
    root.render(
      <UIProvider>
        <NotificationProvider> {/* Added NotificationProvider wrapper */}
          <ContentProvider>
            <SidePanelPlatformProvider tabId={tabId}>
              <SidePanelChatProvider tabId={tabId}>
                <SidePanelApp tabId={tabId} />
              </SidePanelChatProvider>
            </SidePanelPlatformProvider>
          </ContentProvider>
        </NotificationProvider> {/* Closing NotificationProvider wrapper */}
      </UIProvider>
    );
  }
});

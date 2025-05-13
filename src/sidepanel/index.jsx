import React from 'react';
import { createRoot } from 'react-dom/client';

import { UIProvider } from '../contexts/UIContext';
import { SidepanelPlatformProvider } from '../contexts/platform';
import { ContentProvider } from '../contexts/ContentContext';

import { SidepanelChatProvider } from './contexts/SidepanelChatContext';
import SidepanelApp from './SidepanelApp';
import '../styles/index.css';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('sidebar-root');
  const root = createRoot(container);

  const urlParams = new URLSearchParams(window.location.search);
  const tabId = parseInt(urlParams.get('tabId'), 10);

  if (isNaN(tabId)) {
    console.error('[Sidepanel Index] Invalid or missing tabId in URL.');
    // Optionally render an error message in the sidepanel
    root.render(<div>Error: Missing Tab ID. Cannot initialize Side Panel.</div>);
  } else {
    root.render(
      <UIProvider>
        <ContentProvider>
          <SidepanelPlatformProvider tabId={tabId}>
            <SidepanelChatProvider tabId={tabId}>
              <SidepanelApp tabId={tabId} /> {/* Ensure tabId is passed here */}
            </SidepanelChatProvider>
          </SidepanelPlatformProvider>
        </ContentProvider>
      </UIProvider>
    );
  }
});

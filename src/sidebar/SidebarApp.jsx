// src/sidebar/SidebarApp.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useSidebarPlatform } from '../contexts/platform';
import { useSidebarChat } from './contexts/SidebarChatContext';
import { useContent } from '../contexts/ContentContext';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import { UserInput } from './components/UserInput'; 
import { AppHeader } from '../components'; 

export default function SidebarApp() {
  const { tabId, setTabId } = useSidebarPlatform();
  const { resetCurrentTabData, clearFormattedContentForTab } = useSidebarChat();
  const { updateContentContext } = useContent();
  const [isReady, setIsReady] = useState(false); // Tracks if tabId initialization is complete
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const portRef = useRef(null);

  // --- Effect to determine Tab ID ---
  useEffect(() => {
    console.info('SidebarApp mounted, attempting to determine tab context...');
    let foundTabId = NaN; // Use a local variable first

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabIdFromUrl = urlParams.get('tabId');
      const parsedTabId = tabIdFromUrl ? parseInt(tabIdFromUrl, 10) : NaN;

      if (tabIdFromUrl && !isNaN(parsedTabId)) {
        console.info(`Found valid tabId ${parsedTabId} in URL.`);
        foundTabId = parsedTabId;
      } else {
        console.error('FATAL: Sidebar loaded without a valid tabId in URL. Cannot initialize.');
        // Keep foundTabId as NaN
      }
    } catch (error) {
      console.error('Error parsing tabId from URL:', error);
      // Keep foundTabId as NaN
    }

    // Set the tabId in context *if* it's valid
    if (!isNaN(foundTabId)) {
      setTabId(foundTabId);
    }

    // Mark as ready (or not) based on whether a valid ID was found
    // Use a small timeout to allow initial rendering before potentially heavy context updates
    const timer = setTimeout(() => {
        setIsReady(!isNaN(foundTabId));
        console.info(`Sidebar initialization complete. isReady: ${!isNaN(foundTabId)}, tabId set to: ${foundTabId}`);
    }, 50); // Small delay 50ms

    return () => clearTimeout(timer); // Cleanup timeout on unmount/re-run

  }, [setTabId]); // Dependency ensures it runs once when setTabId is available

  // --- Effect for Page Navigation Listener ---
  useEffect(() => {
    // Only run if we have a valid tabId and are ready
    if (!isReady || !tabId) {
      console.info(`Skipping pageNavigated listener setup (isReady: ${isReady}, tabId: ${tabId})`);
      return;
    }

    const messageListener = (message, sender, sendResponse) => {
      // Ensure the message is for *this* sidebar instance's tab
      if (message.action === 'pageNavigated' && message.tabId === tabId) {
        console.info(`Received pageNavigated event for current tab ${tabId}:`, message);
        try {
          // Update the content context with the new URL and type
          updateContentContext(message.newUrl, message.newContentType);
          console.info(`Content context updated for tab ${tabId} to URL: ${message.newUrl}, Type: ${message.newContentType}`);
        } catch (error) {
          console.error(`Error handling pageNavigated event for tab ${tabId}:`, error);
        }
      }
    };

    // Ensure chrome APIs are available before adding listener
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
      console.info(`Added runtime message listener for pageNavigated events (tabId: ${tabId})`);
    } else {
      console.warn("Chrome runtime API not available for message listener.");
    }

    // Cleanup function
    return () => {
      if (chrome && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
        console.info(`Removed runtime message listener for pageNavigated events (tabId: ${tabId})`);
      }
    };
    // Dependencies: run when tabId is confirmed, or context functions change
  }, [isReady, tabId, updateContentContext, resetCurrentTabData]); // Added isReady, resetCurrentTabData

  // --- Effect for Background Connection Port ---
  useEffect(() => {
    // Only run if we have a valid tabId and are ready
    if (!isReady || !tabId) {
      console.info(`Skipping background port connection (isReady: ${isReady}, tabId: ${tabId})`);
      return;
    }

    // Prevent reconnecting if already connected
    if (portRef.current) {
        console.log(`[SidebarApp] Port already exists for tab ${tabId}. Skipping reconnection.`);
        return;
    }

    // Ensure chrome APIs are available
    if (!(chrome && chrome.runtime && chrome.runtime.connect)) {
        console.warn("[SidebarApp] Chrome runtime connect API not available.");
        return;
    }

    const portName = `sidepanel-connect-${tabId}`;
    console.log(`[SidebarApp] Attempting to connect to background with name: ${portName}`);
    try {
      portRef.current = chrome.runtime.connect({ name: portName });
      console.log(`[SidebarApp] Connection established for tab ${tabId}`, portRef.current);

      portRef.current.onDisconnect.addListener(() => {
        console.log(`[SidebarApp] Port disconnected for tab ${tabId}.`);
        if (chrome.runtime.lastError) {
          console.error(`[SidebarApp] Disconnect error for tab ${tabId}:`, chrome.runtime.lastError.message);
        }
        portRef.current = null; // Clear the ref on disconnect
      });

    } catch (error) {
      console.error(`[SidebarApp] Error connecting to background for tab ${tabId}:`, error);
      portRef.current = null; // Ensure ref is null on error
    }

    // Cleanup function: Disconnect the port when the component unmounts or tabId/isReady changes
    return () => {
      if (portRef.current) {
        console.log(`[SidebarApp] Disconnecting port for tab ${tabId} due to cleanup.`);
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, [isReady, tabId]); // Re-run effect if isReady or tabId changes

  // --- Render Logic ---
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-theme-primary text-theme-primary">
      {!isReady ? (
        // ----- Loading State -----
        // Show spinner while isReady is false (during initial tabId determination)
        <div className="flex h-full w-full items-center justify-center" aria-live="polite" aria-busy="true">
          <div className="w-6 h-6 border-4 border-theme-secondary border-t-transparent rounded-full animate-spin" role="status">
             <span className="sr-only">Loading sidebar...</span> {/* Accessibility */}
          </div>
        </div>
      ) : tabId ? (
        // ----- Ready State -----
        // Show main content only when isReady is true AND tabId is valid
        <>
          <AppHeader
            showRefreshButton={true}
            onRefreshClick={resetCurrentTabData}
            isExpanded={headerExpanded}
            onToggleExpand={() => setHeaderExpanded(!headerExpanded)}
            showExpandToggle={true}
            showBorder={true}
            className='px-5 py-2 flex-shrink-0' // Prevent header from shrinking
          />

          {/* Collapsible header section */}
          <div className="relative flex-shrink-0 z-10">
            <div
              className={`transition-all duration-300 ease-in-out border-b border-theme ${
                headerExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 invisible' // Keep invisible when collapsed
              }`}
              // Add aria-hidden based on expansion state for accessibility
              aria-hidden={!headerExpanded}
            >
              {/* Conditionally render Header to prevent potential issues when hidden */}
              {headerExpanded && <Header />}
            </div>
          </div>

          {/* Make ChatArea flexible and ensure it's behind the header dropdowns */}
          <ChatArea className="flex-1 min-h-0 relative z-0" /> {/* Ensure ChatArea can grow/shrink*/}

          {/* User input at the bottom */}
          <UserInput className="flex-shrink-0 relative z-10 border-t border-theme" /> {/* Ensure input is above chat area visually */}
        </>
      ) : (
        // ----- Error State -----
        // Show error if ready check finished (isReady=true) but tabId is still invalid (e.g., NaN)
         <div className="flex flex-col h-full w-full items-center justify-center p-4">
           <div className="text-center text-error">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
             <p className="font-semibold">Initialization Error</p>
             <p className="text-sm">Sidebar context could not be determined.</p>
             <p className="text-xs mt-2">(Missing or invalid tabId)</p>
           </div>
         </div>
      )}
    </div>
  );
}
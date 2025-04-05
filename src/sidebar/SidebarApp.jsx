import React, { useEffect, useState } from 'react';
// Removed unused useTheme import
import { useSidebarPlatform } from '../contexts/platform'; // Keep this for setTabId
import { useSidebarChat } from './contexts/SidebarChatContext';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import { UserInput } from './components/UserInput';
import { AppHeader } from '../components';
import logger from '../shared/logger'; // Import logger

export default function SidebarApp() {
  // Removed unused theme variable
  const { tabId, setTabId } = useSidebarPlatform(); // Get setTabId
  const { resetCurrentTabData } = useSidebarChat(); // Removed resetExtractionFlag
  const [isReady, setIsReady] = useState(false);
  // Removed updateContentContext state
  // Removed messaging state
  const [headerExpanded, setHeaderExpanded] = useState(true);

  // Parse Tab ID from URL on mount, with fallback to background message
  useEffect(() => {
    logger.sidebar.info('SidebarApp mounted, attempting to determine tab context...');
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabIdFromUrl = urlParams.get('tabId'); // Keep only one declaration
      const parsedTabId = tabIdFromUrl ? parseInt(tabIdFromUrl, 10) : NaN;

      // Check if tabIdFromUrl exists and is a valid number
      if (tabIdFromUrl && !isNaN(parsedTabId)) {
        // Removed redundant info log
        setTabId(parsedTabId);
        setIsReady(true);
      } else {
        // Log critical error if tabId is missing or invalid in the URL
        logger.sidebar.error('FATAL: Sidebar loaded without a valid tabId in URL. Cannot initialize.'); // Updated log message
        setIsReady(false);
      }
    } catch (error) {
      // Log errors during URL parsing or other synchronous issues in the try block
      logger.sidebar.error('Error during initial tabId processing:', error);
      setIsReady(false);
    }
  }, [setTabId]); // Dependency ensures it runs when setTabId is available

  // Removed useEffect for IframeMessaging initialization and pageNavigated handler
  // Removed useEffect for sending THEME_CHANGED and SIDEBAR_READY via IframeMessaging

  // Removed handleClose function

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-theme-primary text-theme-primary">
      {isReady && tabId ? ( // Ensure tabId is also set before rendering main content
        <>
          <div className="p-4 pb-0">
            <AppHeader
              // Removed onClose prop
              showRefreshButton={true}
              onRefreshClick={resetCurrentTabData}
              isExpanded={headerExpanded}
              onToggleExpand={() => setHeaderExpanded(!headerExpanded)}
              showExpandToggle={true}
            />
          </div>

          {/* Collapsible header section */}
          <div className="relative">
            {/* Fully collapsible section containing Header */}
            <div
              className={`transition-all duration-300 ease-in-out border-b border-theme ${ // Added border classes here
                headerExpanded ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >

              {/* Platform/model selection header */}
              <Header />
            </div>
          </div>

          <ChatArea/>
          <UserInput/>
        </>
      ) : (
        // Render error message when not ready and tabId is null
        !isReady && tabId === null && (
          <div className="flex flex-col h-screen w-full overflow-hidden bg-theme-primary text-theme-primary items-center justify-center p-4">
            <div className="text-center text-error">
              <p className="font-semibold">Initialization Error</p>
              <p className="text-sm">Sidebar context could not be determined.</p>
              <p className="text-xs mt-2">(Missing tabId in URL)</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

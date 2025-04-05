import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useSidebarPlatform } from '../contexts/platform'; // Keep this for setTabId
import { useSidebarChat } from './contexts/SidebarChatContext';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import { UserInput } from './components/UserInput';
import { AppHeader } from '../components'; // Removed useContent if no longer needed
// Removed MESSAGE_TYPES and setupMessageHandlers imports
// Removed logger import

export default function SidebarApp() {
  const { theme } = useTheme();
  const { tabId, setTabId } = useSidebarPlatform(); // Get setTabId
  const { resetCurrentTabData } = useSidebarChat(); // Removed resetExtractionFlag
  const [isReady, setIsReady] = useState(false);
  // Removed updateContentContext state
  // Removed messaging state
  const [headerExpanded, setHeaderExpanded] = useState(true);

  // Parse Tab ID from URL on mount
  useEffect(() => {
    console.log('SidebarApp mounted, parsing context from URL...');
    const urlParams = new URLSearchParams(window.location.search);
    const tabIdFromUrl = urlParams.get('tabId');

    if (tabIdFromUrl) {
      const parsedTabId = parseInt(tabIdFromUrl, 10);
      if (!isNaN(parsedTabId)) {
        console.log(`Received tabId from URL: ${parsedTabId}`);
        setTabId(parsedTabId); // Update context using the prop setter from useSidebarPlatform
        setIsReady(true); // Panel is ready
      } else {
        console.error('Failed to parse valid tabId from URL parameter:', tabIdFromUrl);
        setIsReady(false); // Indicate error state
      }
    } else {
      console.error('tabId parameter missing from URL. Sidebar cannot function.');
      setIsReady(false); // Indicate error state
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
        // Render nothing or a placeholder while loading
        null
      )}
    </div>
  );
}

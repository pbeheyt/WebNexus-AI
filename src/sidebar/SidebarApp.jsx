import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useSidebarPlatform } from '../contexts/platform';
import { useSidebarChat } from './contexts/SidebarChatContext';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import { UserInput } from './components/UserInput';
import { useContent, AppHeader } from '../components'; // useContent already imported
import { MESSAGE_TYPES } from './constants';
import { setupMessageHandlers } from './services/IframeMessaging';

export default function SidebarApp() {
  const { theme } = useTheme();
  const { tabId } = useSidebarPlatform();
  const { resetCurrentTabData, resetExtractionFlag } = useSidebarChat(); // Get resetExtractionFlag
  const [isReady, setIsReady] = useState(false);
  const { updateContentContext } = useContent(); // Get updateContentContext
  const [messaging, setMessaging] = useState(null);
  const [headerExpanded, setHeaderExpanded] = useState(true);
  
  // Initialize messaging with tabId and set up message handlers
  useEffect(() => {
    if (tabId) {
      const messagingService = setupMessageHandlers(tabId);
      setMessaging(messagingService);

      // Register handler for page navigation events from content script
      messagingService.registerHandler('pageNavigated', (data) => {
        console.log('SidebarApp received pageNavigated:', data);
        if (data.newUrl && data.newContentType) {
          updateContentContext(data.newUrl, data.newContentType);
          resetExtractionFlag();
        } else {
          console.warn('pageNavigated message missing data:', data);
        }
      });

      // Cleanup function to remove handlers if needed (though setupMessageHandlers might handle this)
      // return () => {
      //   messagingService.removeHandler('pageNavigated');
      // };
    }
  }, [tabId, updateContentContext, resetExtractionFlag]); // Add dependencies
  
  useEffect(() => {
    if (!messaging) return;
    
    // Update parent frame about theme changes
    const notifyParentAboutTheme = () => {
      messaging.sendMessage(MESSAGE_TYPES.THEME_CHANGED, { theme });
    };
    
    // Run once on mount and whenever theme changes
    notifyParentAboutTheme();
    
    // Signal to parent that sidebar is ready
    setTimeout(() => {
      messaging.sendMessage(MESSAGE_TYPES.SIDEBAR_READY, { tabId });
      setIsReady(true);
    }, 200);
    
  }, [theme, tabId, messaging]);
  
  // Handle sidebar close button
  const handleClose = () => {
    if (messaging) {
      messaging.sendMessage(MESSAGE_TYPES.TOGGLE_SIDEBAR, { 
        visible: false,
        tabId
      });
    }
  };
  
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-theme-primary text-theme-primary">
      {isReady ? (
        <>
          <div className="p-4 pb-0">
            <AppHeader 
              onClose={handleClose} 
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

import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useSidebarPlatform } from '../contexts/platform';
import { useSidebarChat } from './contexts/SidebarChatContext';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import UserInput from './components/UserInput';
import { useContent, AppHeader, ContentTypeDisplay } from '../components';
import { MESSAGE_TYPES } from './constants';
import { setupMessageHandlers } from './services/IframeMessaging';

export default function SidebarApp() {
  const { theme } = useTheme();
  const { tabId } = useSidebarPlatform();
  const { resetCurrentTabData } = useSidebarChat();
  const [isReady, setIsReady] = useState(false);
  const { contentType } = useContent();
  const [messaging, setMessaging] = useState(null);
  const [headerExpanded, setHeaderExpanded] = useState(true);
  
  // Initialize messaging with tabId
  useEffect(() => {
    if (tabId) {
      const messagingService = setupMessageHandlers(tabId);
      setMessaging(messagingService);
    }
  }, [tabId]);
  
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
  
  if (!isReady || !tabId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="w-5 h-5 border-2 border-gray-200 dark:border-gray-700 border-t-primary rounded-full animate-spin mr-2"></div>
        Initializing sidebar...
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-theme-primary text-theme-primary">
      <div className="p-4 pb-0">
        <AppHeader 
          onClose={handleClose} 
          showRefreshButton={true} 
          onRefreshClick={resetCurrentTabData}
        />
      </div>
      
      {/* Collapsible header section with fixed toggle button */}
      <div className="relative">
        {/* Persistent toggle button that remains visible regardless of expansion state */}
        <div className="absolute right-4 top-3 z-10">
          <button
            onClick={() => setHeaderExpanded(!headerExpanded)}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
            title={headerExpanded ? "Collapse header" : "Expand header"}
            aria-expanded={headerExpanded}
          >
            <svg className={`w-3 h-3 transition-transform ${headerExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 9l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        {/* Fully collapsible section containing both ContentTypeDisplay and Header */}
        <div 
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            headerExpanded ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          {/* Content type display with appropriate spacing */}
          <div className="px-4 pt-2">
            <div className="pr-10">
              <ContentTypeDisplay />
            </div>
          </div>
          
          {/* Platform/model selection header */}
          <Header />
        </div>
      </div>
      
      <ChatArea/>
      <UserInput/>
    </div>
  );
}
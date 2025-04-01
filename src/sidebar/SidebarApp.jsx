import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useSidebarPlatform } from '../contexts/platform';
import Header from './components/Header'; // This is the modified header (platform/model selection)
import ChatArea from './components/ChatArea';
import UserInput from './components/UserInput';
import { useContent, AppHeader } from '../components'; // Import AppHeader
import { MESSAGE_TYPES } from './constants';
import { setupMessageHandlers } from './services/IframeMessaging';

export default function SidebarApp() {
  const { theme } = useTheme();
  const { tabId } = useSidebarPlatform();
  const [isReady, setIsReady] = useState(false);
  const { contentType } = useContent();
  const [messaging, setMessaging] = useState(null);
  
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
    <div className="flex flex-col h-screen w-full overflow-hidden bg-theme-primary text-theme-primary"> {/* Added theme classes */}
      <div className="p-4 pb-0"> {/* Added padding wrapper for AppHeader */}
        <AppHeader>
          {/* Close button */}
          <button
            onClick={handleClose}
            className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
            title="Close Sidebar"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
              <path d="M18 6L6 18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 6L18 18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </AppHeader>
      </div>
      {/* Modified Header (Platform/Model Selection) - No longer needs onClose */}
      <Header />
      <ChatArea/>
      <UserInput/>
    </div>
  );
}

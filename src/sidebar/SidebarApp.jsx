import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useSidebarPlatform } from '../contexts/platform';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import UserInput from './components/UserInput';
import { useContent } from '../components';
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
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <Header onClose={handleClose} />
      <ChatArea />
      <UserInput />
    </div>
  );
}
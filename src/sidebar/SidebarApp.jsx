import React, { useEffect, useState } from 'react';
import { SidebarPlatformProvider } from './contexts/SidebarPlatformContext';
import { SidebarChatProvider } from './contexts/SidebarChatContext';
import { SidebarThemeProvider } from './contexts/SidebarThemeContext';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import UserInput from './components/UserInput';
import { MESSAGE_TYPES } from './constants';

export default function SidebarApp() {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Set up message listener for parent frame communication
    const handleMessage = (event) => {
      // Process messages from parent frame
      if (!event.data || typeof event.data !== 'object') {
        return;
      }
      
      switch (event.data.type) {
        case MESSAGE_TYPES.EXTRACTION_COMPLETE:
          // Handle extraction completion
          console.log('Content extraction complete:', event.data.content);
          break;
          
        case MESSAGE_TYPES.PAGE_INFO_UPDATED:
          // Handle page info update
          console.log('Page info updated:', event.data.pageInfo);
          break;
          
        case MESSAGE_TYPES.THEME_CHANGED:
          // Handle theme change from parent
          console.log('Theme changed:', event.data.theme);
          document.documentElement.setAttribute('data-theme', event.data.theme);
          break;
          
        default:
          // Ignore unknown message types
          break;
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Signal to parent that sidebar is ready
    setTimeout(() => {
      window.parent.postMessage({ type: MESSAGE_TYPES.SIDEBAR_READY }, '*');
      setIsReady(true);
    }, 200);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);
  
  // Handle sidebar close button
  const handleClose = () => {
    window.parent.postMessage({ type: MESSAGE_TYPES.TOGGLE_SIDEBAR, visible: false }, '*');
  };
  
  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="w-5 h-5 border-2 border-gray-200 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin mr-2"></div>
        Initializing sidebar...
      </div>
    );
  }
  
  return (
    <SidebarThemeProvider>
      <SidebarPlatformProvider>
        <SidebarChatProvider>
          <div className="flex flex-col h-screen w-full overflow-hidden">
            <Header onClose={handleClose} />
            <ChatArea />
            <UserInput />
          </div>
        </SidebarChatProvider>
      </SidebarPlatformProvider>
    </SidebarThemeProvider>
  );
}
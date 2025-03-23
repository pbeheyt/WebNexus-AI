// src/sidebar/SidebarApp.jsx
import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useSidebarPlatform } from '../contexts/platform';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import UserInput from './components/UserInput';
import { ContentTypeDisplay, useContent } from '../components';
import { MESSAGE_TYPES } from './constants';

export default function SidebarApp() {
  const { theme } = useTheme();
  const { tabId } = useSidebarPlatform();
  const [isReady, setIsReady] = useState(false);
  const { contentType, isLoading, isTextSelected } = useContent();
  
  useEffect(() => {
    // Set up message listener for parent frame communication
    const handleMessage = (event) => {
      // Process messages from parent frame
      if (!event.data || typeof event.data !== 'object') {
        return;
      }
      
      switch (event.data.type) {
        case MESSAGE_TYPES.EXTRACTION_COMPLETE:
          console.log('Content extraction complete:', event.data.content);
          break;
          
        case MESSAGE_TYPES.PAGE_INFO_UPDATED:
          console.log('Page info updated:', event.data.pageInfo);
          break;
          
        case MESSAGE_TYPES.THEME_CHANGED:
          // No need to use direct service, theme context will handle it
          console.log('Theme changed from parent:', event.data.theme);
          break;
          
        default:
          break;
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Update parent frame about theme changes
    const notifyParentAboutTheme = () => {
      window.parent.postMessage({ 
        type: MESSAGE_TYPES.THEME_CHANGED, 
        theme 
      }, '*');
    };
    
    // Run once on mount and whenever theme changes
    notifyParentAboutTheme();
    
    // Signal to parent that sidebar is ready
    setTimeout(() => {
      window.parent.postMessage({ 
        type: MESSAGE_TYPES.SIDEBAR_READY,
        tabId // Include tabId in the ready message
      }, '*');
      setIsReady(true);
    }, 200);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [theme, tabId]);
  
  // Handle sidebar close button
  const handleClose = () => {
    window.parent.postMessage({ 
      type: MESSAGE_TYPES.TOGGLE_SIDEBAR, 
      visible: false,
      tabId // Include tabId in close message
    }, '*');
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
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <Header onClose={handleClose} />
      <div className="p-2">
        <ContentTypeDisplay className="w-full" />
      </div>
      <ChatArea />
      <UserInput />
    </div>
  );
}
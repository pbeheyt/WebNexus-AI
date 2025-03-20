import React, { createContext, useContext, useEffect, useState } from 'react';
import { CONTENT_TYPES } from '../../shared/constants';
import { determineContentType } from '../../shared/content-utils';

const SidebarContentContext = createContext(null);

export function SidebarContentProvider({ children }) {
  const [currentTab, setCurrentTab] = useState(null);
  const [contentType, setContentType] = useState(CONTENT_TYPES.GENERAL);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  // Detect current tab and content type
  useEffect(() => {
    const detectContent = async () => {
      try {
        setIsLoading(true);
        // Get current tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        
        if (!tab || !tab.url) {
          setIsSupported(false);
          throw new Error("Cannot access current tab");
        }
        
        setCurrentTab(tab);
        
        // Check for text selection
        const hasSelection = await checkForTextSelection(tab.id);
        setIsTextSelected(hasSelection);
        
        // Determine content type
        const detectedType = determineContentType(tab.url, hasSelection);
        setContentType(detectedType);
        setIsSupported(true);
      } catch (error) {
        console.error('Content detection error:', error);
        setIsSupported(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    detectContent();
    
    // Set up polling for text selection changes
    const selectionInterval = setInterval(async () => {
      if (currentTab?.id) {
        const hasSelection = await checkForTextSelection(currentTab.id);
        
        if (hasSelection !== isTextSelected) {
          setIsTextSelected(hasSelection);
          // Update content type if selection state changed
          if (currentTab?.url) {
            const newType = determineContentType(currentTab.url, hasSelection);
            setContentType(newType);
          }
        }
      }
    }, 1000);
    
    return () => clearInterval(selectionInterval);
  }, []);
  
  // Helper function to check for text selection
  const checkForTextSelection = async (tabId) => {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const selection = window.getSelection();
          return selection && selection.toString().trim().length > 0;
        }
      });
      return results?.[0]?.result || false;
    } catch (error) {
      console.error('Error checking for text selection:', error);
      return false;
    }
  };
  
  return (
    <SidebarContentContext.Provider 
      value={{ 
        currentTab,
        contentType,
        isTextSelected,
        isSupported,
        isLoading
      }}
    >
      {children}
    </SidebarContentContext.Provider>
  );
}

export const useSidebarContent = () => useContext(SidebarContentContext);
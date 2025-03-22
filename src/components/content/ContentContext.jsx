// src/components/content/ContentContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CONTENT_TYPES } from '../../shared/constants';
import { determineContentType } from '../../shared/content-utils';

const ContentContext = createContext(null);

/**
 * Provider component for content detection and type management.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {boolean} [props.detectOnMount=true] - Whether to detect content type on mount
 * @param {boolean} [props.pollSelection=true] - Whether to poll for text selection changes
 * @param {number} [props.pollInterval=1000] - Interval in ms for polling text selection
 */
export function ContentProvider({ 
  children, 
  detectOnMount = true,
  pollSelection = true,
  pollInterval = 1000
}) {
  const [currentTab, setCurrentTab] = useState(null);
  const [contentType, setContentType] = useState(null);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  /**
   * Check for text selection in the specified tab
   */
  const checkForTextSelection = useCallback(async (tabId) => {
    if (!chrome?.scripting?.executeScript) {
      return false;
    }
    
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
  }, []);
  
  /**
   * Detect the current tab and content type
   */
  const detectContent = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Check if chrome API is available
      if (!chrome?.tabs?.query) {
        setIsSupported(false);
        throw new Error("Chrome extension API not available");
      }
      
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
  }, [checkForTextSelection]);
  
  /**
   * Check for changes in text selection
   */
  const checkSelectionChanges = useCallback(async () => {
    if (!currentTab?.id) return;
    
    const hasSelection = await checkForTextSelection(currentTab.id);
    
    if (hasSelection !== isTextSelected) {
      setIsTextSelected(hasSelection);
      
      // Update content type if selection state changed
      if (currentTab?.url) {
        const newType = determineContentType(currentTab.url, hasSelection);
        setContentType(newType);
      }
    }
  }, [currentTab, isTextSelected, checkForTextSelection]);
  
  // Initialize content detection
  useEffect(() => {
    if (detectOnMount) {
      detectContent();
    }
  }, [detectOnMount, detectContent]);
  
  // Set up polling for text selection changes if enabled
  useEffect(() => {
    if (!pollSelection) return;
    
    const selectionInterval = setInterval(checkSelectionChanges, pollInterval);
    
    return () => clearInterval(selectionInterval);
  }, [pollSelection, pollInterval, checkSelectionChanges]);
  
  // Public methods
  const refreshContent = useCallback(() => {
    detectContent();
  }, [detectContent]);
  
  const setManualContentType = useCallback((type) => {
    setContentType(type);
  }, []);
  
  return (
    <ContentContext.Provider 
      value={{ 
        currentTab,
        contentType,
        isTextSelected,
        isSupported,
        isLoading,
        refreshContent,
        setContentType: setManualContentType
      }}
    >
      {children}
    </ContentContext.Provider>
  );
}

/**
 * Hook to access the content context
 * @returns {Object} The content context
 */
export const useContent = () => {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContent must be used within a ContentProvider');
  }
  return context;
};
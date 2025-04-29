// src/components/content/ContentContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';

import {
  determineContentType,
  isInjectablePage,
} from '../shared/utils/content-utils';
import { logger } from '../shared/logger';

const ContentContext = createContext(null);

/**
 * Provider component for content detection and type management.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {boolean} [props.detectOnMount=true] - Whether to detect content type on mount
 */
export function ContentProvider({ children, detectOnMount = true }) {
  const [currentTab, setCurrentTab] = useState(null);
  const [contentType, setContentType] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isInjectable, setIsInjectable] = useState(true);

  /**
   * Detect the current tab and content type
   */
  const detectContent = useCallback(async () => {
    try {
      setIsLoading(true);

      // Check if chrome API is available
      if (!chrome?.tabs?.query) {
        setIsSupported(false);
        throw new Error('Chrome extension API not available');
      }

      // Get current tab
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tab = tabs[0];

      if (!tab || !tab.url) {
        setIsSupported(false);
        throw new Error('Cannot access current tab');
      }

      const injectable = isInjectablePage(tab.url);
      setIsInjectable(injectable);
      setCurrentTab(tab);

      // Determine content type based solely on URL
      const detectedType = determineContentType(tab.url);
      setContentType(detectedType);
      setIsSupported(true);
    } catch (error) {
      logger.popup.error('Content detection error:', error);
      setIsSupported(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize content detection
  useEffect(() => {
    if (detectOnMount) {
      detectContent();
    }
  }, [detectOnMount, detectContent]);

  // Public methods
  const refreshContent = useCallback(() => {
    detectContent();
  }, [detectContent]);

  const setManualContentType = useCallback((type) => {
    setContentType(type);
  }, []);

  // Function to update context from external events (like page navigation)
  const updateContentContext = useCallback((newUrl, newContentType) => {
    const injectable = isInjectablePage(newUrl);
    setIsInjectable(injectable);
    setCurrentTab((prevTab) => ({ ...(prevTab || {}), url: newUrl }));
    setContentType(newContentType);
  }, []);

  return (
    <ContentContext.Provider
      value={{
        currentTab,
        contentType,
        isSupported,
        isLoading,
        isInjectable,
        refreshContent,
        setContentType: setManualContentType,
        updateContentContext,
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

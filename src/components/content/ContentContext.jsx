// src/components/content/ContentContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CONTENT_TYPES, STORAGE_KEYS } from '../../shared/constants'; // Added STORAGE_KEYS
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
  pollSelection = true, // Kept for potential future use, but SELECTED_TEXT is removed
  pollInterval = 1000
}) {
  const [currentTab, setCurrentTab] = useState(null);
  const [contentType, setContentType] = useState(null);
  const [isTextSelected, setIsTextSelected] = useState(false); // Kept for future
  const [isSupported, setIsSupported] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtractionEnabled, setIsExtractionEnabled] = useState(true); // New state

  /**
   * Check for text selection in the specified tab
   */
  const checkForTextSelection = useCallback(async (tabId) => {
    if (!chrome?.scripting?.executeScript || !tabId) {
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
      // Ignore errors if tab/scripting is unavailable
      if (!error.message.includes('No tab with id') && !error.message.includes('Cannot access contents')) {
          console.error('Error checking for text selection:', error);
      }
      return false;
    }
  }, []);

  /**
   * Detect the current tab, content type, and load extraction preference
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

      if (!tab || !tab.url || !tab.id) {
        setIsSupported(false);
        throw new Error("Cannot access current tab");
      }

      setCurrentTab(tab);

      // Determine content type (ignoring selection now)
      const detectedType = determineContentType(tab.url, false); // Always pass false for hasSelection
      setContentType(detectedType);

      // Load extraction preference for this tab
      try {
          const response = await chrome.runtime.sendMessage({
              action: 'getTabExtractionPreference',
              tabId: tab.id
          });
          if (response && response.success) {
              setIsExtractionEnabled(response.isEnabled);
          } else {
              setIsExtractionEnabled(true); // Default to true on error
              console.warn('Failed to get extraction preference, defaulting to true');
          }
      } catch (err) {
          setIsExtractionEnabled(true); // Default to true on communication error
          console.error('Error getting extraction preference:', err);
      }

      setIsSupported(true);
    } catch (error) {
      console.error('Content detection error:', error);
      setIsSupported(false);
    } finally {
      setIsLoading(false);
    }
  }, []); // Removed checkForTextSelection dependency

  // Initialize content detection
  useEffect(() => {
    if (detectOnMount) {
      detectContent();
    }
  }, [detectOnMount, detectContent]);

  // Poll for selection changes (kept for future, but doesn't affect contentType anymore)
  useEffect(() => {
    if (!pollSelection || !currentTab?.id) return () => {};

    const selectionInterval = setInterval(async () => {
        const hasSelection = await checkForTextSelection(currentTab.id);
        setIsTextSelected(hasSelection);
    }, pollInterval);

    return () => clearInterval(selectionInterval);
  }, [pollSelection, pollInterval, currentTab, checkForTextSelection]);

  // Public method to refresh content detection
  const refreshContent = useCallback(() => {
    detectContent();
  }, [detectContent]);

  // Public method to update extraction preference
  const updateExtractionPreference = useCallback(async (isEnabled) => {
      if (!currentTab?.id) return;

      setIsExtractionEnabled(isEnabled); // Update local state immediately

      try {
          await chrome.runtime.sendMessage({
              action: 'setTabExtractionPreference',
              tabId: currentTab.id,
              isEnabled: isEnabled
          });
      } catch (error) {
          console.error('Error setting extraction preference:', error);
          // Optionally revert state or show error to user
      }
  }, [currentTab]);

  return (
    <ContentContext.Provider
      value={{
        currentTab,
        contentType,
        isTextSelected, // Kept for potential future use
        isSupported,
        isLoading,
        isExtractionEnabled, // Expose state
        updateExtractionPreference, // Expose update function
        refreshContent,
        // setContentType removed as it's determined internally now
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
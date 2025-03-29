// src/popup/Popup.jsx
import { useEffect, useState } from 'react';
import { usePrompts } from './contexts/PromptContext';
import { useTheme } from '../contexts/ThemeContext';
import { useStatus } from './contexts/StatusContext';
import { usePopupPlatform } from '../contexts/platform';
import { Button } from '../components';
import { StatusMessage } from '../components';
import { Toast } from '../components';
import { useContent, ContentTypeDisplay } from '../components';
import { PlatformSelector } from './features/PlatformSelector';
import { QuickPromptEditor } from './features/QuickPromptEditor';
import { CustomPromptSelector } from './features/CustomPromptSelector';
import { STORAGE_KEYS } from '../shared/constants';
import { INTERFACE_SOURCES } from '../shared/constants';
import { useContentProcessing } from '../hooks/useContentProcessing';

export function Popup() {
  const { theme, toggleTheme } = useTheme();
  const { contentType, currentTab, isSupported, isLoading: contentLoading } = useContent();
  const { selectedPromptId, quickPromptText } = usePrompts();
  const { selectedPlatformId } = usePopupPlatform();
  const {
    statusMessage,
    updateStatus,
    toastState,
    showToastMessage,
    notifyYouTubeError
  } = useStatus();

  // Use the hook and extract all needed functions and states
  const {
    processContent,
    isProcessing: isProcessingContent
  } = useContentProcessing(INTERFACE_SOURCES.POPUP);

  const [isProcessing, setIsProcessing] = useState(false);

  // Listen for messages from background script (YouTube errors, etc.)
  useEffect(() => {
    const messageListener = (message) => {
      if (message.action === 'youtubeTranscriptError') {
        notifyYouTubeError(message.message || 'Failed to retrieve YouTube transcript.');
        setIsProcessing(false);
      } else if (message.action === 'apiResponseReady') {
        updateStatus('API response ready');
        setIsProcessing(false);
      } else if (message.action === 'apiProcessingError') {
        showToastMessage(`API processing error: ${message.error || 'Unknown error'}`, 'error');
        setIsProcessing(false);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [notifyYouTubeError, updateStatus, showToastMessage]);

  const openSettings = () => {
    try {
      chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error('Could not open options page:', error);
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    }
  };

  // Function to close the popup
  const closePopup = () => {
    window.close();
  };

  // Function to toggle sidebar with auto-close
  const toggleSidebar = async () => {
    try {
      // If we have a current tab, send the toggle message
      if (currentTab?.id) {
        updateStatus('Toggling sidebar...', true);
        
        const response = await chrome.runtime.sendMessage({
          action: 'toggleSidebar',
          tabId: currentTab.id
        });
        
        if (response && response.success) {
          updateStatus(`Sidebar ${response.visible ? 'opened' : 'closed'}`);
          // Auto-close the popup after successful toggle
          window.close();
        } else if (response && response.error) {
          updateStatus(`Error: ${response.error}`);
          showToastMessage(`Failed to toggle sidebar: ${response.error}`, 'error');
        }
      } else {
        showToastMessage('No active tab found', 'error');
      }
    } catch (error) {
      console.error('Error toggling sidebar:', error);
      showToastMessage('Failed to toggle sidebar. Try refreshing the page.', 'error');
      updateStatus('Error toggling sidebar');
    }
  };

  /**
   * Get actual prompt content to use
   * @returns {Promise<string|null>} The prompt content
   */
  const getActualPromptContent = async () => {
    // First check if we have a quick prompt
    if (quickPromptText && quickPromptText.trim()) {
      return quickPromptText.trim();
    }
    
    // If no quick prompt, check for selected custom prompt
    if (selectedPromptId) {
      try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
        
        // First try to find the prompt in the content-specific storage
        let promptContent = result[STORAGE_KEYS.CUSTOM_PROMPTS]?.[contentType]?.prompts?.[selectedPromptId]?.content;

        // If not found, check in the shared storage
        if (!promptContent && result[STORAGE_KEYS.CUSTOM_PROMPTS]?.shared?.prompts?.[selectedPromptId]) {
          promptContent = result[STORAGE_KEYS.CUSTOM_PROMPTS].shared.prompts[selectedPromptId].content;
        }

        return promptContent;
      } catch (error) {
        console.error('Error loading custom prompt:', error);
        return null;
      }
    }
    
    // No valid prompt found
    return null;
  };

  const handleProcess = async () => {
    if (isProcessingContent || isProcessing || !isSupported || contentLoading || !currentTab?.id) return;

    setIsProcessing(true);
    updateStatus('Checking page content...', true);

    try {
      // Get actual prompt content to use
      const promptContent = await getActualPromptContent();

      if (!promptContent) {
        updateStatus('Error: No prompt content available', false);
        setIsProcessing(false);
        showToastMessage('Please enter a Quick Prompt or select a Custom Prompt', 'error');
        return;
      }

      // Clear any existing content in storage
      await chrome.storage.local.set({
        [STORAGE_KEYS.CONTENT_READY]: false,
        [STORAGE_KEYS.EXTRACTED_CONTENT]: null,
        [STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID]: null,
        [STORAGE_KEYS.SCRIPT_INJECTED]: false,
        [STORAGE_KEYS.PRE_PROMPT]: promptContent
      });

      // Process content using the hook (extraction is now handled internally)
      updateStatus(`Processing content with ${selectedPlatformId}...`, true);

      const result = await processContent({
        platformId: selectedPlatformId,
        promptContent: promptContent,
        useApi: false
      });

      if (result.success) {
        updateStatus('Opening AI platform...', true);
      } else {
        updateStatus(`Error: ${result.error || 'Unknown error'}`, false);
        showToastMessage(`Error: ${result.error || 'Unknown error'}`, 'error');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Process error:', error);
      updateStatus(`Error: ${error.message}`, false);
      showToastMessage(`Error: ${error.message}`, 'error');
      setIsProcessing(false);
    }
  };

  // Determine if processing should be enabled
  const shouldEnableProcessing = () => {
    // Either quick prompt text or selected custom prompt must be available
    const hasPrompt = (quickPromptText && quickPromptText.trim()) || selectedPromptId;
    
    return !isProcessingContent && 
           !isProcessing && 
           isSupported && 
           !contentLoading && 
           currentTab?.id && 
           hasPrompt;
  };

  return (
    <div className="min-w-[320px] p-2 bg-theme-primary text-theme-primary">
      <header className="flex items-center justify-between pb-1 mb-1 border-b border-theme">
        <h1 className="text-base font-semibold flex items-center gap-1.5">
          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" fill="currentColor"/>
            <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2"/>
          </svg>
          AI Content Summarizer
        </h1>

        <div className="flex items-center">
          
          {/* Theme toggle button */}
          <button
            onClick={toggleTheme}
            className="p-1 ml-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21.21 12.79z"></path>
              </svg>
            )}
          </button>

          {/* Settings button */}
          <button
            onClick={openSettings}
            className="p-1 ml-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
            title="Manage Custom Prompts"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" stroke="currentColor">
              <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" fill="currentColor"/>
            </svg>
          </button>

          {/* Sidebar toggle button */}
          <button
            onClick={toggleSidebar}
            className="p-1 ml-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
            title="Toggle Sidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" stroke="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
              <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>

          {/* Close button */}
          <button
            onClick={closePopup}
            className="p-1 ml-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
            title="Close Popup"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" stroke="currentColor">
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </header>

      <Button
        onClick={handleProcess}
        disabled={!shouldEnableProcessing()}
        className="w-full mb-2"
      >
        {isProcessingContent || isProcessing ? 'Processing...' : 'Process Content'}
      </Button>

      <ContentTypeDisplay />

      <div className="mt-2">
        <PlatformSelector />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2">
        <QuickPromptEditor />
        <div className="flex items-center justify-center">
          <div className="h-px bg-gray-300 flex-grow"></div>
          <span className="px-2 text-gray-500 text-xs">OR</span>
          <div className="h-px bg-gray-300 flex-grow"></div>
        </div>
        <CustomPromptSelector />
      </div>

      <StatusMessage message={statusMessage} className="mt-2" />

      <Toast
        message={toastState.message}
        type={toastState.type}
        visible={toastState.visible}
        onClose={() => toastState.setVisible(false)}
        duration={5000}
      />
    </div>
  );
}

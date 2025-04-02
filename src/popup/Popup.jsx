// src/popup/Popup.jsx
import { useEffect, useState } from 'react';
// Removed usePrompts import
import { useTheme } from '../contexts/ThemeContext';
import { useStatus } from './contexts/StatusContext';
import { usePopupPlatform } from '../contexts/platform';
import { Button, AppHeader } from '../components'; // Import AppHeader
import { StatusMessage } from '../components';
import { Toast } from '../components';
import { useContent, ContentTypeDisplay } from '../components';
import { PlatformSelector } from './features/PlatformSelector';
// Removed QuickPromptEditor and CustomPromptSelector imports
import { UnifiedInput } from '../components/input/UnifiedInput'; // Changed to named import
import { STORAGE_KEYS } from '../shared/constants';
import { INTERFACE_SOURCES } from '../shared/constants';
import { useContentProcessing } from '../hooks/useContentProcessing';

export function Popup() {
  const { theme, toggleTheme } = useTheme();
  const { contentType, currentTab, isSupported, isLoading: contentLoading } = useContent();
  // Removed usePrompts hook call
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
  const [inputText, setInputText] = useState(''); // Added state for UnifiedInput

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

  // New handler for UnifiedInput submission
  const handleProcessWithText = async (text) => {
    if (isProcessingContent || isProcessing || !isSupported || contentLoading || !currentTab?.id || !text.trim()) return;

    const promptContent = text.trim(); // Use the passed text directly
    setIsProcessing(true);
    updateStatus('Checking page content...', true);

    try {
      // Clear any existing content in storage
      await chrome.storage.local.set({
        [STORAGE_KEYS.CONTENT_READY]: false,
        [STORAGE_KEYS.EXTRACTED_CONTENT]: null,
        [STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID]: null,
        [STORAGE_KEYS.SCRIPT_INJECTED]: false,
        [STORAGE_KEYS.PRE_PROMPT]: promptContent // Store the final prompt (using the text argument)
      });

      // Process content using the hook
      updateStatus(`Processing content with ${selectedPlatformId}...`, true);

      const result = await processContent({
        platformId: selectedPlatformId,
        promptContent: promptContent,
        useApi: false // Popup always uses web UI interaction
      });

      if (result.success) {
        updateStatus('Opening AI platform...', true);
        // Popup might close automatically if platform opens in new tab
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

  // Removed getActualPromptContent, handleProcess, shouldEnableProcessing
  return (
    <div className="min-w-[320px] p-2 bg-theme-primary text-theme-primary">
      {/* Pass closePopup function to the new onClose prop */}
      <AppHeader onClose={closePopup}>
        {/* Sidebar toggle button - remains as a child for now, or could be refactored similarly */}
        <button
          onClick={toggleSidebar}
          className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
          title="Toggle Sidebar"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
            <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
        {/* Removed the explicit Close button from here */}
      </AppHeader>

      <ContentTypeDisplay className="mb-3" />

      <div className="mb-3"> {/* Changed mt-2 to mb-3 */}
        <PlatformSelector />
      </div>

      {/* Replaced QuickPromptEditor and CustomPromptSelector with UnifiedInput */}
      <div> {/* Removed mt-2 */}
        <UnifiedInput
          value={inputText}
          onChange={setInputText}
          onSubmit={handleProcessWithText}
          placeholder="Type a prompt or select one..."
          disabled={!isSupported || contentLoading || isProcessingContent || isProcessing}
          isProcessing={isProcessingContent || isProcessing}
          contentType={contentType}
          showTokenInfo={false}
          layoutVariant="popup" // Ensure string literal
          onCancel={null} // No cancel button in popup variant
        />
      </div>

      <StatusMessage message={statusMessage} className="mt-3" />

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

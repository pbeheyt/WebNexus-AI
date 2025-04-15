// src/popup/Popup.jsx
import { useEffect, useState } from 'react';
import { useStatus } from './contexts/StatusContext';
import { usePopupPlatform } from '../contexts/platform';
import { AppHeader, StatusMessage } from '../components';
import { useContent } from '../contexts/ContentContext';
import { PlatformSelector } from './components/PlatformSelector';
import { UnifiedInput } from '../components/input/UnifiedInput';
import { STORAGE_KEYS, INTERFACE_SOURCES, CONTENT_TYPE_LABELS } from '../shared/constants';
import { useContentProcessing } from '../hooks/useContentProcessing';
import { InfoPanel } from './components/InfoPanel';
import { robustSendMessage } from '../shared/utils/message-utils';

export function Popup() {
  const { contentType, currentTab, isSupported, isLoading: contentLoading } = useContent();
  const { selectedPlatformId } = usePopupPlatform();
  const {
    statusMessage,
    updateStatus,
  } = useStatus();

  const {
    processContent,
    isProcessing: isProcessingContent
  } = useContentProcessing(INTERFACE_SOURCES.POPUP);

  const contentTypeLabel = contentType ? CONTENT_TYPE_LABELS[contentType] : null;

  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState('');

  // Listen for messages from background script
  useEffect(() => {
    const messageListener = (message) => {
      if (message.action === 'apiResponseReady') {
        updateStatus('API response ready');
        setIsProcessing(false);
      } else if (message.action === 'apiProcessingError') {
        updateStatus(`API processing error: ${message.error || 'Unknown error'}`);
        setIsProcessing(false);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [updateStatus]);

  // Function to close the popup
  const closePopup = () => {
    window.close();
  };

  // Function to toggle sidebar with auto-close
  const toggleSidebar = async () => {
    if (!currentTab?.id) {
      updateStatus('Error: No active tab found.');
      return;
    }

    updateStatus('Toggling sidebar...', true);
    try {
      // Send message to background to toggle the native side panel state (enable/disable)
      const response = await robustSendMessage({
        action: 'toggleNativeSidePanelAction',
        tabId: currentTab.id,
      });

      if (response?.success) {
        // Background confirmed state update (enabled/disabled)
        updateStatus(`Sidebar state updated to: ${response.visible ? 'Visible' : 'Hidden'}.`);

        // If the panel's intended state is now 'visible', attempt to open it.
        // This MUST be done here, within the user gesture context.
        if (response.visible) {
          try {
            await chrome.sidePanel.open({ tabId: currentTab.id });
            updateStatus('Sidebar opened successfully.');
            // Close popup *after* successful open attempt
            window.close();
          } catch (openError) {
            console.error('Error opening side panel:', openError);
            updateStatus(`Error opening sidebar: ${openError.message}`);
            // Keep popup open to show the error
          }
        } else {
          // If the panel was disabled (response.visible is false), just close the popup.
          // The browser handles closing the panel itself if it was open.
          updateStatus('Sidebar disabled.');
          window.close();
        }
      } else {
        throw new Error(response?.error || 'Failed to toggle sidebar state in background.');
      }
    } catch (error) {
      console.error('Error in toggleSidebar:', error);
      updateStatus(`Error: ${error.message}`, false); // Show error, stop loading indicator
      // Keep popup open to show the error
    }
  };

  // Handler for UnifiedInput submission
  const handleProcessWithText = async (text) => {
    if (isProcessingContent || isProcessing || !isSupported || contentLoading || !currentTab?.id || !text.trim()) {
      if (!isSupported) updateStatus('Error: Extension cannot access this page.');
      else if (contentLoading) updateStatus('Page content still loading...');
      else if (!text.trim()) updateStatus('Please enter a prompt.');
      return;
    }

    const promptContent = text.trim();
    setIsProcessing(true);
    updateStatus('Preparing content...', true);

    try {
      // Clear previous state related to content processing
      await chrome.storage.local.set({
        [STORAGE_KEYS.CONTENT_READY]: false,
        [STORAGE_KEYS.EXTRACTED_CONTENT]: null,
        [STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID]: null,
        [STORAGE_KEYS.SCRIPT_INJECTED]: false,
        [STORAGE_KEYS.PRE_PROMPT]: promptContent // Store the user's prompt
      });

      updateStatus(`Processing with ${selectedPlatformId}...`, true);

      const result = await processContent({
        platformId: selectedPlatformId,
        promptContent: promptContent,
        useApi: false // Popup uses web UI interaction
      });

      if (result.success) {
        updateStatus('Opening AI platform...', true);
        // Popup might close automatically if the platform opens in a new tab,
        // otherwise, it remains open.
      } else {
        // Check for specific non-injectable error code
        if (result.code === 'EXTRACTION_NOT_SUPPORTED') {
          updateStatus(result.error, false); // Use the specific message from background
        } else {
          // Use updateStatus for generic error feedback
          updateStatus(`Error: ${result.error || 'Processing failed'}`, false);
        }
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Process error:', error);
      // Use updateStatus for error feedback
      updateStatus(`Error: ${error.message || 'An unexpected error occurred'}`, false);
      setIsProcessing(false); // Stop processing on exception
    }
  };

  return (
    <div className="min-w-[350px] p-4 bg-theme-primary text-theme-primary">
      <AppHeader onClose={closePopup} className='pb-2'>
        {/* Sidebar toggle button */}
        <button
          onClick={toggleSidebar}
          className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
          title="Toggle Sidebar"
          disabled={!currentTab?.id} // Disable if no tab context
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
            <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      </AppHeader>

      {/* Info Panel */}
      {!contentLoading && contentTypeLabel && (
        <div className="mt-2">
          <InfoPanel contentTypeLabel={contentTypeLabel} contentType={contentType} />
        </div>
      )}

      <div className="mt-2"> 
        <PlatformSelector />
      </div>

      <div className="mt-4">
        <UnifiedInput
          value={inputText}
          onChange={setInputText}
          onSubmit={handleProcessWithText}
          disabled={!isSupported || contentLoading || isProcessingContent || isProcessing}
          isProcessing={isProcessingContent || isProcessing}
          contentType={contentType}
          showTokenInfo={false}
          layoutVariant="popup"
          onCancel={null} // No cancel in popup
        />
      </div>

      {/* Status message displayed below the input */}
      <StatusMessage message={statusMessage} context="popup" className="mt-3" />

    </div>
  );
}

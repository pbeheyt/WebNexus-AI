// src/popup/Popup.jsx
import { useEffect, useState, useRef } from 'react';
import { useStatus } from './contexts/StatusContext';
import { usePopupPlatform } from '../contexts/platform';
import { AppHeader, StatusMessage, IconButton, InfoIcon, Tooltip } from '../components';
import { useContent } from '../contexts/ContentContext';
import { PlatformSelector } from './components/PlatformSelector';
import { UnifiedInput } from '../components/input/UnifiedInput';
import { STORAGE_KEYS, INTERFACE_SOURCES, CONTENT_TYPE_LABELS } from '../shared/constants';
import { useContentProcessing } from '../hooks/useContentProcessing';
import { robustSendMessage } from '../shared/utils/message-utils';
import { getContentTypeIconSvg } from '../shared/utils/icon-utils';

export function Popup() {
  const { contentType, currentTab, isSupported, isLoading: contentLoading, isInjectable } = useContent();
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
  const [isInfoVisible, setIsInfoVisible] = useState(false);
  const infoButtonRef = useRef(null);

  const tooltipMessage = (
    <div className="text-xs text-theme-primary max-w-xs">
      <p className="mb-1.5">
        Extract this{' '}
        <span className="font-medium">{contentTypeLabel || 'content'}</span>{' '}
        and send it with your prompt to the selected AI platform.
      </p>
      <p>
        Open the{' '}
        <span className="font-medium">Side Panel</span>
        <span dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 inline-block align-text-bottom mx-1 text-theme-primary" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/><line x1="15" y1="3" x2="15" y2="21" stroke="currentColor"/></svg>` }} />
        to have your AI conversation directly alongside the page.
      </p>
    </div>
  );

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
    const combinedDisabled = !isSupported || contentLoading || isProcessingContent || isProcessing || !isInjectable;
    
    if (combinedDisabled || !currentTab?.id || !text.trim()) {
      if (!isInjectable) updateStatus('Cannot process content from this page.');
      else if (!isSupported) updateStatus('Error: Extension cannot access this page.');
      else if (contentLoading) updateStatus('Page content still loading...');
      else if (!text.trim()) updateStatus('Please enter a prompt.');
      return;
    }

    const promptContent = text.trim();
    setIsProcessing(true);
    // Immediately update status to show processing has started
    updateStatus(`Processing with ${selectedPlatformId}...`, true); 

    try {
      // Clear previous state
      await chrome.storage.local.remove([
        STORAGE_KEYS.CONTENT_READY,
        STORAGE_KEYS.EXTRACTED_CONTENT,
        STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID,
        STORAGE_KEYS.SCRIPT_INJECTED,
        STORAGE_KEYS.PRE_PROMPT
      ]);
      // Store the new prompt
      await chrome.storage.local.set({ [STORAGE_KEYS.PRE_PROMPT]: promptContent });

      // Call the hook function and wait for the result from the background script
      const result = await processContent({
        platformId: selectedPlatformId,
        promptContent: promptContent,
        // useApi: false is handled by the hook itself
      });

      // Check the result from the background script
      if (result && result.success) {
        // Close the popup ONLY if the background script confirmed success
        window.close(); 
      } else {
        // Background reported an error, display it
        updateStatus(`Error: ${result?.error || 'Processing failed'}`, false);
      }
    } catch (error) {
      // Catch errors from the hook/message sending itself
      console.error('Popup process error:', error);
      updateStatus(`Error: ${error.message || 'An unexpected error occurred'}`, false);
    } finally {
      // Ensure processing state is reset regardless of success or failure
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-w-[350px] px-4 bg-theme-primary text-theme-primary border border-theme">
      <AppHeader onClose={closePopup} className="py-2">
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

      {/* Platform Selector */}
      <div className="my-5">
         <PlatformSelector disabled={!isSupported || contentLoading || isProcessingContent || isProcessing || !isInjectable} />
      </div>

      {/* Unified Input */}
      <div className="mt-4">
        {/* Container for badge/info OR non-injectable message */}
        <div className="flex justify-between items-center mb-1.5 px-3 min-h-[28px]">
          {!contentLoading && (
            isInjectable ? (
              <>
                {/* Content Type Indicator */}
                <div className="flex items-center gap-1 flex-grow min-w-0">
                  {contentTypeLabel ? (
                    <>
                      {/* Icon */}
                      {(() => {
                        const iconSvg = getContentTypeIconSvg(contentType);
                        const modifiedIconSvg = iconSvg ? iconSvg.replace('w-5 h-5', 'w-4 h-4') : '';
                        return modifiedIconSvg ? (
                          <span
                            className="mr-1 flex-shrink-0 w-4 h-4"
                            dangerouslySetInnerHTML={{ __html: modifiedIconSvg }}
                          />
                        ) : null;
                      })()}
                      {/* Label */}
                      <span className="text-xs font-medium truncate">{contentTypeLabel}</span>
                    </>
                  ) : (
                    <span className="text-xs text-theme-secondary">Detecting type...</span>
                  )}
                </div>

                {/* Info Button */}
                <div className="flex-shrink-0">
                  <IconButton
                    ref={infoButtonRef}
                    icon={InfoIcon}
                    className="text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors w-6 h-6"
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={() => setIsInfoVisible(true)}
                    onMouseLeave={() => setIsInfoVisible(false)}
                    onFocus={() => setIsInfoVisible(true)}
                    onBlur={() => setIsInfoVisible(false)}
                    ariaLabel="More information"
                  />
                </div>
              </>
            ) : (
              // Message for Non-Injectable Pages
              <div className="text-xs text-theme-secondary font-medium w-full text-left">
                Cannot extract from this page.
              </div>
            )
          )}
          {contentLoading && (
             <div className="text-xs text-theme-secondary w-full text-left">Loading...</div>
          )}
        </div>

        <UnifiedInput
          value={inputText}
          onChange={setInputText}
          onSubmit={handleProcessWithText}
          disabled={!isSupported || contentLoading || isProcessingContent || isProcessing || !isInjectable}
          isProcessing={isProcessingContent || isProcessing}
          contentType={contentType}
          showTokenInfo={false}
          layoutVariant="popup"
          onCancel={null} // No cancel in popup
        />
      </div>

      {/* Status Message */}
      <StatusMessage message={statusMessage} context="popup" className="py-3"/>

      {/* Tooltip */}
      <Tooltip
        show={isInfoVisible}
        targetRef={infoButtonRef}
        message={tooltipMessage}
        position="bottom"
      />
    </div>
  );
}

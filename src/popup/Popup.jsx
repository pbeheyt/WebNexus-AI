// src/popup/Popup.jsx
import { useEffect, useState, useRef } from 'react';
import { useStatus } from './contexts/StatusContext';
import { usePopupPlatform } from '../contexts/platform';
import { AppHeader, StatusMessage, IconButton, InfoIcon, Tooltip, SidebarIcon, Toggle } from '../components'; // Added Toggle
import { useContent } from '../contexts/ContentContext';
import { PlatformSelector } from './components/PlatformSelector';
import { UnifiedInput } from '../components/input/UnifiedInput';
import { STORAGE_KEYS, INTERFACE_SOURCES, CONTENT_TYPE_LABELS } from '../shared/constants';
import { useContentProcessing } from '../hooks/useContentProcessing';
import { robustSendMessage } from '../shared/utils/message-utils';
import { getContentTypeIconSvg } from '../shared/utils/content-icon-utils';

export function Popup() {
  const { contentType, currentTab, isSupported, isLoading: contentLoading, isInjectable } = useContent();
  const { selectedPlatformId, platforms } = usePopupPlatform();
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
  const [includeContext, setIncludeContext] = useState(true);
  const [isIncludeContextTooltipVisible, setIsIncludeContextTooltipVisible] = useState(false);
  const infoButtonRef = useRef(null);
  const includeContextRef = useRef(null); // This ref will now point to the div containing label and toggle

  // Automatically disable includeContext for non-injectable pages
  useEffect(() => {
    if (!isInjectable) {
      setIncludeContext(false);
    }
  }, [isInjectable]);

  // Define Disabled State
  const isToggleDisabled = !isInjectable || !isSupported || contentLoading || isProcessingContent || isProcessing; // Define Disabled State

  // Dynamic tooltip message based on page state
  const getTooltipMessage = () => {
    if (!isSupported) {
      return (
        <div className="text-xs text-theme-primary text-left w-full p-1.5 select-none">
          <p>
            This extension cannot access the current page.
            You can still send your prompt to the selected AI platform.
          </p>
        </div>
      );
    } else if (!isInjectable) {
      return (
        <div className="text-xs text-theme-primary text-left w-full p-1.5 select-none">
          <p className="mb-1.5">
            Content extraction is not supported for this page.
            You can still send your prompt to the selected AI platform.
          </p>
          <p>
            Open the{' '}
            <span className="font-medium">Side Panel</span>
            <span dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 inline-block align-text-bottom mx-1 text-theme-primary" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/><line x1="15" y1="3" x2="15" y2="21" stroke="currentColor"/></svg>` }} />
            {' '}to have your AI conversation directly alongside the page.
          </p>
        </div>
      );
    } else {
      return (
        <div className="text-xs text-theme-primary text-left w-full p-1.5 select-none">
          <p className="mb-1.5">
            Extract this{' '}
            <span className="font-medium">{contentTypeLabel || 'content'}</span>
            {' '}and send it with your prompt to the selected AI platform.
          </p>
          <p>
            Open the{' '}
            <span className="font-medium">Side Panel</span>
            <span dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 inline-block align-text-bottom mx-1 text-theme-primary" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/><line x1="15" y1="3" x2="15" y2="21" stroke="currentColor"/></svg>` }} />
            {' '}to have your AI conversation directly alongside the page.
          </p>
        </div>
      );
    }
  };

  // Get the appropriate tooltip message
  const tooltipMessage = getTooltipMessage();

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
    const combinedDisabled = !isSupported || contentLoading || isProcessingContent || isProcessing || (includeContext && !isInjectable);

    if (combinedDisabled || !currentTab?.id || !text.trim()) {
      if (!isInjectable && includeContext) updateStatus('Cannot include context from this page.');
      else if (!isSupported) updateStatus('Error: Extension cannot access this page.');
      else if (contentLoading) updateStatus('Page content still loading...');
      else if (!text.trim()) updateStatus('Please enter a prompt.');
      return;
    }

    const promptContent = text.trim();
    setIsProcessing(true);

    const platformName = platforms.find(p => p.id === selectedPlatformId)?.name || selectedPlatformId;
    updateStatus(`Processing with ${platformName}...`, true);

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
        includeContext: includeContext // <-- Pass the state here
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
    <div className="min-w-[350px] px-4 bg-theme-primary text-theme-primary border border-theme select-none cursor-default">
      <AppHeader
        onClose={closePopup}
        className="py-2"
        showInfoButton={true} // Always show the info button
        infoButtonRef={infoButtonRef}
        onInfoMouseEnter={() => setIsInfoVisible(true)}
        onInfoMouseLeave={() => setIsInfoVisible(false)}
        onInfoFocus={() => setIsInfoVisible(true)}
        onInfoBlur={() => setIsInfoVisible(false)}
        infoButtonAriaLabel={isInjectable 
          ? "More information about content extraction" 
          : "More information about using this extension"}
      >
        {/* Sidebar toggle button */}
        <button
          onClick={toggleSidebar}
          className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
          title="Toggle Sidebar"
          disabled={!currentTab?.id} // Disable if no tab context
        >
          <SidebarIcon className="w-4 h-4 select-none" />
        </button>
      </AppHeader>

      {/* Platform Selector */}
      <div className="mt-4">
         <PlatformSelector disabled={!isSupported || contentLoading || isProcessingContent || isProcessing} />
      </div>

      {/* Unified Input */}
      <div className="mt-3">
        {/* Container for badge/info/toggle OR non-injectable message */}
        <div className="flex justify-between items-center mb-2 px-3">
          {!contentLoading && (
            isInjectable ? (
              <>
                {/* Container for Content Type, Toggle, and Tooltip Trigger */}
                <div
                  className={`flex items-center gap-1 w-full mt-3 cursor-default`}
                  ref={includeContextRef} // Ref for tooltip target
                  onMouseEnter={() => setIsIncludeContextTooltipVisible(true)}
                  onMouseLeave={() => setIsIncludeContextTooltipVisible(false)}
                  onFocus={() => setIsIncludeContextTooltipVisible(true)}
                  onBlur={() => setIsIncludeContextTooltipVisible(false)}
                  tabIndex={0} // Make it focusable for accessibility
                  aria-describedby="include-context-tooltip"
                >
                  {contentTypeLabel ? (
                    <>
                      {/* Icon */}
                      {(() => {
                        const iconSvg = getContentTypeIconSvg(contentType);
                        return iconSvg ? (
                          <span
                            className="flex items-center flex-shrink-0 cursor-default"
                            dangerouslySetInnerHTML={{ __html: iconSvg }}
                          />
                        ) : null;
                      })()}

                      {/* Label */}
                      <span className="text-sm font-medium truncate ml-1 select-none cursor-default">{contentTypeLabel}</span>

                      {/* Toggle */}
                      <Toggle
                        id="include-context-toggle"
                        checked={includeContext}
                        onChange={(newCheckedState) => { 
                          if (!isToggleDisabled) {
                            setIncludeContext(newCheckedState);
                            updateStatus(`Content inclusion ${newCheckedState ? 'enabled' : 'disabled'}`);
                          }
                        }}
                        disabled={isToggleDisabled}
                        className='w-8 h-4 ml-3'
                      />
                    </>
                  ) : (
                    <span className="text-sm text-theme-secondary select-none cursor-default">Detecting type...</span>
                  )}
                </div>
              </>
            ) : (
              // Message for Non-Injectable Pages (Toggle is not shown here)
              <div></div>
            )
          )}
          {contentLoading && (
             <div className="text-sm text-theme-secondary w-full text-left select-none cursor-default">Loading...</div>
          )}
        </div>

        <UnifiedInput
          value={inputText}
          onChange={setInputText}
          onSubmit={handleProcessWithText}
          disabled={!isSupported || contentLoading || isProcessingContent || isProcessing || (includeContext && !isInjectable)}
          isProcessing={isProcessingContent || isProcessing}
          contentType={contentType}
          showTokenInfo={false}
          layoutVariant="popup"
          onCancel={null} // No cancel in popup
        />
      </div>

      {/* Status Message */}
      <StatusMessage message={statusMessage} context="popup" className="py-3 select-none"/>

      {/* Tooltip for Info Button */}
      <Tooltip
        show={isInfoVisible}
        targetRef={infoButtonRef}
        message={tooltipMessage}
        position="bottom"
        delay = {250}
      />

      {/* Tooltip for Include Context (Content Type Label + Toggle) */}
      <Tooltip
        show={isIncludeContextTooltipVisible}
        targetRef={includeContextRef}
        message={isInjectable 
          ? "Send content along with your prompt." 
          : "Content extraction not available for this page."}
        position="top"
        id="include-context-tooltip"
      />
    </div>
  );
}
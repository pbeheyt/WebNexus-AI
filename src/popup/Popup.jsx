// src/popup/Popup.jsx
import { useEffect, useState, useRef, useCallback } from 'react';

import { logger } from '../shared/logger';
import { usePopupPlatform } from '../contexts/platform';
import {
  AppHeader,
  StatusMessage,
  Tooltip,
  SidepanelIcon,
  Toggle,
  ContentTypeIcon,
} from '../components';
import { useContent } from '../contexts/ContentContext';
import { UnifiedInput } from '../components/input/UnifiedInput';
import {
  STORAGE_KEYS, // Updated import
  INTERFACE_SOURCES,
  CONTENT_TYPE_LABELS,
  DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG, // This remains for the default value
} from '../shared/constants';
import { formatShortcutToStringDisplay } from '../shared/utils/shortcut-utils';
import { useConfigurableShortcut } from '../hooks/useConfigurableShortcut';
import { useContentProcessing } from '../hooks/useContentProcessing';
import { robustSendMessage } from '../shared/utils/message-utils';

import { PlatformSelector } from './components/PlatformSelector';
import { useStatus } from './contexts/StatusContext';


export function Popup() {
  const {
    contentType,
    currentTab,
    isSupported,
    isLoading: contentLoading,
    isInjectable,
  } = useContent();
  const { selectedPlatformId, platforms } = usePopupPlatform();
  const { statusMessage, updateStatus } = useStatus();

  const { processContent, isProcessing: isProcessingContent } =
    useContentProcessing(INTERFACE_SOURCES.POPUP);

  const contentTypeLabel = contentType
    ? CONTENT_TYPE_LABELS[contentType]
    : null;

  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isInfoVisible, setIsInfoVisible] = useState(false);
  const [includeContext, setIncludeContext] = useState(true);
  const [isIncludeContextTooltipVisible, setIsIncludeContextTooltipVisible] =
    useState(false);
  const infoButtonRef = useRef(null);
  const includeContextRef = useRef(null);

  // Fade in effect for popup
  useEffect(() => {
    setTimeout(() => {
      const rootElement = document.getElementById('root');
      if (rootElement) {
        rootElement.style.opacity = '1';
      }
    }, 0);
  }, []);

  // Automatically disable includeContext for non-injectable pages
  useEffect(() => {
    if (!isInjectable) {
      setIncludeContext(false);
    }
  }, [isInjectable]);

  const isToggleDisabled =
    !isInjectable ||
    !isSupported ||
    contentLoading ||
    isProcessingContent ||
    isProcessing;

  const getTooltipMessage = () => {
    if (!isSupported) {
      return (
        <div className='text-xs text-theme-primary text-left w-full p-1.5'>
          <p>
            This extension cannot access the current page. You can still send
            your prompt to the selected AI platform.
          </p>
        </div>
      );
    } else if (!isInjectable) {
      return (
        <div className='text-xs text-theme-primary text-left w-full p-1.5'>
          <p className='mb-1.5'>
            Content extraction is not supported for this page. You can still
            send your prompt to the selected AI platform.
          </p>
          <p>
            Open the <span className='font-medium'>Side Panel</span>
            <span
              dangerouslySetInnerHTML={{
                __html: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 inline-block align-text-bottom mx-1 text-theme-primary" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/><line x1="15" y1="3" x2="15" y2="21" stroke="currentColor"/></svg>`,
              }}
            />{' '}
            to have your AI conversation directly alongside the page.
          </p>
        </div>
      );
    } else {
      return (
        <div className='text-xs text-theme-primary text-left w-full p-1.5'>
          <p className='mb-1.5'>
            Extract this{' '}
            <span className='font-medium'>{contentTypeLabel || 'content'}</span>{' '}
            and send it with your prompt to the selected AI platform.
          </p>
          <p>
            Open the <span className='font-medium'>Side Panel</span>
            <span
              dangerouslySetInnerHTML={{
                __html: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 inline-block align-text-bottom mx-1 text-theme-primary" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/><line x1="15" y1="3" x2="15" y2="21" stroke="currentColor"/></svg>`,
              }}
            />{' '}
            to have your AI conversation directly alongside the page.
          </p>
        </div>
      );
    }
  };

  const tooltipMessage = getTooltipMessage();

  useEffect(() => {
    const messageListener = (message) => {
      if (message.action === 'apiResponseReady') {
        updateStatus('API response ready');
        setIsProcessing(false);
      } else if (message.action === 'apiProcessingError') {
        updateStatus(
          `API processing error: ${message.error || 'Unknown error'}`
        );
        setIsProcessing(false);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [updateStatus]);

  const closePopup = () => {
    window.close();
  };

  const toggleSidepanel = useCallback(async () => {
    if (!currentTab?.id) {
      updateStatus('Error: No active tab found.');
      return;
    }

    let tabUrl;
    try {
      const tab = await chrome.tabs.get(currentTab.id);
      if (!tab || !tab.url) {
        updateStatus('Error: Could not determine tab URL.');
        return;
      }
      tabUrl = tab.url;
    } catch (error) {
      logger.popup.error('Error getting tab info:', error);
      updateStatus('Error: Could not check tab information.');
      return;
    }

    const isAllowed = await robustSendMessage({
      action: 'isSidePanelAllowedPage',
      url: tabUrl,
    });

    if (!isAllowed) {
      updateStatus('Side Panel cannot be opened on this type of page.', 'warning');
      return;
    }

    updateStatus('Toggling Side Panel...', true);
    try {
      const response = await robustSendMessage({
        action: 'toggleNativeSidePanelAction',
        tabId: currentTab.id,
      });

      if (response?.success) {
        updateStatus(
          `Side Panel state updated to: ${response.visible ? 'Visible' : 'Hidden'}.`
        );

        if (response.visible) {
          try {
            await chrome.sidePanel.open({ tabId: currentTab.id });
            updateStatus('Side Panel opened successfully.');
            window.close();
          } catch (openError) {
            logger.popup.error('Error opening side panel:', openError);
            updateStatus(`Error opening Side Panel: ${openError.message}`);
          }
        } else {
          updateStatus('Side Panel disabled.');
          window.close();
        }
      } else {
        throw new Error(
          response?.error || 'Failed to toggle sidepanel state in background.'
        );
      }
    } catch (error) {
      logger.popup.error('Error in toggleSidepanel:', error);
      updateStatus(`Error: ${error.message}`, false);
    }
  }, [currentTab, updateStatus]);

  const { currentShortcutConfig: popupSidepanelShortcut } = useConfigurableShortcut(
    STORAGE_KEYS.CUSTOM_SIDEPANEL_TOGGLE_SHORTCUT,
    DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG,
    toggleSidepanel,
    logger.popup,
    [toggleSidepanel]
  );

  const handleProcessWithText = async (text) => {
    const combinedDisabled =
      !isSupported ||
      contentLoading ||
      isProcessingContent ||
      isProcessing ||
      (includeContext && !isInjectable);

    if (combinedDisabled || !currentTab?.id || !text.trim()) {
      if (!isInjectable && includeContext)
        updateStatus('Cannot include context from this page.');
      else if (!isSupported)
        updateStatus('Error: Extension cannot access this page.');
      else if (contentLoading) updateStatus('Page content still loading...');
      else if (!text.trim()) updateStatus('Please enter a prompt.');
      return;
    }

    const promptContent = text.trim();
    setIsProcessing(true);

    const platformName =
      platforms.find((p) => p.id === selectedPlatformId)?.name ||
      selectedPlatformId;
    updateStatus(`Processing with ${platformName}...`, true);

    try {
      await chrome.storage.local.remove([
        STORAGE_KEYS.CONTENT_READY_FLAG,
        STORAGE_KEYS.EXTRACTED_CONTENT,
        STORAGE_KEYS.WEBUI_INJECTION_TARGET_TAB_ID,
        STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG,
        STORAGE_KEYS.WEBUI_INJECTION_PROMPT_CONTENT,
      ]);
      await chrome.storage.local.set({
        [STORAGE_KEYS.WEBUI_INJECTION_PROMPT_CONTENT]: promptContent,
      });

      const result = await processContent({
        platformId: selectedPlatformId,
        promptContent: promptContent,
        includeContext: includeContext,
      });

      if (result && result.success) {
        window.close();
      } else {
        updateStatus(`Error: ${result?.error || 'Processing failed'}`, false);
      }
    } catch (error) {
      logger.popup.error('Popup process error:', error);
      updateStatus(
        `Error: ${error.message || 'An unexpected error occurred'}`,
        false
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className='w-[350px] px-4 bg-theme-primary text-theme-primary border border-theme cursor-default'>
      <AppHeader
        onClose={closePopup}
        className='py-2'
        showInfoButton={true}
        infoButtonRef={infoButtonRef}
        onInfoMouseEnter={() => setIsInfoVisible(true)}
        onInfoMouseLeave={() => setIsInfoVisible(false)}
        onInfoFocus={() => setIsInfoVisible(true)}
        onInfoBlur={() => setIsInfoVisible(false)}
        infoButtonAriaLabel={
          isInjectable
            ? 'More information about content extraction'
            : 'More information about using this extension'
        }
      >
        <button
          onClick={toggleSidepanel}
          className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
          title={popupSidepanelShortcut && popupSidepanelShortcut.key ? `Toggle Side Panel (${formatShortcutToStringDisplay(popupSidepanelShortcut)})` : 'Toggle Side Panel'}
          disabled={!currentTab?.id}
        >
          <SidepanelIcon className='w-4 h-4 select-none' />
        </button>
      </AppHeader>

      {!contentLoading && (
        <>
          <div className='mt-4'>
            <PlatformSelector
              disabled={
                !isSupported ||
                contentLoading ||
                isProcessingContent ||
                isProcessing
              }
            />
          </div>

          <div className='mt-3'>
            <div className='flex justify-between items-center mb-3 px-3'>
              {isInjectable ? (
                <>
                  <div
                    className={`flex items-center gap-1 w-full mt-3 cursor-default`}
                    ref={includeContextRef}
                    onMouseEnter={() => setIsIncludeContextTooltipVisible(true)}
                    onMouseLeave={() => setIsIncludeContextTooltipVisible(false)}
                    onFocus={() => setIsIncludeContextTooltipVisible(true)}
                    onBlur={() => setIsIncludeContextTooltipVisible(false)}
                    aria-describedby='include-context-tooltip'
                  >
                    {contentTypeLabel ? (
                      <>
                        <ContentTypeIcon
                          contentType={contentType}
                          className='w-5 h-5 text-current'
                        />
                        <span className='text-sm font-medium truncate ml-1 cursor-default'>
                          {contentTypeLabel}
                        </span>
                        <Toggle
                          id='include-context-toggle'
                          checked={includeContext}
                          onChange={(newCheckedState) => {
                            if (!isToggleDisabled) {
                              setIncludeContext(newCheckedState);
                              updateStatus(
                                `Content inclusion ${newCheckedState ? 'enabled' : 'disabled'}`
                              );
                            }
                          }}
                          disabled={isToggleDisabled}
                          className='w-8 h-4 ml-3'
                        />
                      </>
                    ) : (
                      <span className='text-sm text-theme-secondary cursor-default'>
                        Detecting type...
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div></div>
              )}
            </div>

            <UnifiedInput
              value={inputText}
              onChange={setInputText}
              onSubmit={handleProcessWithText}
              disabled={
                !isSupported ||
                contentLoading ||
                isProcessingContent ||
                isProcessing ||
                (includeContext && !isInjectable)
              }
              isProcessing={isProcessingContent || isProcessing}
              contentType={contentType}
              showTokenInfo={false}
              layoutVariant='popup'
              onCancel={null}
            />
          </div>

          <StatusMessage
            message={statusMessage}
            context='popup'
            className='py-3'
          />
        </>
      )}

      <Tooltip
        show={isInfoVisible}
        targetRef={infoButtonRef}
        message={tooltipMessage}
        position='bottom'
        delay={250}
      />

      <Tooltip
        show={isIncludeContextTooltipVisible}
        targetRef={includeContextRef}
        message={
          isInjectable
            ? 'Send content along with your prompt.'
            : 'Content extraction not available for this page.'
        }
        position='top'
        id='include-context-tooltip'
      />
    </div>
  );
}

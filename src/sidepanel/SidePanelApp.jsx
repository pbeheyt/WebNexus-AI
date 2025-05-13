// src/sidebar/SidebarApp.jsx
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';

import { STORAGE_KEYS, DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG } from '../shared/constants';
import { logger } from '../shared/logger';
import { robustSendMessage } from '../shared/utils/message-utils';
import { useConfigurableShortcut } from '../hooks/useConfigurableShortcut';
import { useSidePanelPlatform } from '../contexts/platform';
import { useContent } from '../contexts/ContentContext';
import { useUI } from '../contexts/UIContext';
import { AppHeader, ErrorIcon } from '../components';
import { debounce } from '../shared/utils/debounce';

import Header from './components/Header';
import ChatArea from './components/ChatArea';
import { UserInput } from './components/UserInput';
import { useSidePanelChat } from './contexts/SidePanelChatContext';

export default function SidePanelApp() {
  const { tabId, setTabId } = useSidePanelPlatform();
  const { resetCurrentTabData, isRefreshing } = useSidePanelChat();
  const { updateContentContext } = useContent();
  const { textSize } = useUI();
  const [isReady, setIsReady] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const portRef = useRef(null);

  // Use the custom hook for shortcut handling
  const handleCloseShortcut = useCallback(async () => {
    if (!tabId) {
      logger.sidepanel.warn('SidepanelApp: tabId prop is missing, cannot handle close shortcut.');
      return;
    }
    logger.sidepanel.info(`Shortcut pressed in sidepanel (tabId: ${tabId}), attempting to close.`);
    try {
      const response = await robustSendMessage({
        action: 'closeCurrentSidePanel',
        tabId: tabId,
      });
      if (response && response.success) {
        logger.sidepanel.info(`Side panel close command acknowledged for tab ${tabId}.`);
      } else {
        logger.sidepanel.error(`Failed to close side panel for tab ${tabId}:`, response?.error);
      }
    } catch (err) {
      logger.sidepanel.error(`Error sending closeCurrentSidePanel message for tab ${tabId}:`, err);
    }
  }, [tabId]);

  // currentShortcutConfig is returned but not directly used for display in SidebarApp
  useConfigurableShortcut(
    STORAGE_KEYS.CUSTOM_SIDEBAR_TOGGLE_SHORTCUT,
    DEFAULT_POPUP_SIDEPANEL_SHORTCUT_CONFIG,
    handleCloseShortcut,
    logger.sidepanel,
    [handleCloseShortcut]
  );

  // Refs for height calculation
  const appHeaderRef = useRef(null);
  const collapsibleHeaderRef = useRef(null);
  const userInputRef = useRef(null);
  const [otherUIHeight, setOtherUIHeight] = useState(160);
  const rafIdHeightCalc = useRef(null);

  // --- Effect to determine Tab ID ---
  useEffect(() => {
    logger.sidepanel.info(
      'SidepanelApp mounted, attempting to determine tab context...'
    );
    let foundTabId = NaN;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabIdFromUrl = urlParams.get('tabId');
      const parsedTabId = tabIdFromUrl ? parseInt(tabIdFromUrl, 10) : NaN;

      if (tabIdFromUrl && !isNaN(parsedTabId)) {
        logger.sidepanel.info(`Found valid tabId ${parsedTabId} in URL.`);
        foundTabId = parsedTabId;
      } else {
        logger.sidepanel.error(
          'FATAL: Sidepanel loaded without a valid tabId in URL. Cannot initialize.'
        );
      }
    } catch (error) {
      logger.sidepanel.error('Error parsing tabId from URL:', error);
    }

    if (!isNaN(foundTabId)) {
      setTabId(foundTabId);
    }

    const timer = setTimeout(() => {
      setIsReady(!isNaN(foundTabId));
      logger.sidepanel.info(
        `Sidepanel initialization complete. isReady: ${!isNaN(foundTabId)}, tabId set to: ${foundTabId}`
      );
    }, 50);

    return () => clearTimeout(timer);
  }, [setTabId]);

  // --- Effect for Page Navigation Listener ---
  useEffect(() => {
    if (!isReady || !tabId) {
      logger.sidepanel.info(
        `Skipping pageNavigated listener setup (isReady: ${isReady}, tabId: ${tabId})`
      );
      return;
    }

    const messageListener = (message, _sender, _sendResponse) => {
      if (message.action === 'pageNavigated' && message.tabId === tabId) {
        logger.sidepanel.info(
          `Received pageNavigated event for current tab ${tabId}:`,
          message
        );
        try {
          updateContentContext(message.newUrl, message.newContentType);
          logger.sidepanel.info(
            `Content context updated for tab ${tabId} to URL: ${message.newUrl}, Type: ${message.newContentType}`
          );
        } catch (error) {
          logger.sidepanel.error(
            `Error handling pageNavigated event for tab ${tabId}:`,
            error
          );
        }
      }
    };

    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
      logger.sidepanel.info(
        `Added runtime message listener for pageNavigated events (tabId: ${tabId})`
      );
    } else {
      logger.sidepanel.warn(
        'Chrome runtime API not available for message listener.'
      );
    }

    return () => {
      if (chrome && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
        logger.sidepanel.info(
          `Removed runtime message listener for pageNavigated events (tabId: ${tabId})`
        );
      }
    };
  }, [isReady, tabId, updateContentContext]);

  // --- Effect for Background Connection Port ---
  useEffect(() => {
    if (!isReady || !tabId) {
      logger.sidepanel.info(
        `Skipping background port connection (isReady: ${isReady}, tabId: ${tabId})`
      );
      return;
    }

    if (portRef.current) {
      return;
    }

    if (!(chrome && chrome.runtime && chrome.runtime.connect)) {
      logger.sidepanel.warn(
        'Chrome runtime connect API not available.'
      );
      return;
    }

    const portName = `sidepanel-connect-${tabId}`;
    try {
      portRef.current = chrome.runtime.connect({ name: portName });

      portRef.current.onDisconnect.addListener(() => {
        logger.sidepanel.info(`Port disconnected for tab ${tabId}.`);
        if (chrome.runtime.lastError) {
          logger.sidepanel.error(
            `Disconnect error for tab ${tabId}:`,
            chrome.runtime.lastError.message
          );
        }
        portRef.current = null;
      });
    } catch (error) {
      logger.sidepanel.error(
        `Error connecting to background for tab ${tabId}:`,
        error
      );
      portRef.current = null;
    }

    return () => {
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, [isReady, tabId]);

  // --- Height Calculation Logic ---
  const calculateAndSetHeight = useCallback(() => {
    if (rafIdHeightCalc.current) {
      cancelAnimationFrame(rafIdHeightCalc.current);
    }
    
    rafIdHeightCalc.current = requestAnimationFrame(() => {
      const appHeaderHeight = appHeaderRef.current?.offsetHeight || 0;
      const collapsibleHeight = headerExpanded
      ? collapsibleHeaderRef.current?.offsetHeight || 0
      : 0;
      const inputHeight = userInputRef.current?.offsetHeight || 0;
      
      if (
        typeof appHeaderHeight === 'number' &&
        typeof collapsibleHeight === 'number' &&
        typeof inputHeight === 'number'
      ) {
        const totalHeight = appHeaderHeight + collapsibleHeight + inputHeight;
        const buffer = 2;
        setOtherUIHeight(totalHeight + buffer);
      }
      rafIdHeightCalc.current = null;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerExpanded, textSize]);
  
  const debouncedCalculateHeight = useMemo(
    () => debounce(calculateAndSetHeight, 150),
    [calculateAndSetHeight]
  );

  useEffect(() => {
    if (isReady) {
      calculateAndSetHeight();
    }
    return () => {
      if (rafIdHeightCalc.current) {
        cancelAnimationFrame(rafIdHeightCalc.current);
        rafIdHeightCalc.current = null;
      }
    };
  }, [isReady, headerExpanded, textSize, calculateAndSetHeight]);

  // --- Render Logic ---
  return (
    <div
      className={`flex flex-col h-screen w-full overflow-hidden bg-theme-primary text-theme-primary ${textSize ? `text-${textSize}` : 'text-sm'}`}
    >
      {!isReady ? (
        <div
          className='flex h-full w-full items-center justify-center'
          aria-live='polite'
          aria-busy='true'
        >
          <div
            className='w-6 h-6 border-4 border-theme-secondary border-t-transparent rounded-full animate-spin'
            role='status'
          ></div>
        </div>
      ) : tabId ? (
        <>
          <div ref={appHeaderRef} className='flex-shrink-0'>
            <AppHeader
              showRefreshButton={true}
              onRefreshClick={resetCurrentTabData}
              isRefreshing={isRefreshing}
              isExpanded={headerExpanded}
              onToggleExpand={() => setHeaderExpanded(!headerExpanded)}
              showExpandToggle={true}
              showBorder={true}
              className='px-5 py-2'
            />
          </div>

          <div
            ref={collapsibleHeaderRef}
            className='relative flex-shrink-0 z-10'
          >
            <div
              className={`transition-all duration-300 ease-in-out border-b border-theme ${
                headerExpanded
                  ? 'max-h-40 opacity-100'
                  : 'max-h-0 opacity-0 invisible'
              }`}
              aria-hidden={!headerExpanded}
            >
              <Header />
            </div>
          </div>

          {isReady && tabId && isRefreshing && (
            <div className="absolute inset-0 bg-theme-primary/75 dark:bg-theme-primary/75 z-20 flex items-center justify-center pointer-events-auto">
              <div className="w-6 h-6 border-4 border-theme-secondary border-t-transparent rounded-full animate-spin" role="status">
                <span className="sr-only">Refreshing...</span>
              </div>
            </div>
          )}

          <ChatArea
            className='flex-1 min-h-0 relative z-0'
            otherUIHeight={otherUIHeight}
            requestHeightRecalculation={debouncedCalculateHeight}
          />

          <div
            ref={userInputRef}
            className='flex-shrink-0 relative z-10 border-t border-theme select-none'
          >
            <UserInput className='' />
          </div>
        </>
      ) : (
        <div className='flex flex-col h-full w-full items-center justify-center p-4'>
          <div className='text-center text-error'>
            <ErrorIcon className='h-10 w-10 mx-auto mb-2 text-error' />
            <p className='font-semibold'>Initialization Error</p>
            <p className='text-sm'>Side Panel context could not be determined.</p>
            <p className='text-xs mt-2'>(Missing or invalid tabId)</p>
          </div>
        </div>
      )}
    </div>
  );
}

SidePanelApp.propTypes = {
  // tabId is managed internally
};

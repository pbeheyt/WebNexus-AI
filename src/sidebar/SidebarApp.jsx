// src/sidebar/SidebarApp.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSidebarPlatform } from '../contexts/platform';
import { useSidebarChat } from './contexts/SidebarChatContext';
import { useContent } from '../contexts/ContentContext';
import { useUI } from '../contexts/UIContext';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import { UserInput } from './components/UserInput';
import { AppHeader } from '../components';
import logger from '../shared/logger';

export default function SidebarApp() {
  const { tabId, setTabId } = useSidebarPlatform();
  const { resetCurrentTabData } = useSidebarChat();
  const { updateContentContext } = useContent();
  const { textSize } = useUI();
  const [isReady, setIsReady] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const portRef = useRef(null);

  // Refs for height calculation
  const appHeaderRef = useRef(null);
  const collapsibleHeaderRef = useRef(null);
  const userInputRef = useRef(null);
  const [otherUIHeight, setOtherUIHeight] = useState(160); // Default value
  const rafIdHeightCalc = useRef(null); // Ref for rAF ID

  // --- Effect to determine Tab ID ---
  useEffect(() => {
    logger.sidebar.info('SidebarApp mounted, attempting to determine tab context...');
    let foundTabId = NaN;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabIdFromUrl = urlParams.get('tabId');
      const parsedTabId = tabIdFromUrl ? parseInt(tabIdFromUrl, 10) : NaN;

      if (tabIdFromUrl && !isNaN(parsedTabId)) {
        logger.sidebar.info(`Found valid tabId ${parsedTabId} in URL.`);
        foundTabId = parsedTabId;
      } else {
        logger.sidebar.error('FATAL: Sidebar loaded without a valid tabId in URL. Cannot initialize.');
      }
    } catch (error) {
      logger.sidebar.error('Error parsing tabId from URL:', error);
    }

    if (!isNaN(foundTabId)) {
      setTabId(foundTabId);
    }

    const timer = setTimeout(() => {
        setIsReady(!isNaN(foundTabId));
        logger.sidebar.info(`Sidebar initialization complete. isReady: ${!isNaN(foundTabId)}, tabId set to: ${foundTabId}`);
    }, 50);

    return () => clearTimeout(timer);

  }, [setTabId]);

  // --- Effect for Page Navigation Listener ---
  useEffect(() => {
    if (!isReady || !tabId) {
      logger.sidebar.info(`Skipping pageNavigated listener setup (isReady: ${isReady}, tabId: ${tabId})`);
      return;
    }

    const messageListener = (message, sender, sendResponse) => {
      if (message.action === 'pageNavigated' && message.tabId === tabId) {
        logger.sidebar.info(`Received pageNavigated event for current tab ${tabId}:`, message);
        try {
          updateContentContext(message.newUrl, message.newContentType);
          logger.sidebar.info(`Content context updated for tab ${tabId} to URL: ${message.newUrl}, Type: ${message.newContentType}`);
        } catch (error) {
          logger.sidebar.error(`Error handling pageNavigated event for tab ${tabId}:`, error);
        }
      }
    };

    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
      logger.sidebar.info(`Added runtime message listener for pageNavigated events (tabId: ${tabId})`);
    } else {
      logger.sidebar.warn("Chrome runtime API not available for message listener.");
    }

    return () => {
      if (chrome && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
        logger.sidebar.info(`Removed runtime message listener for pageNavigated events (tabId: ${tabId})`);
      }
    };
  }, [isReady, tabId, updateContentContext]);

  // --- Effect for Background Connection Port ---
  useEffect(() => {
    if (!isReady || !tabId) {
      logger.sidebar.info(`Skipping background port connection (isReady: ${isReady}, tabId: ${tabId})`);
      return;
    }

    if (portRef.current) {
        return;
    }

    if (!(chrome && chrome.runtime && chrome.runtime.connect)) {
        logger.sidebar.warn("[SidebarApp] Chrome runtime connect API not available.");
        return;
    }

    const portName = `sidepanel-connect-${tabId}`;
    try {
      portRef.current = chrome.runtime.connect({ name: portName });

      portRef.current.onDisconnect.addListener(() => {
        logger.sidebar.info(`[SidebarApp] Port disconnected for tab ${tabId}.`);
        if (chrome.runtime.lastError) {
          logger.sidebar.error(`[SidebarApp] Disconnect error for tab ${tabId}:`, chrome.runtime.lastError.message);
        }
        portRef.current = null;
      });

    } catch (error) {
      logger.sidebar.error(`[SidebarApp] Error connecting to background for tab ${tabId}:`, error);
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
  // Use useCallback to memoize the calculation function
  const calculateAndSetHeight = useCallback(() => {
    // Cancel any pending frame before scheduling a new one
    if (rafIdHeightCalc.current) {
      cancelAnimationFrame(rafIdHeightCalc.current);
    }

    // Schedule the height reading in the next animation frame
    rafIdHeightCalc.current = requestAnimationFrame(() => {
      const appHeaderHeight = appHeaderRef.current?.offsetHeight || 0;
      const collapsibleHeight = headerExpanded ? (collapsibleHeaderRef.current?.offsetHeight || 0) : 0;
      const inputHeight = userInputRef.current?.offsetHeight || 0;

      // Ensure all heights are valid numbers before calculating
      if (typeof appHeaderHeight === 'number' &&
          typeof collapsibleHeight === 'number' &&
          typeof inputHeight === 'number') {
        const totalHeight = appHeaderHeight + collapsibleHeight + inputHeight;
        const buffer = 2; // Small buffer
        setOtherUIHeight(totalHeight + buffer);
        // logger.sidebar.debug(`Calculated otherUIHeight: ${totalHeight + buffer} (App: ${appHeaderHeight}, Collapsible: ${collapsibleHeight}, Input: ${inputHeight})`);
      } else {
        // logger.sidebar.warn('Could not read all element heights for calculation.');
      }
      rafIdHeightCalc.current = null; // Reset ref after execution
    });
  }, [headerExpanded, textSize]); // Recalculate if header state or text size changes

  // Effect for ResizeObserver and initial calculation
  useEffect(() => {
    // Initial calculation after a short delay
    const initialCalcTimer = setTimeout(calculateAndSetHeight, 100); // Slightly increased delay

    const elementsToObserve = [
      appHeaderRef.current,
      collapsibleHeaderRef.current,
      userInputRef.current,
    ].filter(Boolean);

    if (elementsToObserve.length === 0) {
        return () => clearTimeout(initialCalcTimer);
    }

    // Use ResizeObserver to recalculate whenever relevant elements change size
    const resizeObserver = new ResizeObserver(() => {
      calculateAndSetHeight();
    });

    elementsToObserve.forEach(el => resizeObserver.observe(el));

    // Cleanup function
    return () => {
      clearTimeout(initialCalcTimer);
      if (rafIdHeightCalc.current) { // Cancel pending frame on cleanup
        cancelAnimationFrame(rafIdHeightCalc.current);
        rafIdHeightCalc.current = null;
      }
      resizeObserver.disconnect();
    };
  }, [calculateAndSetHeight]); // Depend only on the memoized calculation function

  // Effect to recalculate specifically when headerExpanded changes
  useEffect(() => {
      calculateAndSetHeight();
  }, [headerExpanded, calculateAndSetHeight]);

  // --- Render Logic ---
  // Apply textSize class to the root div
  return (
    <div className={`flex flex-col h-screen w-full overflow-hidden bg-theme-primary text-theme-primary ${textSize ? `text-${textSize}` : 'text-sm'}`}>
      {!isReady ? (
        // ----- Loading State -----
        <div className="flex h-full w-full items-center justify-center" aria-live="polite" aria-busy="true">
          <div className="w-6 h-6 border-4 border-theme-secondary border-t-transparent rounded-full animate-spin" role="status"></div>
        </div>
      ) : tabId ? (
        // ----- Ready State -----
        <>
          {/* Wrap AppHeader to attach ref */}
          <div ref={appHeaderRef} className="flex-shrink-0">
            <AppHeader
              showRefreshButton={true}
              onRefreshClick={resetCurrentTabData}
              isExpanded={headerExpanded}
              onToggleExpand={() => setHeaderExpanded(!headerExpanded)}
              showExpandToggle={true}
              showBorder={true}
              className='px-5 py-2'
            />
          </div>

          {/* Collapsible header section - Attach ref here */}
          <div ref={collapsibleHeaderRef} className="relative flex-shrink-0 z-10">
            <div
              className={`transition-all duration-300 ease-in-out border-b border-theme overflow-hidden ${ // Added overflow-hidden
                headerExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 invisible'
              }`}
              aria-hidden={!headerExpanded}
            >
              {/* Render Header content only when expanded */}
              {headerExpanded && <Header />}
            </div>
          </div>

          {/* Ensure ChatArea takes remaining space */}
          <ChatArea className="flex-1 min-h-0 relative z-0" otherUIHeight={otherUIHeight} />

          {/* User input at the bottom - Wrap to attach ref */}
          <div ref={userInputRef} className="flex-shrink-0 relative z-10 border-t border-theme">
            <UserInput className="" />
          </div>
        </>
      ) : (
        // ----- Error State -----
         <div className="flex flex-col h-full w-full items-center justify-center p-4">
           <div className="text-center text-error">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
             <p className="font-semibold">Initialization Error</p>
             <p className="text-sm">Sidebar context could not be determined.</p>
             <p className="text-xs mt-2">(Missing or invalid tabId)</p>
           </div>
         </div>
      )}
    </div>
  );
}
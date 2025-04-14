// src/sidebar/components/ChatArea.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { debounce } from '../../shared/utils/debounce';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { useSidebarPlatform } from '../../contexts/platform';
import { MessageBubble } from './messaging/MessageBubble';
import { Toggle } from '../../components/core/Toggle';
import { Tooltip } from '../../components/layout/Tooltip';
import { useContent } from '../../contexts/ContentContext';
import { CONTENT_TYPES } from '../../shared/constants';
import { getContentTypeIconSvg } from '../../shared/utils/icon-utils';
import { isInjectablePage } from '../../shared/utils/content-utils';

// --- Icon Definitions --- (Keep exactly as they were)
const InputTokenIcon = () => (
  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 18V6M7 11l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const OutputTokenIcon = () => (
  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 6v12M7 13l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ContextWindowIcon = () => (
  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 3H21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 21H3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 3L14 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 21L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const FreeTierIcon = () => (
    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
const ScrollDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);
// --- End Icon Definitions ---


// --- Helper Function --- (Keep exactly as it was)
const formatContextWindow = (value) => {
  if (typeof value !== 'number') return '';
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(0) + 'K';
  }
  return value.toString();
};
// --- End Helper Function ---


function ChatArea({ className = '' }) {
  const {
    messages,
    isProcessing,
    isContentExtractionEnabled,
    setIsContentExtractionEnabled,
    modelConfigData
  } = useSidebarChat();
  const { contentType, currentTab } = useContent();
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [hoveredElement, setHoveredElement] = useState(null);
  const inputPriceRef = useRef(null);
  const outputPriceRef = useRef(null);
  const contextWindowRef = useRef(null);
  const freeTierRef = useRef(null);
  const {
    platforms,
    selectedPlatformId,
    selectedModel,
    hasAnyPlatformCredentials,
  } = useSidebarPlatform();

  // --- State for Scroll Logic ---
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const [showScrollDownButton, setShowScrollDownButton] = useState(false);
  const isNearBottomRef = useRef(true); // Ref tracks if *currently* near bottom
  const scrollTimeoutRef = useRef(null); // Ref for scrollIntoView timeout
  // --- End State for Scroll Logic ---


  // --- Local State for Stable Display --- (Keep as is)
  const [displayPlatformConfig, setDisplayPlatformConfig] = useState(null);
  const [displayModelConfig, setDisplayModelConfig] = useState(null);
  useEffect(() => {
    const targetPlatform = platforms.find(p => p.id === selectedPlatformId);
    const isModelConfigReady = modelConfigData && selectedModel && modelConfigData.id === selectedModel;
    const isPlatformReady = !!targetPlatform;

    if (isPlatformReady && isModelConfigReady) {
      setDisplayPlatformConfig({
          id: targetPlatform.id,
          name: targetPlatform.name,
          iconUrl: targetPlatform.iconUrl
      });
      setDisplayModelConfig(modelConfigData);
    } else if (!isPlatformReady || !isModelConfigReady) {
        setDisplayPlatformConfig(null);
        setDisplayModelConfig(null);
    }
  }, [platforms, selectedPlatformId, modelConfigData, selectedModel]);
  // --- End Local State ---

  // --- Get Content Type Name ---
  const getContentTypeName = (type) => {
    switch (type) {
      case CONTENT_TYPES.YOUTUBE: return "YouTube Video";
      case CONTENT_TYPES.REDDIT: return "Reddit Post";
      case CONTENT_TYPES.PDF: return "PDF Document";
      case CONTENT_TYPES.GENERAL: return "Web Page";
      default: return "Content";
    }
  };
  // --- End Get Content Type Name ---


  // --- Scroll Handling Logic with user intent detection ---
  const SCROLL_THRESHOLD = 5; // Pixels from bottom to consider "near"
  const DEBOUNCE_DELAY = 100; // Milliseconds for scroll event debounce

  // Function to scroll reliably to the very bottom
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: behavior, block: 'end' });

    // --- IMMEDIATE STATE/REF RESET on programmatic scroll ---
    isNearBottomRef.current = true;
    setUserHasScrolledUp(false); // Re-enable auto-scroll
    setShowScrollDownButton(false); // Hide button
  }, []);

  // Function to check scroll position and update button/state
  // This is now primarily for the debounced listener and manual checks
  const checkScrollPosition = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD;

    // Update ref immediately
    isNearBottomRef.current = isScrolledToBottom;

    // Update button visibility based *only* on position
    setShowScrollDownButton(!isScrolledToBottom);

    // If the user manually scrolls back to the bottom, re-enable auto-scroll
    if (isScrolledToBottom) {
        if (userHasScrolledUp) { // Only update state if it changes
            setUserHasScrolledUp(false);
        }
    }
  }, [userHasScrolledUp, SCROLL_THRESHOLD]); // Depends on userHasScrolledUp to decide if reset is needed

  // Create the debounced version for the 'scroll' event
  const debouncedCheckScrollPosition = useMemo(
    () => debounce(checkScrollPosition, DEBOUNCE_DELAY),
    [checkScrollPosition, DEBOUNCE_DELAY]
  );

  // Listener for direct user scroll input (mouse wheel)
  const handleWheelScroll = useCallback((event) => {
    // If scrolling up (negative deltaY), explicitly disable auto-scroll
    if (event.deltaY < 0) {
        setUserHasScrolledUp(true);
    }
    // We still let the debounced 'scroll' event handler manage the button
    // and re-enable auto-scroll if the user scrolls back down.
  }, [setUserHasScrolledUp]); // Dependency on state setter

  // Listener for direct user scroll input (touch)
  const handleTouchStart = useCallback(() => {
    // If the user touches the screen *while not near the bottom*,
    // assume they intend to take control of scrolling.
    if (!isNearBottomRef.current) {
        setUserHasScrolledUp(true);
    }
  }, [setUserHasScrolledUp]); // Dependency on state setter

  // Effect to attach/detach scroll-related listeners
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      // Debounced listener for general scroll events (updates button, resets flag if user reaches bottom)
      scrollContainer.addEventListener('scroll', debouncedCheckScrollPosition, { passive: true });
      // Direct listener for mouse wheel (disables auto-scroll on upward scroll)
      scrollContainer.addEventListener('wheel', handleWheelScroll, { passive: true });
      // Direct listener for touch start (disables auto-scroll if touch starts while scrolled up)
      scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });

      // Initial check
      checkScrollPosition();

      // Cleanup
      return () => {
        scrollContainer.removeEventListener('scroll', debouncedCheckScrollPosition);
        scrollContainer.removeEventListener('wheel', handleWheelScroll);
        scrollContainer.removeEventListener('touchstart', handleTouchStart);
        if (debouncedCheckScrollPosition && typeof debouncedCheckScrollPosition.cancel === 'function') {
          debouncedCheckScrollPosition.cancel();
        }
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [debouncedCheckScrollPosition, handleWheelScroll, handleTouchStart, checkScrollPosition]);

  // Effect for automatic scrolling on new messages/processing state change
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || messages.length === 0) return;

    // Auto-scroll ONLY if the userHasScrolledUp flag is false
    if (!userHasScrolledUp) {
      const behavior = isProcessing ? 'auto' : 'smooth';
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      // Schedule scroll after DOM update
      scrollTimeoutRef.current = setTimeout(() => {
        scrollToBottom(behavior);
      }, 0);
    }

    // Cleanup timeout
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messages, isProcessing, userHasScrolledUp, scrollToBottom]); // Dependencies remain the same

  // Effect to reset user interaction flag when processing starts
  useEffect(() => {
    if (isProcessing) {
      // When new processing starts, assume user wants to see the output
      setUserHasScrolledUp(false);
    }
  }, [isProcessing]);
  // --- End Scroll Handling ---


  // --- Open API Settings ---
  const openApiSettings = () => {
    try {
      if (chrome && chrome.tabs && chrome.runtime) {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html#api-settings') });
      } else {
         console.warn("Chrome APIs not available. Cannot open settings tab.");
      }
    } catch (error) {
      console.error('Could not open API options page:', error);
    }
  };
  // --- End Open API Settings ---

  const isPageInjectable = currentTab?.url ? isInjectablePage(currentTab.url) : false;

  // --- Initial View Logic (when no messages) ---
  if (messages.length === 0) {
    // --- No Credentials View ---
    if (!hasAnyPlatformCredentials) {
      return (
        <div className={`${className} flex flex-col items-center justify-center h-full text-theme-secondary text-center px-5`}>
          <button
            onClick={openApiSettings}
            className="flex flex-col items-center p-4 rounded-lg hover:bg-theme-hover transition-colors w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-dark"
            aria-label="Configure API Credentials in Settings"
          >
            {/* SVG Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-3 text-theme-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1.51-1V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H15a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <h3 className="text-base font-semibold mb-2">API Credentials Required</h3>
            <p className="text-sm">
              Click here to configure API keys in settings.
            </p>
          </button>
        </div>
      );
    }

    // --- Initial Loading Spinner View ---
    if (hasAnyPlatformCredentials && displayPlatformConfig === null) {
      return (
        <div className={`${className} flex items-center justify-center h-full`}>
          <div className="w-6 h-6 border-4 border-theme-secondary border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading model information"></div>
        </div>
      );
    }

    // --- Welcome Message View ---
    if (hasAnyPlatformCredentials && displayPlatformConfig !== null) {
      return (
        <div className={`${className} flex flex-col items-center justify-evenly h-full text-theme-secondary text-center px-5 py-4 overflow-y-auto`}>
          {/* SECTION 1: Platform Logo, Model Name, and Details Section */}
          <div className="flex flex-col items-center py-5 w-full">
            <img
              src={displayPlatformConfig.iconUrl}
              alt={`${displayPlatformConfig.name || 'Platform'} logo`}
              className="w-12 h-12 mb-3 object-contain"
            />
            {displayModelConfig ? (
              <>
                <div className="text-sm text-theme-primary dark:text-theme-primary-dark font-medium" title={displayModelConfig.id}>
                  {displayModelConfig.name || displayModelConfig.id}
                </div>
                {displayModelConfig.description && (
                  <p className="text-xs text-theme-secondary text-center mt-1 mb-2 max-w-xs mx-auto">
                    {displayModelConfig.description}
                  </p>
                )}
                <div className="flex flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-theme-secondary mt-2">
                  {/* Pricing and Context Window Info with Tooltips */}
                   {displayModelConfig.inputTokenPrice === 0 && displayModelConfig.outputTokenPrice === 0 ? (
                     <div ref={freeTierRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('freeTier')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('freeTier')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                       <FreeTierIcon /> <span>Free</span>
                       <Tooltip show={hoveredElement === 'freeTier'} message="This model is currently free to use via API." targetRef={freeTierRef} position="bottom" />
                     </div>
                   ) : (
                     <>
                       {typeof displayModelConfig.inputTokenPrice === 'number' && displayModelConfig.inputTokenPrice >= 0 && (
                         <div ref={inputPriceRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('inputPrice')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('inputPrice')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                           <InputTokenIcon /> <span>{`$${displayModelConfig.inputTokenPrice.toFixed(2)}`}</span>
                           <Tooltip show={hoveredElement === 'inputPrice'} message={`$${displayModelConfig.inputTokenPrice.toFixed(2)} / 1M input tokens.`} targetRef={inputPriceRef} position="bottom" />
                         </div>
                       )}
                       {typeof displayModelConfig.outputTokenPrice === 'number' && displayModelConfig.outputTokenPrice > 0 && (
                         <div ref={outputPriceRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('outputPrice')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('outputPrice')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                           <OutputTokenIcon /> <span>{`$${displayModelConfig.outputTokenPrice.toFixed(2)}`}</span>
                           <Tooltip show={hoveredElement === 'outputPrice'} message={`$${displayModelConfig.outputTokenPrice.toFixed(2)} / 1M output tokens.`} targetRef={outputPriceRef} position="bottom" />
                         </div>
                       )}
                     </>
                   )}
                   {typeof displayModelConfig.contextWindow === 'number' && displayModelConfig.contextWindow > 0 && (
                     <div ref={contextWindowRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('contextWindow')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('contextWindow')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                       <ContextWindowIcon /> <span>{formatContextWindow(displayModelConfig.contextWindow)}</span>
                       <Tooltip show={hoveredElement === 'contextWindow'} message={`Max context window: ${displayModelConfig.contextWindow.toLocaleString()} tokens.`} targetRef={contextWindowRef} position="bottom" />
                     </div>
                   )}
                </div>
              </>
            ) : (
               <div className="h-5 mt-1 mb-2"></div> // Placeholder for spacing
            )}
          </div>

          {/* SECTION 2: Start a conversation message Section */}
          <div className="flex flex-col items-center py-5 w-full">
            <h3 className="text-base font-semibold mb-2">Start a conversation</h3>
            <p className="text-sm max-w-xs mx-auto">
              {getWelcomeMessage(contentType, isPageInjectable)}
            </p>
          </div>

          {/* SECTION 3: Content Type / Extraction Info Section */}
          <div className="flex flex-col items-center py-5 w-full">
            {isPageInjectable ? (
              <>
                {getContentTypeIconSvg(contentType) && (
                  <div className="mb-4">
                    <div
                      className="inline-flex items-center px-4 py-2.5 rounded-full shadow-sm bg-gray-100 dark:bg-gray-800 text-theme-primary dark:text-theme-primary-dark"
                      aria-label={`Current content type: ${getContentTypeName(contentType)}`}
                    >
                      <div
                        className="mr-3 flex-shrink-0 w-5 h-5"
                        dangerouslySetInnerHTML={{ __html: getContentTypeIconSvg(contentType) }}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium">
                        {getContentTypeName(contentType)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-theme-secondary">
                  <label htmlFor="content-extract-toggle" className="cursor-pointer">Extract content</label>
                  <Toggle
                    id="content-extract-toggle"
                    checked={isContentExtractionEnabled}
                    onChange={() => setIsContentExtractionEnabled(prev => !prev)}
                    disabled={!hasAnyPlatformCredentials}
                  />
                </div>
              </>
            ) : (
              <div className="mb-4">
                <div
                  className="inline-flex items-center px-4 py-2.5 rounded-full shadow-sm bg-gray-100 dark:bg-gray-800 text-theme-primary dark:text-theme-primary-dark"
                  aria-label="Content extraction not available for this page"
                >
                <span className="text-sm font-medium">
                  This page content cannot be extracted
                </span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null; // Fallback, should not be reached
  }
  // --- End Initial View Logic ---


  // --- Chat Message Display Logic (when messages exist) ---
  return (
    <div className={`flex-1 flex flex-col relative ${className}`}>
      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto flex flex-col pt-4"
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            content={message.content}
            role={message.role}
            isStreaming={message.isStreaming}
            model={message.model}
            platformIconUrl={message.platformIconUrl}
          />
        ))}
        {/* Invisible element at the very end to target for scrolling */}
        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>

      {/* Scroll Down Button */}
      <button
        onClick={() => scrollToBottom('smooth')}
        className={`
            absolute bottom-2 left-1/2 transform -translate-x-1/2 z-10
            p-1.5 rounded-full shadow-md
            bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700
            text-theme-primary dark:text-theme-primary-dark
            transition-opacity duration-300 ease-in-out
            focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary dark:focus-visible:ring-primary-dark focus-visible:ring-offset-background dark:focus-visible:ring-offset-background-dark
            ${showScrollDownButton ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `}
        aria-label="Scroll to bottom"
        title="Scroll to bottom"
        aria-hidden={!showScrollDownButton}
        tabIndex={showScrollDownButton ? 0 : -1}
      >
        <ScrollDownIcon />
      </button>
      {/* --- End Scroll Down Button --- */}
    </div>
  );
}

// Helper function for welcome message
function getWelcomeMessage(contentType, isPageInjectable) {
  if (!isPageInjectable) {
    return "Ask me anything! Type your question or prompt below.";
  }
  switch (contentType) {
    case CONTENT_TYPES.YOUTUBE:
      return "Ask about this YouTube video, or type a general question.";
    case CONTENT_TYPES.REDDIT:
      return "Ask about this Reddit post, or type a general question.";
    case CONTENT_TYPES.PDF:
      return "Ask about this PDF document, or type a general question.";
    case CONTENT_TYPES.GENERAL:
    default:
      return "Ask about this page's content, or type a general question.";
  }
}

export default ChatArea;
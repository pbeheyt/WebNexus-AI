// src/sidebar/components/ChatArea.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { useSidebarPlatform } from '../../contexts/platform';
import { MessageBubble } from '../../components/messaging/MessageBubble';
import { Toggle } from '../../components/core/Toggle';
import { Tooltip } from '../../components/layout/Tooltip';
import { useContent } from '../../contexts/ContentContext';
import { CONTENT_TYPES } from '../../shared/constants';
import { getContentTypeIconSvg } from '../../shared/utils/icon-utils';
import { isInjectablePage } from '../../shared/utils/content-utils';

// --- Icon Definitions ---
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
// --- End Icon Definitions ---

// --- Helper Function ---
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
  const [userInteractedWithScroll, setUserInteractedWithScroll] = useState(false);
  const {
    platforms,
    selectedPlatformId,
    selectedModel,
    hasAnyPlatformCredentials,
  } = useSidebarPlatform();

  // --- Local State for Stable Display ---
  // These hold the currently *displayed* platform and model info.
  // They only update when BOTH the selected platform and the corresponding modelConfigData are ready.
  const [displayPlatformConfig, setDisplayPlatformConfig] = useState(null);
  const [displayModelConfig, setDisplayModelConfig] = useState(null);

  // Effect to update display configs smoothly and synchronously
  useEffect(() => {
    // Find the target platform config based on selectedPlatformId
    const targetPlatform = platforms.find(p => p.id === selectedPlatformId);

    // Check if the model config data is loaded and matches the selected model
    const isModelConfigReady = modelConfigData && selectedModel && modelConfigData.id === selectedModel;

    // Check if the target platform was found
    const isPlatformReady = !!targetPlatform;

    // Only update BOTH display states if BOTH platform and model data are ready for the current selection
    if (isPlatformReady && isModelConfigReady) {
      // Update platform display state
      setDisplayPlatformConfig({
          id: targetPlatform.id,
          name: targetPlatform.name,
          iconUrl: targetPlatform.iconUrl
      });
      // Update model display state
      setDisplayModelConfig(modelConfigData);
    }
    // If not both ready (e.g., modelConfigData is still loading for the new selection),
    // do nothing - keep displaying the previous stable state to avoid flickering.

  }, [platforms, selectedPlatformId, modelConfigData, selectedModel]);
  // --- End Local State ---

  // Helper function to get user-friendly content type names
  const getContentTypeName = (type) => {
    switch (type) {
      case CONTENT_TYPES.YOUTUBE: return "YouTube Video";
      case CONTENT_TYPES.REDDIT: return "Reddit Post";
      case CONTENT_TYPES.PDF: return "PDF Document";
      case CONTENT_TYPES.GENERAL: return "Web Page";
      default: return "Content";
    }
  };

  // --- Scroll Handling Logic ---
  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    if (isProcessing) {
      // Check if user scrolled up while processing
      const threshold = Math.max(10, scrollContainer.clientHeight * 0.05); // 5% or 10px threshold
      const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight <= threshold;
      if (!isAtBottom) {
        setUserInteractedWithScroll(true);
      }
    } else {
      // Check if user scrolled up when not processing (to prevent auto-scroll later)
       const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop === scrollContainer.clientHeight;
       const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight <= 10; // Small tolerance
       if (!isAtBottom && !isNearBottom) {
          setUserInteractedWithScroll(true);
       } else {
          // Allow auto-scroll if user scrolls back to the very bottom
          setUserInteractedWithScroll(false);
       }
    }
  }, [isProcessing]); // Added isProcessing dependency

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]); // handleScroll is stable due to useCallback

  useEffect(() => {
    // Auto-scroll to bottom if user hasn't scrolled up manually
    if (!userInteractedWithScroll && messagesEndRef.current && scrollContainerRef.current) {
        // Only scroll if near the bottom or initial load
        const scrollContainer = scrollContainerRef.current;
        const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight <= scrollContainer.clientHeight * 0.5; // e.g., within half viewport height from bottom

        // Use smooth scroll for new messages, instant for initial loads might be better?
        // For simplicity, using smooth always when auto-scrolling.
        if (isNearBottom || messages.length <= 1) { // Scroll on first message too
             messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }
  }, [messages, userInteractedWithScroll]); // Rerun when messages update

  useEffect(() => {
    // Reset scroll interaction flag when processing starts,
    // allowing auto-scroll for the new response unless user scrolls up again.
    if (isProcessing) {
        setUserInteractedWithScroll(false);
    }
  }, [isProcessing]);
  // --- End Scroll Handling ---


  // Helper function for welcome message
  const getWelcomeMessage = (type, isInjectable) => {
    // Adjust welcome message slightly if extraction isn't possible
    if (!isInjectable) {
      return "Ask a general question or start a new conversation.";
    }
    switch (type) {
      case CONTENT_TYPES.YOUTUBE: return "Ask a question about this YouTube video or request a summary.";
      case CONTENT_TYPES.REDDIT: return "Ask a question about this Reddit post or request a summary.";
      case CONTENT_TYPES.PDF: return "Ask a question about this PDF document or request a summary.";
      case CONTENT_TYPES.GENERAL: return "Ask a question about this web page or request a summary.";
      default: return "Ask a question to get started.";
    }
  };

  // Helper function to open settings
  const openApiSettings = () => {
    try {
      // Make sure 'chrome' is available (usually is in extension contexts)
      if (chrome && chrome.tabs && chrome.runtime) {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html#api-settings') });
      } else {
         console.warn("Chrome APIs not available. Cannot open settings tab.");
         // Potentially provide alternative feedback to the user
      }
    } catch (error) {
      console.error('Could not open API options page:', error);
    }
  };

  // Determine if the current page allows content extraction
  const isPageInjectable = currentTab?.url ? isInjectablePage(currentTab.url) : false;

  // --- Initial View Logic (when no messages) ---
  if (messages.length === 0) {

    // --- No Credentials View ---
    // Show this immediately if no credentials are configured.
    if (!hasAnyPlatformCredentials) {
      return (
        <div className={`${className} flex flex-col items-center justify-center h-full text-theme-secondary text-center px-5`}>
          <button
            onClick={openApiSettings}
            className="flex flex-col items-center p-4 rounded-lg hover:bg-theme-hover transition-colors w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Configure API Credentials in Settings"
          >
            {/* Settings Icon SVG */}
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
    // Show spinner ONLY if credentials exist BUT we haven't successfully loaded
    // and set the *initial* displayPlatformConfig yet (it's still null).
    // This happens only on the very first load after credentials are set.
    if (hasAnyPlatformCredentials && displayPlatformConfig === null) {
      return (
        <div className={`${className} flex items-center justify-center h-full`}>
          {/* Tailwind CSS Spinner */}
          <div className="w-6 h-6 border-4 border-theme-secondary border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading model information"></div>
        </div>
      );
    }

    // --- Welcome Message View ---
    // Show this if credentials exist AND the initial platform/model info has been loaded
    // and set into displayPlatformConfig at least once. This avoids the spinner on subsequent
    // platform/model switches when messages are still empty.
    if (hasAnyPlatformCredentials && displayPlatformConfig !== null) {
      return (
        <div className={`${className} flex flex-col items-center justify-evenly h-full text-theme-secondary text-center px-5 py-4 overflow-y-auto`}>

          {/* SECTION 1: Platform Logo, Model Name, and Details Section */}
          <div className="flex flex-col items-center py-5 w-full">
             {/* Display platform logo from stable local state */}
            <img
              src={displayPlatformConfig.iconUrl}
              alt={`${displayPlatformConfig.name || 'Platform'} logo`}
              className="w-12 h-12 mb-3 object-contain"
            />
            {/* Display model details from stable local state */}
            {displayModelConfig ? (
              <>
                {/* Model Name */}
                <div className="text-sm text-theme-primary dark:text-theme-primary-dark font-medium" title={displayModelConfig.id}>
                  {displayModelConfig.name || displayModelConfig.id}
                </div>
                {/* Model Description */}
                {displayModelConfig.description && (
                  <p className="text-xs text-theme-secondary text-center mt-1 mb-2 max-w-xs mx-auto">
                    {displayModelConfig.description}
                  </p>
                )}
                {/* Model Specific Details (Price, Context Window) */}
                <div className="flex flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-theme-secondary mt-2">
                  {/* Price Section */}
                  {displayModelConfig.inputTokenPrice === 0 && displayModelConfig.outputTokenPrice === 0 ? (
                     // Free Tier Indicator
                     <div ref={freeTierRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('freeTier')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('freeTier')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                       <FreeTierIcon /> <span>Free</span>
                       <Tooltip show={hoveredElement === 'freeTier'} message="This model is currently free to use via API." targetRef={freeTierRef} position="bottom" />
                     </div>
                   ) : (
                     // Paid Tier Indicators
                     <>
                       {typeof displayModelConfig.inputTokenPrice === 'number' && displayModelConfig.inputTokenPrice >= 0 && ( // Show even if 0 for clarity if output is paid
                         <div ref={inputPriceRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('inputPrice')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('inputPrice')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                           <InputTokenIcon /> <span>{`$${displayModelConfig.inputTokenPrice.toFixed(2)}`}</span>
                           <Tooltip show={hoveredElement === 'inputPrice'} message={`$${displayModelConfig.inputTokenPrice.toFixed(2)} / 1M input tokens.`} targetRef={inputPriceRef} position="bottom" />
                         </div>
                       )}
                       {typeof displayModelConfig.outputTokenPrice === 'number' && displayModelConfig.outputTokenPrice > 0 && ( // Only show output if > 0 usually
                         <div ref={outputPriceRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('outputPrice')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('outputPrice')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                           <OutputTokenIcon /> <span>{`$${displayModelConfig.outputTokenPrice.toFixed(2)}`}</span>
                           <Tooltip show={hoveredElement === 'outputPrice'} message={`$${displayModelConfig.outputTokenPrice.toFixed(2)} / 1M output tokens.`} targetRef={outputPriceRef} position="bottom" />
                         </div>
                       )}
                     </>
                   )}
                   {/* Context Window Indicator */}
                   {typeof displayModelConfig.contextWindow === 'number' && displayModelConfig.contextWindow > 0 && (
                     <div ref={contextWindowRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('contextWindow')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('contextWindow')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                       <ContextWindowIcon /> <span>{formatContextWindow(displayModelConfig.contextWindow)}</span>
                       <Tooltip show={hoveredElement === 'contextWindow'} message={`Max context window: ${displayModelConfig.contextWindow.toLocaleString()} tokens.`} targetRef={contextWindowRef} position="bottom" />
                     </div>
                   )}
                </div>
              </>
            ) : (
              // Optional: Placeholder if model config somehow isn't ready yet, though useEffect should prevent this state often
               <div className="h-5 mt-1 mb-2"></div> // Placeholder height to prevent layout jump
            )}
          </div>

          {/* SECTION 2: Start a conversation message Section */}
          <div className="flex flex-col items-center py-5 w-full">
            <h3 className="text-base font-semibold mb-2">Start a conversation</h3>
            <p className="text-sm max-w-xs mx-auto">
              {/* Pass isPageInjectable to adjust the welcome message */}
              {getWelcomeMessage(contentType, isPageInjectable)}
            </p>
          </div>

          {/* SECTION 3: Content Type / Extraction Info Section */}
          <div className="flex flex-col items-center py-5 w-full">
            {isPageInjectable ? (
              // --- Case: Page IS Injectable ---
              <>
                {/* Content Type Badge Display */}
                {getContentTypeIconSvg(contentType) && (
                  <div className="mb-4">
                    <div
                      className="inline-flex items-center px-4 py-2.5 rounded-full shadow-sm
                        bg-gray-100 dark:bg-gray-800
                        text-theme-primary dark:text-theme-primary-dark"
                      aria-label={`Current content type: ${getContentTypeName(contentType)}`}
                    >
                      <div
                        className="mr-3 flex-shrink-0 w-5 h-5" // Ensure icon size consistency
                        dangerouslySetInnerHTML={{ __html: getContentTypeIconSvg(contentType) }}
                        aria-hidden="true" // Icon is decorative
                      />
                      <span className="text-sm font-medium">
                        {getContentTypeName(contentType)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Content Extraction Toggle */}
                <div className="flex items-center gap-3 text-sm text-theme-secondary">
                  <label htmlFor="content-extract-toggle" className="cursor-pointer">Extract content</label>
                  <Toggle
                    id="content-extract-toggle"
                    checked={isContentExtractionEnabled}
                    onChange={() => setIsContentExtractionEnabled(prev => !prev)}
                    disabled={!hasAnyPlatformCredentials} // Should always be enabled here based on logic flow, but keep for safety
                  />
                </div>
              </>
            ) : (
              // --- Case: Page IS NOT Injectable ---
              // Display the new badge indicating extraction is not possible
              <div className="mb-4"> 
                <div
                  className="inline-flex items-center px-4 py-2.5 rounded-full shadow-sm
                    bg-gray-100 dark:bg-gray-800
                    text-theme-primary dark:text-theme-primary-dark"
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

    // Fallback if none of the above conditions are met (shouldn't normally happen)
    return null;
  }


  // --- Chat Message Display Logic (when messages exist) ---
  // This part remains the same, renders when messages.length > 0
  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto flex flex-col pt-2">
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
      {/* Invisible element to scroll to */}
      <div ref={messagesEndRef} style={{ height: '1px' }} />
    </div>
  );
}

export default ChatArea;
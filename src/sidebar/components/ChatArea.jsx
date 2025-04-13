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
    platforms, // Need platforms array from context
    selectedPlatformId,
    selectedModel,
    hasAnyPlatformCredentials,
    isLoading // General loading state from platform context
  } = useSidebarPlatform();

  // --- Local State for Stable Display ---
  const [displayPlatformConfig, setDisplayPlatformConfig] = useState(null); // Holds { id, name, iconUrl }
  const [displayModelConfig, setDisplayModelConfig] = useState(null);

  // Effect to update display configs smoothly and synchronously
  useEffect(() => {
    // 1. Find the target platform config based on selectedPlatformId
    const targetPlatform = platforms.find(p => p.id === selectedPlatformId);

    // 2. Check if the model config data is valid and matches the selected model
    const isModelConfigReady = modelConfigData && selectedModel && modelConfigData.id === selectedModel;

    // 3. Check if the target platform was found
    const isPlatformReady = !!targetPlatform;

    // 4. Only update BOTH display states if BOTH platform and model data are ready for the current selection
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
    // If not both ready, do nothing - keep displaying the previous stable state.

  }, [platforms, selectedPlatformId, modelConfigData, selectedModel]); // Dependencies updated
  // --- End Local State ---


  // Find the details of the selected platform (still needed for other logic potentially)
  const selectedPlatform = platforms.find(p => p.id === selectedPlatformId) || {};

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
      const threshold = Math.max(10, scrollContainer.clientHeight * 0.05);
      const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight <= threshold;
      setUserInteractedWithScroll(!isAtBottom);
    }
  }, [isProcessing]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    if (!userInteractedWithScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, userInteractedWithScroll]);

  useEffect(() => {
    setUserInteractedWithScroll(false);
  }, [isProcessing]);
  // --- End Scroll Handling ---


  // Helper function for welcome message
  const getWelcomeMessage = (type) => {
    switch (type) {
      case CONTENT_TYPES.YOUTUBE: return "Ask a question about this YouTube video or request a summary.";
      case CONTENT_TYPES.REDDIT: return "Ask a question about this Reddit post or request a summary.";
      case CONTENT_TYPES.PDF: return "Ask a question about this PDF document or request a summary.";
      case CONTENT_TYPES.GENERAL: return "Ask a question about this web page or request a summary.";
      default: return "Ask a question or request a summary to get started.";
    }
  };

  // Helper function to open settings
  const openApiSettings = () => {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html#api-settings') });
    } catch (error) {
      console.error('Could not open API options page:', error);
    }
  };

  // Determine if the current page allows content extraction
  const isPageInjectable = currentTab?.url ? isInjectablePage(currentTab.url) : false;

  // --- Initial View Logic (when no messages) ---
  if (messages.length === 0) {
    // Show spinner if general loading OR if display states aren't ready for the current selection
    const isDisplayReadyForSelection = displayPlatformConfig?.id === selectedPlatformId && displayModelConfig?.id === selectedModel;
    const showInitialLoadingSpinner = isLoading || (hasAnyPlatformCredentials && (selectedPlatformId || selectedModel) && !isDisplayReadyForSelection);

    if (showInitialLoadingSpinner) {
      return (
        <div className={`${className} flex items-center justify-center h-full`}>
          {/* Tailwind CSS Spinner */}
          <div className="w-6 h-6 border-4 border-theme-secondary border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    // Render Credentials Message or Welcome Message
    return (
      <div className={`${className} flex flex-col items-center justify-evenly h-full text-theme-secondary text-center px-5`}>
        {/* Check for credentials */}
        {!hasAnyPlatformCredentials ? (
          // No Credentials Message
          <button
            onClick={openApiSettings}
            className="flex flex-col items-center p-4 rounded-lg hover:bg-theme-hover transition-colors w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-3 text-theme-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1.51-1V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H15a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <h3 className="text-base font-semibold mb-2">API Credentials Required</h3>
            <p className="text-sm">
              Click here to configure API keys in settings.
            </p>
          </button>
        ) : (
          // Welcome Message (Credentials Exist)
          <>
            {/* Platform Logo, Model Name, and Details */}
            <div className="flex flex-col items-center">
              {/* RENDER BASED ON displayPlatformConfig */}
              {displayPlatformConfig ? ( // Use local state for platform
                <>
                  <img
                    src={displayPlatformConfig.iconUrl} // Use local state
                    alt={displayPlatformConfig.name || 'Platform'} // Use local state
                    className="w-12 h-12 mb-3"
                  />
                  {/* Display model name from the stable display config */}
                  {displayModelConfig && ( // Use local state for model
                    <div className="text-sm text-theme-primary dark:text-theme-primary-dark font-medium">
                      {displayModelConfig.name || displayModelConfig.id}
                    </div>
                  )}
                  {/* Model Details Section - RENDER BASED ON displayModelConfig */}
                  {displayModelConfig && ( // Use local state for model details
                    <div className="flex flex-row items-center justify-center gap-3 text-xs text-theme-secondary mt-2">
                      {/* Price Section */}
                      {displayModelConfig.inputTokenPrice === 0 && displayModelConfig.outputTokenPrice === 0 ? (
                        <div ref={freeTierRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('freeTier')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('freeTier')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                          <FreeTierIcon /> <span>Free</span>
                          <Tooltip show={hoveredElement === 'freeTier'} message="This model is currently free to use via API." targetRef={freeTierRef} position="bottom" />
                        </div>
                      ) : (
                        <>
                          {typeof displayModelConfig.inputTokenPrice === 'number' && displayModelConfig.inputTokenPrice > 0 && (
                            <div ref={inputPriceRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('inputPrice')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('inputPrice')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                              <InputTokenIcon /> <span>{`$${displayModelConfig.inputTokenPrice.toFixed(2)}`}</span>
                              <Tooltip show={hoveredElement === 'inputPrice'} message={`Est. cost per 1 million input tokens.`} targetRef={inputPriceRef} position="bottom" />
                            </div>
                          )}
                          {typeof displayModelConfig.outputTokenPrice === 'number' && displayModelConfig.outputTokenPrice > 0 && (
                            <div ref={outputPriceRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('outputPrice')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('outputPrice')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                              <OutputTokenIcon /> <span>{`$${displayModelConfig.outputTokenPrice.toFixed(2)}`}</span>
                              <Tooltip show={hoveredElement === 'outputPrice'} message={`Est. cost per 1 million output tokens.`} targetRef={outputPriceRef} position="bottom" />
                            </div>
                          )}
                        </>
                      )}
                      {/* Context Window */}
                      {typeof displayModelConfig.contextWindow === 'number' && displayModelConfig.contextWindow > 0 && (
                        <div ref={contextWindowRef} className="flex items-center relative cursor-help" onMouseEnter={() => setHoveredElement('contextWindow')} onMouseLeave={() => setHoveredElement(null)} onFocus={() => setHoveredElement('contextWindow')} onBlur={() => setHoveredElement(null)} tabIndex="0">
                          <ContextWindowIcon /> <span>{formatContextWindow(displayModelConfig.contextWindow)}</span>
                          <Tooltip show={hoveredElement === 'contextWindow'} message={`Max context window: ${displayModelConfig.contextWindow.toLocaleString()} tokens.`} targetRef={contextWindowRef} position="bottom" />
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                // Placeholder if displayPlatformConfig is not ready
                <div className="w-12 h-12 mb-3"></div>
              )}
            </div>

            {/* Start a conversation message */}
            <div className="flex flex-col items-center">
              <h3 className="text-base font-semibold mb-2">Start a conversation</h3>
              <p className="text-sm">
                {getWelcomeMessage(contentType)}
              </p>
            </div>

            {/* Content Type Badge and Extraction Info/Toggle */}
            <div className="flex flex-col items-center">
              {/* Content Type Badge Display */}
              {getContentTypeIconSvg(contentType) && (
                <div className="mb-4">
                  <div
                    className="inline-flex items-center px-4 py-2.5 rounded-full shadow-sm
                      bg-gray-100 dark:bg-gray-800
                      text-theme-primary dark:text-theme-primary-dark"
                  >
                    <div
                      className="mr-3"
                      dangerouslySetInnerHTML={{ __html: getContentTypeIconSvg(contentType) }}
                    />
                    <span className="text-sm font-medium">
                      {getContentTypeName(contentType)}
                    </span>
                  </div>
                </div>
              )}

              {/* Conditional Rendering for Extraction */}
              {isPageInjectable ? (
                <div className="flex items-center gap-3 text-sm text-theme-secondary">
                  <label htmlFor="content-extract-toggle" className="cursor-pointer">Extract content</label>
                  <Toggle
                    id="content-extract-toggle"
                    checked={isContentExtractionEnabled}
                    onChange={() => setIsContentExtractionEnabled(prev => !prev)}
                    disabled={!hasAnyPlatformCredentials}
                  />
                </div>
              ) : (
                // Show Message if page is not injectable
                <p className="text-xs text-theme-secondary">
                  Extraction not available for this page type.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Chat Message Display Logic (when messages exist) ---
  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto flex flex-col">
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
      <div ref={messagesEndRef} /> {/* Scroll anchor */}
    </div>
  );
}

export default ChatArea;
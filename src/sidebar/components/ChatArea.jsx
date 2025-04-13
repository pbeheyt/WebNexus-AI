// src/sidebar/components/ChatArea.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { useSidebarPlatform } from '../../contexts/platform';
import { MessageBubble } from '../../components/messaging/MessageBubble';
import { Toggle } from '../../components/core/Toggle';
import { useContent } from '../../contexts/ContentContext';
import { CONTENT_TYPES } from '../../shared/constants';
import { getContentTypeIconSvg } from '../../shared/utils/icon-utils';
import { isInjectablePage } from '../../shared/utils/content-utils';

function ChatArea({ className = '' }) {
  const { messages, isProcessing, isContentExtractionEnabled, setIsContentExtractionEnabled } = useSidebarChat();
  const { contentType, currentTab } = useContent();
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [userInteractedWithScroll, setUserInteractedWithScroll] = useState(false);
  const {
    platforms,
    selectedPlatformId,
    selectedModel,
    hasAnyPlatformCredentials,
    isLoading // This indicates if *any* platform data fetching is happening
  } = useSidebarPlatform();

  // Find the details of the selected platform
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
    // Show spinner ONLY if loading AND essential platform/model info is missing.
    const showInitialLoadingSpinner = isLoading && (!selectedPlatformId || !selectedModel);

    if (showInitialLoadingSpinner) {
      return (
        <div className={`${className} flex items-center justify-center h-full`}>
          {/* Tailwind CSS Spinner */}
          <div className="w-6 h-6 border-4 border-theme-secondary border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
    }

    // Render Credentials Message or Welcome Message (only if not in the initial loading state)
    return (
      <div className={`${className} flex flex-col items-center justify-evenly h-full text-theme-secondary text-center px-5`}>
        {/* Check for credentials AFTER initial loading is done */}
        {!hasAnyPlatformCredentials ? (
          // Display message if no credentials are set up
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
          // Standard welcome message content (shown if credentials exist and not initial loading)
          <>
            {/* Platform Logo and Model */}
            <div className="flex flex-col items-center">
              {/* Use selectedPlatformId and selectedPlatform safely */}
              {selectedPlatformId && selectedPlatform.iconUrl ? (
                <>
                  <img
                    src={selectedPlatform.iconUrl}
                    alt={selectedPlatform.name || 'Platform'}
                    className="w-12 h-12 mb-3"
                  />
                  {selectedModel && (
                    <div className="text-sm text-theme-secondary">
                      {selectedModel}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-12 h-12 mb-3"></div> // Placeholder if no platform/icon selected yet
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
                // Show Toggle and Label if page is injectable
                <div className="flex flex-col items-center gap-1 text-sm text-theme-secondary">
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
                <p className="text-sm text-theme-secondary mt-1">
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
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto flex flex-col my-1">
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
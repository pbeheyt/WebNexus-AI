// src/sidebar/components/ChatArea.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { useSidebarPlatform } from '../../contexts/platform';
import { MessageBubble } from '../../components/messaging/MessageBubble';
import { Toggle } from '../../components/core/Toggle';
import { useContent } from '../../contexts/ContentContext';
import { CONTENT_TYPES } from '../../shared/constants';
import { getContentTypeIconSvg } from '../../shared/utils/icon-utils'; // Import the utility

function ChatArea({ className = '' }) {
  const { messages, isProcessing, isContentExtractionEnabled, setIsContentExtractionEnabled } = useSidebarChat();
  const { contentType } = useContent();
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [userInteractedWithScroll, setUserInteractedWithScroll] = useState(false);
  const { platforms, selectedPlatformId, selectedModel, hasAnyPlatformCredentials } = useSidebarPlatform();
  const selectedPlatform = platforms.find(p => p.id === selectedPlatformId) || {};

  const getContentTypeName = (type) => {
    switch (type) {
      case CONTENT_TYPES.YOUTUBE:
        return "YouTube Video";
      case CONTENT_TYPES.REDDIT:
        return "Reddit Post";
      case CONTENT_TYPES.PDF:
        return "PDF Document";
      case CONTENT_TYPES.GENERAL:
        return "Web Page";
      default:
        return "Content";
    }
  };

  // This function has been removed as we no longer use border accents

  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    if (isProcessing) {
      // Calculate dynamic threshold (10% of height, min 10px)
      const threshold = Math.max(10, scrollContainer.clientHeight * 0.10); 
      const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight <= threshold; // Use the calculated threshold
      
      // Keep the logic for setting userInteractedWithScroll based on isAtBottom
      if (!isAtBottom) {
        setUserInteractedWithScroll(true);
      } else {
        setUserInteractedWithScroll(false);
      }
    }
  }, [isProcessing]); // Keep original dependencies

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
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

  const getWelcomeMessage = (type) => {
    switch (type) {
      case CONTENT_TYPES.YOUTUBE:
        return "Ask a question about this YouTube video or request a summary.";
      case CONTENT_TYPES.REDDIT:
        return "Ask a question about this Reddit post or request a summary.";
      case CONTENT_TYPES.PDF:
        return "Ask a question about this PDF document or request a summary.";
      case CONTENT_TYPES.GENERAL:
        return "Ask a question about this web page or request a summary.";
      default:
        return "Ask a question or request a summary to get started.";
    }
  };

  if (messages.length === 0) {
    return (
      <div className={`${className} flex flex-col items-center justify-evenly h-full text-theme-secondary text-center px-5`}>
        {!hasAnyPlatformCredentials ? (
          // Display message if no credentials are set up
          <div className="flex flex-col items-center">
            <div className="text-4xl mb-4">⚙️</div> 
            <h3 className="text-base font-semibold mb-2">API Credentials Required</h3>
            <p className="text-sm">
              Please configure API keys in the extension settings to enable chat features.
            </p>
          </div>
        ) : (
          <>
            {/* First div: Platform Logo and Model */}
            <div className="flex flex-col items-center">
              {selectedPlatformId && selectedPlatform.iconUrl ? (
                <>
                  <img
                    src={selectedPlatform.iconUrl}
                    alt={selectedPlatform.name}
                    className="w-12 h-12 mb-3"
                  />
                  {selectedModel && (
                    <div className="text-sm text-theme-secondary">
                      {selectedModel}
                    </div>
                  )}
                </>
              ) : (
                <div></div>
              )}
            </div>

            {/* Second div: Start a conversation message */}
            <div className="flex flex-col items-center">
              <h3 className="text-base font-semibold mb-2">Start a conversation</h3>
              <p className="text-sm">
                {getWelcomeMessage(contentType)}
              </p>
            </div>
            
            {/* Third div: Content Type Badge and Toggle */}
            <div className="flex flex-col items-center"> 
              {/* Content Type Badge Display */}
              {getContentTypeIconSvg(contentType) && (
                <div className="mb-4">
                  {/* Content Type Badge */}
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
              
              {/* Content Extraction Toggle - Kept as is */}
              <div className="flex items-center justify-center gap-3 text-sm text-theme-secondary">
                <label htmlFor="content-extract-toggle" className="cursor-pointer">Extract content</label>
                <Toggle
                  id="content-extract-toggle"
                  checked={isContentExtractionEnabled}
                  onChange={() => setIsContentExtractionEnabled(prev => !prev)}
                  disabled={!hasAnyPlatformCredentials}
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto flex flex-col mb-2">
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

      <div ref={messagesEndRef} />
    </div>
  );
}

export default ChatArea;

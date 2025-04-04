// src/sidebar/components/ChatArea.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { useSidebarPlatform } from '../../contexts/platform';
import { MessageBubble } from '../../components/messaging/MessageBubble';
import { useContent } from '../../components/content/ContentContext'; // Added import
import { CONTENT_TYPES } from '../../shared/constants'; // Added import

function ChatArea({ className = '' }) {
  const { messages, isProcessing } = useSidebarChat();
  const { contentType } = useContent(); // Get contentType
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null); // Ref for the scrollable container
  const [userInteractedWithScroll, setUserInteractedWithScroll] = useState(false);
  const { platforms, selectedPlatformId, selectedModel, hasAnyPlatformCredentials } = useSidebarPlatform(); // Add hasAnyPlatformCredentials
  const selectedPlatform = platforms.find(p => p.id === selectedPlatformId) || {};

  // Handle user scroll interaction
  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    // Check if processing (streaming)
    if (isProcessing) {
      const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight <= 25;
      if (!isAtBottom) {
        setUserInteractedWithScroll(true); // User scrolled up during streaming
      } else {
        setUserInteractedWithScroll(false); // User scrolled back to bottom during streaming
      }
    }
  }, [isProcessing]); // Dependency: isProcessing

  // Effect to add/remove scroll listener
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]); // Dependency: handleScroll callback

  // Auto-scroll to bottom when messages change, only if user hasn't scrolled up
  useEffect(() => {
    if (!userInteractedWithScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, userInteractedWithScroll]); // Dependencies: messages, userInteractedWithScroll

  // Reset scroll interaction state when processing starts/stops
  useEffect(() => {
    setUserInteractedWithScroll(false);
  }, [isProcessing]); // Dependency: isProcessing

  // Helper function to get the welcome message based on content type
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
      <div className={`${className} flex flex-col items-center justify-center h-full text-theme-secondary text-center px-5`}>
        {!hasAnyPlatformCredentials ? (
          // Display message if no credentials are set up
          <>
            <div className="text-4xl mb-4">⚙️</div> 
            <h3 className="text-base font-semibold mb-2">API Credentials Required</h3>
            <p className="text-sm mb-4">
              Please configure API keys in the extension settings to enable chat features.
            </p>
          </>
        ) : (
          <>
            {selectedPlatformId && selectedPlatform.iconUrl ? (
              <>
                <img
                  src={selectedPlatform.iconUrl}
                  alt={selectedPlatform.name}
                  className="w-12 h-12 mb-2"
                />
                {/* Display just the model name below the platform logo */}
                {selectedModel && (
                  <div className="text-sm text-theme-secondary mb-4">
                    {selectedModel}
                  </div>
                )}
              </>
            ) : (
              <div className="text-4xl mb-4 text-theme-secondary/50">🤖</div>
            )}
            <h3 className="text-base font-semibold mb-2">Start a conversation</h3>
            <p className="text-sm mb-4">
              {getWelcomeMessage(contentType)}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    // Attach the ref to the scrollable container
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

      {/* Only show this typing indicator if there's no streaming message */}
      {isProcessing && !messages.some(m => m.isStreaming) && (
        <div className="flex gap-1 p-3">
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce"></div>
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

export default ChatArea;
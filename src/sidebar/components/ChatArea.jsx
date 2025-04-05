// src/sidebar/components/ChatArea.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { useSidebarPlatform } from '../../contexts/platform';
import { MessageBubble } from '../../components/messaging/MessageBubble';
import { Toggle } from '../../components/core/Toggle'; // Added Toggle import
import { useContent } from '../../contexts/ContentContext'; // Corrected path
import { CONTENT_TYPES } from '../../shared/constants'; // Added import

function ChatArea({ className = '' }) {
  const { messages, isProcessing, isContentExtractionEnabled, setIsContentExtractionEnabled } = useSidebarChat(); // Added state
  const { contentType } = useContent(); // Get contentType
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null); // Ref for the scrollable container
  const [userInteractedWithScroll, setUserInteractedWithScroll] = useState(false);
  const { platforms, selectedPlatformId, selectedModel, hasAnyPlatformCredentials } = useSidebarPlatform(); // Add hasAnyPlatformCredentials
  const selectedPlatform = platforms.find(p => p.id === selectedPlatformId) || {};

  const getContentTypeIconSvg = (contentType) => {
    let iconSvg = '';
    // Use a specific grey for the general icon, other colors as defined
    const generalColor = '#6B7280'; // Changed from 'currentColor' to grey-500 hex
    const redditColor = '#FF4500';
    const pdfColor = '#F40F02';

    switch (contentType) {
      case CONTENT_TYPES.YOUTUBE:
        // Reduced size
        iconSvg = `
          <svg class="youtube-icon w-5 h-5" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Layer_1" viewBox="0 0 461.001 461.001" xml:space="preserve">
            <g>
              <path style="fill:#F61C0D;" d="M365.257,67.393H95.744C42.866,67.393,0,110.259,0,163.137v134.728   c0,52.878,42.866,95.744,95.744,95.744h269.513c52.878,0,95.744-42.866,95.744-95.744V163.137   C461.001,110.259,418.135,67.393,365.257,67.393z M300.506,237.056l-126.06,60.123c-3.359,1.602-7.239-0.847-7.239-4.568V168.607   c0-3.774,3.982-6.22,7.348-4.514l126.06,63.881C304.363,229.873,304.298,235.248,300.506,237.056z"/>
            </g>
          </svg>
        `;
        break;
      case CONTENT_TYPES.REDDIT:
        // Reduced size
        iconSvg = `
          <svg class="reddit-icon w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
            <circle cx="400" cy="400" fill="#ff4500" r="400"/>
            <path d="M666.8 400c.08 5.48-.6 10.95-2.04 16.24s-3.62 10.36-6.48 15.04c-2.85 4.68-6.35 8.94-10.39 12.65s-8.58 6.83-13.49 9.27c.11 1.46.2 2.93.25 4.4a107.268 107.268 0 0 1 0 8.8c-.05 1.47-.14 2.94-.25 4.4 0 89.6-104.4 162.4-233.2 162.4S168 560.4 168 470.8c-.11-1.46-.2-2.93-.25-4.4a107.268 107.268 0 0 1 0-8.8c.05-1.47.14-2.94.25-4.4a58.438 58.438 0 0 1-31.85-37.28 58.41 58.41 0 0 1 7.8-48.42 58.354 58.354 0 0 1 41.93-25.4 58.4 58.4 0 0 1 46.52 15.5 286.795 286.795 0 0 1 35.89-20.71c12.45-6.02 25.32-11.14 38.51-15.3s26.67-7.35 40.32-9.56 27.45-3.42 41.28-3.63L418 169.6c.33-1.61.98-3.13 1.91-4.49.92-1.35 2.11-2.51 3.48-3.4 1.38-.89 2.92-1.5 4.54-1.8 1.61-.29 3.27-.26 4.87.09l98 19.6c9.89-16.99 30.65-24.27 48.98-17.19s28.81 26.43 24.71 45.65c-4.09 19.22-21.55 32.62-41.17 31.61-19.63-1.01-35.62-16.13-37.72-35.67L440 186l-26 124.8c13.66.29 27.29 1.57 40.77 3.82a284.358 284.358 0 0 1 77.8 24.86A284.412 284.412 0 0 1 568 360a58.345 58.345 0 0 1 29.4-15.21 58.361 58.361 0 0 1 32.95 3.21 58.384 58.384 0 0 1 25.91 20.61A58.384 58.384 0 0 1 666.8 400zm-396.96 55.31c2.02 4.85 4.96 9.26 8.68 12.97 3.71 3.72 8.12 6.66 12.97 8.68A40.049 40.049 0 0 0 306.8 480c16.18 0 30.76-9.75 36.96-24.69 6.19-14.95 2.76-32.15-8.68-43.59s-28.64-14.87-43.59-8.68c-14.94 6.2-24.69 20.78-24.69 36.96 0 5.25 1.03 10.45 3.04 15.31zm229.1 96.02c2.05-2 3.22-4.73 3.26-7.59.04-2.87-1.07-5.63-3.07-7.68s-4.73-3.22-7.59-3.26c-2.87-.04-5.63 1.07-7.94 2.8a131.06 131.06 0 0 1-19.04 11.35 131.53 131.53 0 0 1-20.68 7.99c-7.1 2.07-14.37 3.54-21.72 4.39-7.36.85-14.77 1.07-22.16.67-7.38.33-14.78.03-22.11-.89a129.01 129.01 0 0 1-21.64-4.6c-7.08-2.14-13.95-4.88-20.56-8.18s-12.93-7.16-18.89-11.53c-2.07-1.7-4.7-2.57-7.38-2.44s-5.21 1.26-7.11 3.15c-1.89 1.9-3.02 4.43-3.15 7.11s.74 5.31 2.44 7.38c7.03 5.3 14.5 9.98 22.33 14s16 7.35 24.4 9.97 17.01 4.51 25.74 5.66c8.73 1.14 17.54 1.53 26.33 1.17 8.79.36 17.6-.03 26.33-1.17A153.961 153.961 0 0 0 476.87 564c7.83-4.02 15.3-8.7 22.33-14zm-7.34-68.13c5.42.06 10.8-.99 15.81-3.07 5.01-2.09 9.54-5.17 13.32-9.06s6.72-8.51 8.66-13.58A39.882 39.882 0 0 0 532 441.6c0-16.18-9.75-30.76-24.69-36.96-14.95-6.19-32.15-2.76-43.59 8.68s-14.87 28.64-8.68 43.59c6.2 14.94 20.78 24.69 36.96 24.69z" fill="#fff"/>
          </svg>
        `;
        break;
      case CONTENT_TYPES.PDF:
        // Reduced size
        iconSvg = `
          <svg class="pdf-icon w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"
              stroke="${pdfColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="${pdfColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 13H15" stroke="${pdfColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 17H12" stroke="${pdfColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        break;
      case CONTENT_TYPES.GENERAL:
      default:
        // Reduced size
        iconSvg = `
          <svg class="general-icon w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="20" height="20" rx="2" stroke="${generalColor}" stroke-width="1.5"/>
            <rect x="3" y="3" width="18" height="3" rx="1" stroke="${generalColor}" stroke-width="1.5"/>
            <circle cx="4.5" cy="4.5" r="0.75" fill="${generalColor}"/>
            <circle cx="7.5" cy="4.5" r="0.75" fill="${generalColor}"/>
            <circle cx="10.5" cy="4.5" r="0.75" fill="${generalColor}"/>
            <path d="M5 10H19" stroke="${generalColor}" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M5 14H15" stroke="${generalColor}" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M5 18H12" stroke="${generalColor}" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        `;
        break;
    }
    return iconSvg;
  };

  // Helper function to get content type display name
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
        return "Content"; // Fallback name
    }
  };

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
            {/* Platform Logo and Model */}
            {selectedPlatformId && selectedPlatform.iconUrl ? (
              <>
                <img
                  src={selectedPlatform.iconUrl}
                  alt={selectedPlatform.name}
                  className="w-12 h-12 mb-4"
                />
                {/* Display just the model name below the platform logo */}
                {selectedModel && (
                  <div className="text-sm text-theme-secondary mb-20">
                    {selectedModel}
                  </div>
                )}
              </>
            ) : (
              <div></div>
            )}
            <h3 className="text-base font-semibold mb-2">Start a conversation</h3>
            <p className="text-sm mb-10">
              {getWelcomeMessage(contentType)}
            </p>
            
            {/* Content Type Icon and Toggle (moved together) */}
            {getContentTypeIconSvg(contentType) && (
              <div className="flex flex-col items-center mt-4"> 
                {/* Content Type Display */}
                <div className="flex items-center justify-center">
                  <div
                    dangerouslySetInnerHTML={{ __html: getContentTypeIconSvg(contentType) }}
                  />
                  <div className="text-sm text-theme-secondary ml-3">
                    {getContentTypeName(contentType)}
                  </div>
                </div>
                
                {/* Content Extraction Toggle (now below content type) */}
                <div className="flex items-center justify-center gap-3 mt-4 px-4 text-sm text-theme-secondary">
                  <label htmlFor="content-extract-toggle" className="cursor-pointer">Include page content</label>
                  <Toggle
                    id="content-extract-toggle"
                    checked={isContentExtractionEnabled}
                    onChange={() => setIsContentExtractionEnabled(prev => !prev)}
                    disabled={!hasAnyPlatformCredentials}
                  />
                </div>
              </div>
            )}
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

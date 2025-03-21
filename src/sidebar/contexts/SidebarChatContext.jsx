// src/sidebar/contexts/SidebarChatContext.jsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSidebarPlatform } from './SidebarPlatformContext';
import { useSidebarContent } from './SidebarContentContext';
import ChatHistoryService from '../services/ChatHistoryService';
import { useContentProcessing } from '../../hooks/useContentProcessing';
import { MESSAGE_ROLES } from '../constants';
import { INTERFACE_SOURCES } from '../../shared/constants';

const SidebarChatContext = createContext(null);

export function SidebarChatProvider({ children }) {
  const { selectedPlatformId, selectedModel, hasCredentials } = useSidebarPlatform();
  const { currentTab, contentType } = useSidebarContent();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPageUrl, setCurrentPageUrl] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [streamingContent, setStreamingContent] = useState('');

  // Use the centralized content processing hook
  const {
    extractContent,
    processContentStreaming,
    extractionStatus,
    error: processingError,
    isExtracting,
    reset: resetContentProcessing
  } = useContentProcessing(INTERFACE_SOURCES.SIDEBAR);

  // Get current page URL and initialize chat history
  useEffect(() => {
    const initialize = async () => {
      try {
        if (currentTab && currentTab.url) {
          setCurrentPageUrl(currentTab.url);

          // Load chat history for this URL
          const history = await ChatHistoryService.getHistory(currentTab.url);
          setMessages(history);
        }
      } catch (error) {
        console.error('Error initializing chat context:', error);
      }
    };

    initialize();
  }, [currentTab]);

  // Reset extraction when the tab changes
  useEffect(() => {
    if (currentTab?.url) {
      resetContentProcessing();
    }
  }, [currentTab?.url, resetContentProcessing]);

  useEffect(() => {
    const handleStreamChunk = (message) => {
      if (message.action === 'streamChunk' && streamingMessageId) {
        const { streamId, chunkData } = message;

        // Ensure chunkData is properly formatted
        if (!chunkData) {
          console.error('Invalid chunk data received:', message);
          return;
        }

        // Process chunk content - ensure it's a string
        const chunkContent = typeof chunkData.chunk === 'string'
          ? chunkData.chunk
          : (chunkData.chunk ? JSON.stringify(chunkData.chunk) : '');

        if (chunkData.done) {
          // Streaming complete - CRITICAL: Update state to remove streaming indicator
          setStreamingMessageId(null);
          setIsProcessing(false);

          // Get final content - either from fullContent or accumulated content
          const finalContent = chunkData.fullContent || streamingContent;

          // Update final message content
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? {
                  ...msg,
                  content: finalContent,
                  isStreaming: false, // Explicitly mark as not streaming
                  model: chunkData.model || selectedModel
                }
              : msg
          ));

          // Save to history
          try {
            ChatHistoryService.saveHistory(currentPageUrl,
              messages.map(msg =>
                msg.id === streamingMessageId
                  ? { ...msg, content: finalContent, isStreaming: false }
                  : msg
              )
            );
          } catch (err) {
            console.error('Error saving chat history:', err);
          }
        } else if (chunkContent) {
          // Append chunk to streaming content
          setStreamingContent(prev => prev + chunkContent);

          // Update message with current accumulated content
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? { ...msg, content: streamingContent + chunkContent }
              : msg
          ));
        }
      }
    };

    // Add listener
    chrome.runtime.onMessage.addListener(handleStreamChunk);

    return () => {
      chrome.runtime.onMessage.removeListener(handleStreamChunk);
    };
  }, [streamingMessageId, streamingContent, messages, currentPageUrl, selectedModel]);

  // Send a message and get a response
  const sendMessage = async (text = inputValue) => {
    if (!text.trim() || isProcessing) return;

    if (!selectedPlatformId || !selectedModel) {
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        role: MESSAGE_ROLES.SYSTEM,
        content: 'Please select an AI platform and model first.',
        timestamp: new Date().toISOString()
      }]);
      return;
    }

    if (!hasCredentials) {
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        role: MESSAGE_ROLES.SYSTEM,
        content: `No API credentials found for ${selectedPlatformId}. Please add them in the settings.`,
        timestamp: new Date().toISOString()
      }]);
      return;
    }

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: MESSAGE_ROLES.USER,
      content: text.trim(),
      timestamp: new Date().toISOString()
    };

    // Create placeholder for assistant response with explicit streaming flag
    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage = {
      id: assistantMessageId,
      role: MESSAGE_ROLES.ASSISTANT,
      content: '', // Empty initially, will be streamed
      model: selectedModel,
      timestamp: new Date().toISOString(),
      isStreaming: true // Explicit boolean flag
    };

    // Update UI with user message and assistant placeholder
    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsProcessing(true);
    setStreamingMessageId(assistantMessageId);
    setStreamingContent('');

    try {
      // Extract content if not already done
      const content = await extractContent({
        hasSelection: false,
        forceReExtract: false
      });

      if (!content) {
        throw new Error('No content extracted to analyze');
      }

      // Create a stream handler function that will be called by the hook
      const handleStreamChunk = (chunkData) => {
        // The chunk handling is now done by the useEffect above
        // This function is just a pass-through for the hook
      };

      // Process with streaming API using the new hook
      const streamId = await processContentStreaming({
        platformId: selectedPlatformId,
        modelId: selectedModel,
        promptContent: text.trim(),
        onStreamChunk: handleStreamChunk
      });

      if (!streamId) {
        throw new Error('Failed to initialize streaming');
      }

      // The streaming process will update the message content via the effect handler

    } catch (error) {
      console.error('Error processing streaming message:', error);

      // Update streaming message to show error
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              role: MESSAGE_ROLES.SYSTEM,
              content: `Error: ${error.message || 'Failed to process request'}`,
              isStreaming: false // Turn off streaming state
            }
          : msg
      ));

      setStreamingMessageId(null);
      setIsProcessing(false);
    }
  };

  // Clear chat history
  const clearChat = async () => {
    setMessages([]);
    await ChatHistoryService.clearHistory(currentPageUrl);
  };

  return (
    <SidebarChatContext.Provider value={{
      messages,
      inputValue,
      setInputValue,
      sendMessage,
      clearChat,
      isProcessing,
      extractionStatus,
      apiError: processingError,
      contentType
    }}>
      {children}
    </SidebarChatContext.Provider>
  );
}

export const useSidebarChat = () => useContext(SidebarChatContext);
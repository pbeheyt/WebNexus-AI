import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSidebarPlatform } from './SidebarPlatformContext';
import { useSidebarContent } from './SidebarContentContext';
import ChatHistoryService from '../services/ChatHistoryService';
import { useApiProcess } from '../hooks/useApiProcess';
import { useExtraction } from '../hooks/useExtraction';
import { MESSAGE_ROLES } from '../constants';

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

  const { extractContent, extractionStatus, hasExtractedContent, resetExtraction } = useExtraction();
  const { processContent, processContentStreaming, error: apiError } = useApiProcess();

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
      resetExtraction();
    }
  }, [currentTab?.url, resetExtraction]);

  // Add listener for stream chunks
  useEffect(() => {
    const handleStreamChunk = (message, sender) => {
      if (message.action === 'streamChunk' && streamingMessageId) {
        const { streamId, chunkData } = message;

        // Process chunk
        if (chunkData.done) {
          // Streaming complete
          setStreamingMessageId(null);
          setIsProcessing(false);

          // Update final message content
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? { ...msg, content: chunkData.fullContent || streamingContent }
              : msg
          ));
        } else {
          // Append chunk to streaming content
          setStreamingContent(prev => prev + chunkData.chunk);

          // Update message with current accumulated content
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? { ...msg, content: prev + chunkData.chunk }
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
  }, [streamingMessageId, streamingContent]);

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

    // Create placeholder for assistant response
    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage = {
      id: assistantMessageId,
      role: MESSAGE_ROLES.ASSISTANT,
      content: '', // Empty initially, will be streamed
      model: selectedModel,
      timestamp: new Date().toISOString(),
      isStreaming: true
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
      const content = await extractContent();

      if (!content) {
        throw new Error('No content extracted to analyze');
      }

      // Process with streaming API
      const streamId = await processContentStreaming(text.trim(), content);

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
              content: `Error: ${error.message || 'Failed to process request'}`
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
      apiError,
      contentType
    }}>
      {children}
    </SidebarChatContext.Provider>
  );
}

export const useSidebarChat = () => useContext(SidebarChatContext);

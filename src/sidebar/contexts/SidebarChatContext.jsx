// src/sidebar/contexts/SidebarChatContext.jsx
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import { useContent } from '../../components';
import ChatHistoryService from '../services/ChatHistoryService';
import { useContentProcessing } from '../../hooks/useContentProcessing';
import { MESSAGE_ROLES } from '../constants';
import { INTERFACE_SOURCES } from '../../shared/constants';
import TokenCalculationService from '../../services/TokenCalculationService';

const SidebarChatContext = createContext(null);

export function SidebarChatProvider({ children }) {
  const { selectedPlatformId, selectedModel, hasCredentials, tabId, platforms } = useSidebarPlatform();
  const { contentType } = useContent();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [tokenStats, setTokenStats] = useState({
    inputTokens: 0,
    outputTokens: 0,
    totalCost: 0
  });

  // Use the updated content processing hook
  const {
    processContentViaApi,
    processingStatus,
    error: processingError,
    reset: resetContentProcessing
  } = useContentProcessing(INTERFACE_SOURCES.SIDEBAR);

  // Get platform info
  const selectedPlatform = platforms.find(p => p.id === selectedPlatformId) || {};

  // Get selected model config for pricing information
  const modelConfig = useMemo(() => {
    if (!selectedPlatformId || !selectedModel) return null;

    const platformConfig = platforms.find(p => p.id === selectedPlatformId);
    if (!platformConfig || !platformConfig.api || !platformConfig.api.models) return null;

    return platformConfig.api.models.find(m => m.id === selectedModel);
  }, [selectedPlatformId, selectedModel, platforms]);

  // Calculate token stats when messages or model config changes
  useEffect(() => {
    if (!modelConfig) return;

    const stats = TokenCalculationService.calculateConversationStats(messages, modelConfig);
    console.log('Token Stats Calculated:', stats); // Debug log for token stats
    setTokenStats(stats);
  }, [messages, modelConfig]);

  // Load chat history for current tab
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!tabId) return;

      try {
        // Load chat history for this tab
        const history = await ChatHistoryService.getHistory(tabId);
        console.log('Chat History Loaded:', history); // Debug log for chat history
        setMessages(history);
      } catch (error) {
        console.error('Error loading tab chat history:', error);
      }
    };

    loadChatHistory();
  }, [tabId]);

  // Reset processing when the tab changes
  useEffect(() => {
    if (tabId) {
      resetContentProcessing();
    }
  }, [tabId, resetContentProcessing]);

  useEffect(() => {
    const handleStreamChunk = (message) => {
      if (message.action === 'streamChunk' && streamingMessageId) {
        const { chunkData } = message;

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

          // Calculate tokens for the response
          const outputTokens = TokenCalculationService.estimateTokens(finalContent);
          console.log('Output Tokens Calculated:', outputTokens); // Debug log for output tokens

          // Update final message content
          const updatedMessages = messages.map(msg =>
            msg.id === streamingMessageId
              ? {
                  ...msg,
                  content: finalContent,
                  isStreaming: false, // Explicitly mark as not streaming
                  model: chunkData.model || selectedModel,
                  platformIconUrl: msg.platformIconUrl, // Preserve the platform icon
                  outputTokens // Add token count
                }
              : msg
          );

          setMessages(updatedMessages);

          // Save to history for current tab
          if (tabId) {
            try {
              ChatHistoryService.saveHistory(tabId, updatedMessages);
            } catch (err) {
              console.error('Error saving tab chat history:', err);
            }
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
  }, [streamingMessageId, streamingContent, messages, tabId, selectedModel]);

  // Send a message and get a response
  const sendMessage = async (text = inputValue) => {
    if (!text.trim() || isProcessing || !tabId) return;

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

    // Estimate tokens for the user message
    const inputTokens = TokenCalculationService.estimateTokens(text.trim());
    console.log('Input Tokens Estimated:', inputTokens); // Debug log for input tokens

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: MESSAGE_ROLES.USER,
      content: text.trim(),
      timestamp: new Date().toISOString(),
      inputTokens, // Add token count
      outputTokens: 0
    };

    // Create placeholder for assistant response with explicit streaming flag
    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage = {
      id: assistantMessageId,
      role: MESSAGE_ROLES.ASSISTANT,
      content: '', // Empty initially, will be streamed
      model: selectedModel,
      platformIconUrl: selectedPlatform.iconUrl, // Add platform icon URL
      timestamp: new Date().toISOString(),
      isStreaming: true, // Explicit boolean flag
      inputTokens: 0, // No input tokens for assistant messages
      outputTokens: 0 // Will be updated when streaming completes
    };

    // Update UI with user message and assistant placeholder
    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsProcessing(true);
    setStreamingMessageId(assistantMessageId);
    setStreamingContent('');

    // Save interim state to chat history
    if (tabId) {
      await ChatHistoryService.saveHistory(tabId, updatedMessages);
    }

    try {
      // Format conversation history for the API - only include user and assistant messages
      // Filter out system messages and streaming messages
      const conversationHistory = messages
        .filter(msg => (msg.role === MESSAGE_ROLES.USER || msg.role === MESSAGE_ROLES.ASSISTANT) && !msg.isStreaming)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }));

      // Process with API using the updated method - now with streaming flag
      const result = await processContentViaApi({
        platformId: selectedPlatformId,
        modelId: selectedModel,
        promptContent: text.trim(),
        conversationHistory,
        streaming: true, // Enable streaming mode
        onStreamChunk: () => {} // Stream handling is done via the effect
      });

      if (!result || !result.success) {
        throw new Error('Failed to initialize streaming');
      }

    } catch (error) {
      console.error('Error processing streaming message:', error);

      // Update streaming message to show error
      const errorMessages = messages.map(msg =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              role: MESSAGE_ROLES.SYSTEM,
              content: `Error: ${error.message || 'Failed to process request'}`,
              isStreaming: false // Turn off streaming state
            }
          : msg
      );

      setMessages(errorMessages);

      // Save error state to history
      if (tabId) {
        await ChatHistoryService.saveHistory(tabId, errorMessages);
      }

      setStreamingMessageId(null);
      setIsProcessing(false);
    }
  };

  // Clear chat history
  const clearChat = async () => {
    if (!tabId) return;

    setMessages([]);
    await ChatHistoryService.clearHistory(tabId);
  };

  return (
    <SidebarChatContext.Provider value={{
      messages,
      inputValue,
      setInputValue,
      sendMessage,
      clearChat,
      isProcessing,
      processingStatus,
      apiError: processingError,
      contentType,
      tokenStats // Expose token stats to components
    }}>
      {children}
    </SidebarChatContext.Provider>
  );
}

export const useSidebarChat = () => useContext(SidebarChatContext);

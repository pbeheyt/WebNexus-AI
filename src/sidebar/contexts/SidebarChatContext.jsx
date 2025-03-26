// src/sidebar/contexts/SidebarChatContext.jsx
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import { useContent } from '../../components';
import { useTokenTracking } from '../hooks/useTokenTracking';
import ChatHistoryService from '../services/ChatHistoryService';
import TokenManagementService from '../services/TokenManagementService';
import { useContentProcessing } from '../../hooks/useContentProcessing';
import { MESSAGE_ROLES } from '../constants';
import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants';

const SidebarChatContext = createContext(null);

export function SidebarChatProvider({ children }) {
  const { 
    selectedPlatformId, 
    selectedModel, 
    hasCredentials, 
    tabId, 
    platforms, 
    getPlatformConfig 
  } = useSidebarPlatform();
  
  const { contentType } = useContent();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [contextStatus, setContextStatus] = useState({ warningLevel: 'none' });
  const [isContextStatusLoading, setIsContextStatusLoading] = useState(false);
  const [extractedContentAdded, setExtractedContentAdded] = useState(false);
  
  // Add these state variables for proper platform configuration handling
  const [fullPlatformConfig, setFullPlatformConfig] = useState(null);
  const [modelConfigData, setModelConfigData] = useState(null);

  // Use the token tracking hook
  const {
    tokenStats,
    calculateContextStatus,
    trackTokens,
    clearTokenData,
    estimateTokens
  } = useTokenTracking(tabId);

  // Use the content processing hook
  const {
    processContentViaApi,
    processingStatus,
    error: processingError,
    reset: resetContentProcessing
  } = useContentProcessing(INTERFACE_SOURCES.SIDEBAR);

  // Get platform info
  const selectedPlatform = platforms.find(p => p.id === selectedPlatformId) || {};

  // Replace the modelConfig useMemo with this effect for fetching complete platform configuration
  useEffect(() => {
    const loadFullConfig = async () => {
      if (!selectedPlatformId || !selectedModel || !tabId) return;
      
      try {
        // Get full configuration either from context or directly
        const config = await getPlatformConfig(selectedPlatformId);
        setFullPlatformConfig(config);
        
        if (!config || !config.api || !config.api.models) {
          console.warn('Platform configuration missing required structure:', {
            platformId: selectedPlatformId,
            hasApi: !!config?.api,
            hasModels: !!config?.api?.models
          });
          return;
        }
        
        const modelData = config.api.models.find(m => m.id === selectedModel);
        console.log('Model configuration found:', {
          modelFound: !!modelData,
          selectedModel,
          availableModels: config.api.models.map(m => m.id)
        });
        
        setModelConfigData(modelData);
      } catch (error) {
        console.error('Failed to load full platform configuration:', error);
      }
    };
    
    loadFullConfig();
  }, [selectedPlatformId, selectedModel, tabId, getPlatformConfig]);

  // Update context status when model config or token stats change
  useEffect(() => {
    const updateContextStatus = async () => {
      if (!tabId || !modelConfigData) {
        setContextStatus({ warningLevel: 'none' });
        return;
      }

      setIsContextStatusLoading(true);
      try {
        const status = await calculateContextStatus(modelConfigData);
        setContextStatus(status);
      } catch (error) {
        console.error('Error calculating context status:', error);
        setContextStatus({ warningLevel: 'none' });
      } finally {
        setIsContextStatusLoading(false);
      }
    };

    updateContextStatus();
  }, [tabId, modelConfigData, tokenStats, calculateContextStatus]);

  // Load chat history for current tab
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!tabId) return;

      try {
        // Load chat history for this tab
        const history = await ChatHistoryService.getHistory(tabId);
        setMessages(history);

        // Reset extracted content flag when tab changes
        setExtractedContentAdded(history.length > 0);
      } catch (error) {
        console.error('Error loading tab chat history:', error);
      }
    };

    loadChatHistory();
  }, [tabId]);

  // Get visible messages (filtering out extracted content)
  const visibleMessages = useMemo(() => {
    return messages.filter(msg => !msg.isExtractedContent);
  }, [messages]);

  // Reset processing when the tab changes
  useEffect(() => {
    if (tabId) {
      resetContentProcessing();
    }
  }, [tabId, resetContentProcessing]);

  // Handle streaming response chunks
  useEffect(() => {
    // Utility function to handle all post-streaming operations in one place
    const handleStreamComplete = async (messageId, finalContent, model) => {
      try {
        // Calculate output tokens
        const outputTokens = TokenManagementService.estimateTokens(finalContent);

        // Update message with final content
        let updatedMessages = messages.map(msg =>
          msg.id === messageId
            ? {
                ...msg,
                content: finalContent,
                isStreaming: false, // Explicitly mark as not streaming
                model: model || selectedModel,
                platformIconUrl: msg.platformIconUrl,
                outputTokens
              }
            : msg
        );

        // Check if this is the first assistant message
        const visibleAssistantMessages = visibleMessages.filter(
          msg => msg.role === MESSAGE_ROLES.ASSISTANT
        );
        const isFirstMessage = visibleAssistantMessages.length === 1;

        // If first message and content not added, add extracted content
        if (isFirstMessage && !extractedContentAdded) {
          try {
            // Get formatted content from storage
            const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_FORMATTED_CONTENT]);
            const allTabContents = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT];

            if (allTabContents) {
              const tabIdKey = tabId.toString();
              const extractedContent = allTabContents[tabIdKey];

              if (extractedContent && typeof extractedContent === 'string' && extractedContent.trim()) {
                const contentMessage = {
                  id: `extracted_${Date.now()}`,
                  role: MESSAGE_ROLES.USER,
                  content: `Content extract:\n${extractedContent}`,
                  timestamp: new Date().toISOString(),
                  inputTokens: TokenManagementService.estimateTokens(extractedContent),
                  outputTokens: 0,
                  isExtractedContent: true
                };

                // Add extracted content at beginning
                updatedMessages = [contentMessage, ...updatedMessages];

                // Mark as added to prevent duplicate additions
                setExtractedContentAdded(true);

                // Track tokens for extracted content
                await trackTokens({
                  messageId: contentMessage.id,
                  input: contentMessage.inputTokens,
                  output: 0,
                  platformId: selectedPlatformId,
                  modelId: selectedModel
                }, modelConfigData);  // Use modelConfigData instead of modelConfig
              }
            }
          } catch (extractError) {
            console.error('Error adding extracted content:', extractError);
          }
        }

        // Set messages with all updates at once
        setMessages(updatedMessages);
        setStreamingContent(''); // Reset streaming content

        // Track tokens for assistant message
        await trackTokens({
          messageId: messageId,
          input: 0,
          output: outputTokens,
          platformId: selectedPlatformId,
          modelId: selectedModel
        }, modelConfigData);  // Use modelConfigData instead of modelConfig

        // Save history in one operation
        if (tabId) {
          await ChatHistoryService.saveHistory(tabId, updatedMessages);

          // Force a fresh token statistics calculation that includes current system prompts
          // This ensures system prompts are counted after every API response
          await ChatHistoryService.updateTokenStatistics(tabId, updatedMessages);
        }
      } catch (error) {
        console.error('Error handling stream completion:', error);
      }
    };

    const handleStreamChunk = async (message) => {
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
          // Streaming complete
          setStreamingMessageId(null);
          setIsProcessing(false);

          // Get final content
          const finalContent = chunkData.fullContent || streamingContent;

          // Handle all post-streaming operations in one function
          await handleStreamComplete(streamingMessageId, finalContent, chunkData.model);
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
  }, [streamingMessageId, streamingContent, messages, visibleMessages, tabId, selectedModel,
      selectedPlatformId, modelConfigData, trackTokens, extractedContentAdded]);

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
    const inputTokens = TokenManagementService.estimateTokens(text.trim());
    const userMessageId = `msg_${Date.now()}`;

    const userMessage = {
      id: userMessageId,
      role: MESSAGE_ROLES.USER,
      content: text.trim(),
      timestamp: new Date().toISOString(),
      inputTokens,
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
      // Format conversation history for the API - Include extracted content for API but not UI
      const conversationHistory = messages
        .filter(msg => (msg.role === MESSAGE_ROLES.USER || msg.role === MESSAGE_ROLES.ASSISTANT) && !msg.isStreaming)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }));

      // Process with API in streaming mode
      const result = await processContentViaApi({
        platformId: selectedPlatformId,
        modelId: selectedModel,
        promptContent: text.trim(),
        conversationHistory,
        streaming: true
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

  // Clear chat history and token metadata
  const clearChat = async () => {
    if (!tabId) return;

    setMessages([]);
    setExtractedContentAdded(false); // Reset the flag so content can be added again
    await ChatHistoryService.clearHistory(tabId);

    // Clear token metadata
    await clearTokenData();
  };

  return (
    <SidebarChatContext.Provider value={{
      messages: visibleMessages, // Only expose visible messages (without extracted content)
      allMessages: messages, // Provide access to all messages including extracted content
      inputValue,
      setInputValue,
      sendMessage,
      clearChat,
      isProcessing,
      processingStatus,
      apiError: processingError,
      contentType,
      tokenStats,
      contextStatus
    }}>
      {children}
    </SidebarChatContext.Provider>
  );
}

export const useSidebarChat = () => useContext(SidebarChatContext);
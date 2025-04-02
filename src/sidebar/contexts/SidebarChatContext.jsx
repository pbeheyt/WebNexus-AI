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
    hasCredentials, // Assuming this might still be used elsewhere
    hasAnyPlatformCredentials, // Add this one
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
  const [isCanceling, setIsCanceling] = useState(false);
  
  // Platform and model configuration
  const [fullPlatformConfig, setFullPlatformConfig] = useState(null);
  const [modelConfigData, setModelConfigData] = useState(null);

  // Use the token tracking hook
  const {
    tokenStats,
    calculateContextStatus,
    trackTokens,
    clearTokenData,
    calculateStats
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

  // Load full platform configuration when platform or model changes
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

        // Calculate token statistics based on the history
        if (history.length > 0 && modelConfigData) {
          await calculateStats(history, modelConfigData);
        }

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
    const handleStreamComplete = async (messageId, finalContent, model, isError = false) => {
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
                outputTokens,
                // If this is an error, change the role to system
                role: isError ? MESSAGE_ROLES.SYSTEM : msg.role
              }
            : msg
        );
    
        // Check if this is the first assistant message
        const visibleAssistantMessages = visibleMessages.filter(
          msg => msg.role === MESSAGE_ROLES.ASSISTANT
        );
        const isFirstMessage = visibleAssistantMessages.length === 1;
    
        // If first message and content not added, add extracted content
        if (isFirstMessage && !extractedContentAdded && !isError) {
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
    
                // Track tokens for extracted content using the service
                await trackTokens({
                  messageId: contentMessage.id,
                  role: contentMessage.role,
                  content: contentMessage.content,
                  input: contentMessage.inputTokens,
                  output: 0
                }, modelConfigData);
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
          role: isError ? MESSAGE_ROLES.SYSTEM : MESSAGE_ROLES.ASSISTANT,
          content: finalContent,
          input: 0,
          output: outputTokens
        }, modelConfigData);
    
        // Save history and update accumulated cost
        if (tabId) {
          await ChatHistoryService.saveHistory(tabId, updatedMessages, modelConfigData);
          await TokenManagementService.updateAccumulatedCost(tabId);
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

        // Handle stream error
        if (chunkData.error) {
          console.error('Stream error:', chunkData.error);
          setStreamingMessageId(null);
          setIsProcessing(false);
          setIsCanceling(false);
          
          // Format the error message
          const errorMessage = typeof chunkData.error === 'string' 
            ? chunkData.error 
            : (chunkData.error.message || 'An error occurred during streaming');
          
          // Complete the stream with the error message
          await handleStreamComplete(streamingMessageId, errorMessage, null, true);
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
          setIsCanceling(false);

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

    if (!hasAnyPlatformCredentials) { // Change this condition
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        role: MESSAGE_ROLES.SYSTEM,
            content: `API credentials are needed to enable the chat feature. Please configure them in the settings.`,
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

    // Track tokens for user message
    await trackTokens({
      messageId: userMessageId,
      role: MESSAGE_ROLES.USER,
      content: userMessage.content,
      input: inputTokens,
      output: 0
    }, modelConfigData);

    // Save interim state to chat history
    if (tabId) {
      await ChatHistoryService.saveHistory(tabId, updatedMessages, modelConfigData);
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
        await ChatHistoryService.saveHistory(tabId, errorMessages, modelConfigData);
      }

      setStreamingMessageId(null);
      setIsProcessing(false);
    }
  };

  // Cancel the current stream
  const cancelStream = async () => {
    if (!streamingMessageId || !isProcessing || isCanceling) return;
    
    setIsCanceling(true);
    
    try {
      // Send cancellation message to background script
      const result = await chrome.runtime.sendMessage({
        action: 'cancelStream',
        platformId: selectedPlatformId,
        tabId
      });
      
      // Update the streaming message to indicate cancellation
      const cancelledContent = streamingContent + '\n\n_Stream cancelled by user._';
      
      // Update message in UI immediately
      setMessages(prev => prev.map(msg =>
        msg.id === streamingMessageId
          ? { 
              ...msg, 
              content: cancelledContent,
              isStreaming: false
            }
          : msg
      ));
      
      // Save the cancelled state
      if (tabId) {
        const updatedMessages = messages.map(msg =>
          msg.id === streamingMessageId
            ? { 
                ...msg, 
                content: cancelledContent,
                isStreaming: false
              }
            : msg
        );
        
        // Save to history
        await ChatHistoryService.saveHistory(tabId, updatedMessages, modelConfigData);
      }
      
      // Reset streaming state
      setStreamingMessageId(null);
      setStreamingContent('');
      setIsProcessing(false);
      
      console.log('Stream cancelled successfully:', result);
    } catch (error) {
      console.error('Error cancelling stream:', error);
      
      // Still reset the streaming state on error
      setStreamingMessageId(null);
      setIsProcessing(false);
    } finally {
      setIsCanceling(false);
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

  // Reset current tab data (chat history, tokens, etc.)
  const resetCurrentTabData = useCallback(async () => {
    if (tabId === null || tabId === undefined) {
      console.warn('resetCurrentTabData called without a valid tabId.');
      return;
    }

    if (window.confirm("Are you sure you want to clear all chat history and data for this tab? This action cannot be undone.")) {
      console.log(`Attempting to clear data for tab: ${tabId}`);
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'clearTabData',
          tabId: tabId
        });

        console.log('Response from background script:', response);

        if (response && response.success) {
          // Reset local state immediately
          setMessages([]);
          setInputValue('');
          setIsProcessing(false);
          setStreamingMessageId(null);
          setStreamingContent('');
          setExtractedContentAdded(false); // Allow extracted content to be added again
          setIsCanceling(false); // Ensure canceling state is reset

          // Clear token data (which also recalculates stats)
          await clearTokenData();

          console.log("Tab data cleared and context reset successfully.");
          // Optionally: Show a success notification to the user
          // e.g., using a toast notification system if available
        } else {
          throw new Error(response?.error || 'Background script failed to clear data.');
        }
      } catch (error) {
        console.error('Failed to reset tab data:', error);
        // Optionally: Show an error notification to the user
        // e.g., alert(`Error: ${error.message}`);
      }
    }
  }, [
    tabId,
    clearTokenData,
    setMessages,
    setInputValue,
    setIsProcessing,
    setStreamingMessageId,
    setStreamingContent,
    setExtractedContentAdded,
    setIsCanceling // Added setIsCanceling as per requirement
  ]);


  return (
    <SidebarChatContext.Provider value={{
      messages: visibleMessages, // Only expose visible messages (without extracted content)
      allMessages: messages, // Provide access to all messages including extracted content
      inputValue,
      setInputValue,
      sendMessage,
      cancelStream,
      isProcessing,
      isCanceling,
      clearChat,
      processingStatus,
      apiError: processingError,
      contentType,
      tokenStats,
      contextStatus,
      resetCurrentTabData // Add the new function here
    }}>
      {children}
    </SidebarChatContext.Provider>
  );
}

export const useSidebarChat = () => useContext(SidebarChatContext);

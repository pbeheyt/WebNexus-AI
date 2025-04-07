// src/sidebar/contexts/SidebarChatContext.jsx

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import { useContent } from '../../contexts/ContentContext';
import { useTokenTracking } from '../hooks/useTokenTracking';
import ChatHistoryService from '../services/ChatHistoryService';
import TokenManagementService from '../services/TokenManagementService';
import { useContentProcessing } from '../../hooks/useContentProcessing';
import { MESSAGE_ROLES } from '../constants';
import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants';
import logger from '../../shared/logger.js'; // Added logger import

const SidebarChatContext = createContext(null);

export function SidebarChatProvider({ children }) {
  const {
    selectedPlatformId,
    selectedModel,
    hasAnyPlatformCredentials,
    tabId,
    platforms,
    getPlatformConfig
  } = useSidebarPlatform();

  const { contentType } = useContent();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [contextStatus, setContextStatus] = useState({ warningLevel: 'none' });
  const [isContextStatusLoading, setIsContextStatusLoading] = useState(false);
  const [extractedContentAdded, setExtractedContentAdded] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isContentExtractionEnabled, setIsContentExtractionEnabled] = useState(true);

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
    isProcessing, // Use isProcessing from the hook
    processingStatus, // Keep original if needed elsewhere, or remove if redundant
    error: processingError,
    reset: resetContentProcessing,
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
        setModelConfigData(modelData);
      } catch (error) {
        console.error('Failed to load full platform configuration:', error);
        setFullPlatformConfig(null);
        setModelConfigData(null);
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
    const handleStreamComplete = async (messageId, finalContentInput, model, isError = false, isCancelled = false) => {
      try {
        let finalContent = finalContentInput; // Use a mutable variable
        if (isCancelled) {
          // Append cancellation notice if the stream was cancelled
          finalContent += '\n\n_Stream cancelled by user._';
        }

        // Calculate output tokens using the potentially modified finalContent
        const outputTokens = TokenManagementService.estimateTokens(finalContent);

        // Update message with final content (using the potentially modified finalContent)
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

        // If content not added yet, add extracted content message
        if (!extractedContentAdded && !isError) {
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
        setStreamingContent('');

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
          // chunkData.error should now be the pre-formatted string
          const errorMessage = chunkData.error;
          console.error('Stream error:', errorMessage);

          // Complete the stream with the error message
          await handleStreamComplete(streamingMessageId, errorMessage, chunkData.model || null, true); // Pass model if available

          setStreamingMessageId(null);
          setIsCanceling(false);

          return;
        }

        // Process chunk content - ensure it's a string
        const chunkContent = typeof chunkData.chunk === 'string'
          ? chunkData.chunk
          : (chunkData.chunk ? JSON.stringify(chunkData.chunk) : '');

        // Handle stream completion, cancellation, or error
        if (chunkData.done) {
          if (chunkData.cancelled === true) {
            // Handle Cancellation: Stream was cancelled by the user (via background script signal)
            console.info(`Stream ${message.streamId} received cancellation signal.`);
            // Use partial content received so far, mark as cancelled but not an error
            await handleStreamComplete(streamingMessageId, chunkData.fullContent || streamingContent, chunkData.model, false, true); // isError=false, isCancelled=true
          } else if (chunkData.error) {
            // Handle Error: Stream ended with an error (other than user cancellation)
            // chunkData.error should now be the pre-formatted string
            const errorMessage = chunkData.error;
            console.error(`Stream ${message.streamId} error:`, errorMessage);
            // Update the message with the error, mark as error, not cancelled
            await handleStreamComplete(streamingMessageId, errorMessage, chunkData.model || null, true, false); // isError=true, isCancelled=false
          } else {
            // Handle Success: Stream completed normally
            const finalContent = chunkData.fullContent || streamingContent; // Use fullContent if available
            console.info(`Stream ${message.streamId} completed successfully. Final length: ${finalContent.length}`);
            // Update message with final content, mark as success (not error, not cancelled)
            await handleStreamComplete(streamingMessageId, finalContent, chunkData.model, false, false); // isError=false, isCancelled=false
          }
          // Reset state regardless of outcome (completion, cancellation, error)
          setStreamingMessageId(null);
          setStreamingContent('');
          setIsCanceling(false); // Reset canceling state
        } else if (chunkContent) {
          // Process Intermediate Chunk: Append chunk to streaming content
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

    if (!hasAnyPlatformCredentials) {
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
      isStreaming: true,
      inputTokens: 0, // No input tokens for assistant messages
      outputTokens: 0 // Will be updated when streaming completes
    };

    // Update UI with user message and assistant placeholder
    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setStreamingMessageId(assistantMessageId);
    setStreamingContent('');

    // Determine if this is the first message (before adding the current user message)
    const isFirstMessage = messages.length === 0;

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
      // Format conversation history for the API - Filter out streaming messages and extracted content messages
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
        streaming: true,
        skipInitialExtraction: isFirstMessage ? !isContentExtractionEnabled : false
      });

      // Handle case where context extraction was skipped (e.g., non-injectable page)
      if (result && result.skippedContext === true) {
        logger.sidebar.info('Context extraction skipped by background:', result.reason);

        // Create the system message explaining why
        const systemMessage = {
          id: `sys_${Date.now()}`,
          role: MESSAGE_ROLES.SYSTEM,
          content: `Note: ${result.reason || 'Page content could not be included.'}`,
          timestamp: new Date().toISOString(),
        };

        // Remove the temporary assistant placeholder and add the system message
        // We already added the user message before the call
        const finalMessages = messages // Use 'messages' which doesn't include the placeholder yet
            .concat(userMessage, systemMessage); // Add user msg + system msg

        setMessages(finalMessages); // Update UI immediately

        // Save this state (user message + system message) to history
        if (tabId) {
          await ChatHistoryService.saveHistory(tabId, finalMessages, modelConfigData);
          // No API call made, so no cost to update here, user msg tokens already tracked
        }

        // Reset streaming state as no stream was initiated
        setStreamingMessageId(null);
        setStreamingContent('');
        resetContentProcessing(); // Reset the hook's processing state

        return; // Stop further processing for this message send
      }

      if (!result || !result.success) {
        // Use the error from the result if available, otherwise use a default
        const errorMsg = result?.error || 'Failed to initialize streaming';
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error('Error processing streaming message:', error);

      // Update streaming message to show error
      const errorMessages = messages.map(msg => // Use 'messages' which doesn't include the placeholder yet
        msg.id === userMessageId // Find the user message we just added
          ? msg // Keep user message as is
          : null // Placeholder for where the assistant message would have been
      ).filter(Boolean); // Remove the null placeholder

      // Add the system error message
      const systemErrorMessage = {
        id: assistantMessageId, // Reuse the ID intended for the assistant
        role: MESSAGE_ROLES.SYSTEM,
        content: `Error: ${error.message || 'Failed to process request'}`,
        timestamp: new Date().toISOString(),
        isStreaming: false // Turn off streaming state
      };

      const finalErrorMessages = [...errorMessages, systemErrorMessage];

      setMessages(finalErrorMessages);

      // Save error state to history
      if (tabId) {
        await ChatHistoryService.saveHistory(tabId, finalErrorMessages, modelConfigData);
      }

      setStreamingMessageId(null);
      setStreamingContent(''); // Also clear any potentially leftover streaming content
      resetContentProcessing(); // Ensure hook state is reset on error too
    }
  };

  // Cancel the current stream
  const cancelStream = async () => {
    if (!streamingMessageId || !isProcessing || isCanceling) return;

    const result = await chrome.storage.local.get(STORAGE_KEYS.STREAM_ID);
    // Extract the actual string ID from the object
    const streamId = result[STORAGE_KEYS.STREAM_ID];
    setIsCanceling(true);

    try {
      // Send cancellation message to background script
      const result = await chrome.runtime.sendMessage({
        action: 'cancelStream',
        streamId: streamId,
      });

      // Update the streaming message content to indicate cancellation
      const cancelledContent = streamingContent + '\n\n_Stream cancelled by user._';

      // Calculate output tokens for the cancelled content
      const outputTokens = TokenManagementService.estimateTokens(cancelledContent);

      let messagesAfterCancel = messages; // Start with current messages

      if (!extractedContentAdded) {
        try {
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

              // Find index of the message being cancelled
              const cancelledMsgIndex = messages.findIndex(msg => msg.id === streamingMessageId);

              if (cancelledMsgIndex !== -1) {
                // Insert content message before the cancelled message
                const messagesWithContent = [
                  ...messages.slice(0, cancelledMsgIndex),
                  contentMessage,
                  ...messages.slice(cancelledMsgIndex)
                ];

                // Update the local variable holding the messages
                messagesAfterCancel = messagesWithContent;

                // Update state immediately to reflect added content
                setMessages(messagesAfterCancel);
                setExtractedContentAdded(true);

                // Track tokens for the added content
                await trackTokens({
                  messageId: contentMessage.id,
                  role: contentMessage.role,
                  content: contentMessage.content,
                  input: contentMessage.inputTokens,
                  output: 0
                }, modelConfigData);
              } else {
                 console.warn('Cancelled message not found, cannot insert extracted content correctly.');
              }
            }
          }
        } catch (extractError) {
          console.error('Error adding extracted content during cancellation:', extractError);
        }
      }

      // Update the cancelled message content within the potentially updated array
      const finalMessages = messagesAfterCancel.map(msg =>
        msg.id === streamingMessageId
          ? {
              ...msg,
              content: cancelledContent,
              isStreaming: false,
              outputTokens
            }
          : msg
      );

      // Update state with the final message list
      setMessages(finalMessages);

      // Track tokens for the cancelled message
      await trackTokens({
        messageId: streamingMessageId,
        role: MESSAGE_ROLES.ASSISTANT,
        content: cancelledContent,
        input: 0,
        output: outputTokens
      }, modelConfigData);

      // Save the final state to history
      if (tabId) {
        await ChatHistoryService.saveHistory(tabId, finalMessages, modelConfigData);
        // Update accumulated cost with the new token count
        await TokenManagementService.updateAccumulatedCost(tabId);
      }

      // Reset streaming state (after all updates and saves) (setIsProcessing removed)
      setStreamingMessageId(null);
      setStreamingContent('');

    } catch (error) {
      console.error('Error cancelling stream:', error);

      // Still reset the streaming state on error (setIsProcessing removed)
      setStreamingMessageId(null);
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
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'clearTabData',
          tabId: tabId
        });

        if (response && response.success) {
          setMessages([]);
          setInputValue('');
          setStreamingMessageId(null);
          setStreamingContent('');
          setExtractedContentAdded(false); // Allow extracted content to be added again
          setIsCanceling(false);

          // Clear token data (which also recalculates stats)
          await clearTokenData();

        } else {
          throw new Error(response?.error || 'Background script failed to clear data.');
        }
      } catch (error) {
        console.error('Failed to reset tab data:', error);
      }
    }
  }, [
    tabId,
    clearTokenData,
    setMessages,
    setInputValue,
    setStreamingMessageId,
    setStreamingContent,
    setExtractedContentAdded,
    setIsCanceling
  ]);

  // Function to clear the stored formatted content for the current tab
  const clearFormattedContentForTab = useCallback(async () => {
    if (tabId === null || tabId === undefined) {
      console.warn('clearFormattedContentForTab called without a valid tabId.');
      return;
    }

    const tabIdKey = tabId.toString();
    console.info(`Attempting to clear formatted content for tab: ${tabIdKey}`);

    try {
      // Retrieve the entire formatted content object
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_FORMATTED_CONTENT);
      const allFormattedContent = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT] || {};

      // Check if the key exists before deleting
      if (allFormattedContent.hasOwnProperty(tabIdKey)) {
        // Create a mutable copy to avoid modifying the original object directly from storage result
        const updatedFormattedContent = { ...allFormattedContent };

        // Delete the entry for the current tab
        delete updatedFormattedContent[tabIdKey];

        // Save the modified object back to storage
        await chrome.storage.local.set({ [STORAGE_KEYS.TAB_FORMATTED_CONTENT]: updatedFormattedContent });
        console.info(`Successfully cleared formatted content for tab: ${tabIdKey}`);
      } else {
        console.info(`No formatted content found in storage for tab: ${tabIdKey}. No action needed.`);
      }

      // Also reset the local flag indicating if extracted content was added to the current chat view
      setExtractedContentAdded(false);
      console.info(`Reset extractedContentAdded flag for tab: ${tabIdKey}`);

    } catch (error) {
      console.error(`Error clearing formatted content for tab ${tabIdKey}:`, error);
    }
  }, [tabId, setExtractedContentAdded]);

  return (
    <SidebarChatContext.Provider value={{
      messages: visibleMessages,
      allMessages: messages,
      inputValue,
      setInputValue,
      sendMessage,
      cancelStream,
      isCanceling,
      clearChat,
      isProcessing,
      processingStatus,
      apiError: processingError,
      contentType,
      tokenStats,
      contextStatus,
      resetCurrentTabData,
      clearFormattedContentForTab,
      isContentExtractionEnabled,
      setIsContentExtractionEnabled
    }}>
      {children}
    </SidebarChatContext.Provider>
  );
}

export const useSidebarChat = () => useContext(SidebarChatContext);

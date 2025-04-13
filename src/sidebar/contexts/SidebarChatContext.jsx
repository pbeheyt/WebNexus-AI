// src/sidebar/contexts/SidebarChatContext.jsx

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import { useContent } from '../../contexts/ContentContext';
import { useTokenTracking } from '../hooks/useTokenTracking';
import ChatHistoryService from '../services/ChatHistoryService';
import TokenManagementService from '../services/TokenManagementService';
import { useContentProcessing } from '../../hooks/useContentProcessing';
import { MESSAGE_ROLES } from '../../shared/constants';
import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants';
import { isInjectablePage } from '../../shared/utils/content-utils';

const SidebarChatContext = createContext(null);

export function SidebarChatProvider({ children }) {
  const {
    selectedPlatformId,
    selectedModel,
    hasAnyPlatformCredentials,
    tabId,
    platforms,
    getPlatformApiConfig
  } = useSidebarPlatform();

  const { contentType, currentTab } = useContent(); // Added currentTab
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [contextStatus, setContextStatus] = useState({ warningLevel: 'none' });
  const [extractedContentAdded, setExtractedContentAdded] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isContentExtractionEnabled, setIsContentExtractionEnabled] = useState(true);
  const [modelConfigData, setModelConfigData] = useState(null);
  const batchedStreamingContentRef = useRef(''); // Added Ref for buffering
  const rafIdRef = useRef(null); // Added Ref for requestAnimationFrame ID

  // Use the token tracking hook
  const {
    tokenStats,
    calculateContextStatus,
    clearTokenData,
    calculateStats
  } = useTokenTracking(tabId);

  // Use the content processing hook
  const {
    processContentViaApi,
    isProcessing,
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
        // Get API configuration using the new function (synchronous)
        const config = await getPlatformApiConfig(selectedPlatformId);
        if (!config || !config.models) {
          console.warn('Platform API configuration missing required structure:', {
            platformId: selectedPlatformId,
            hasModels: !!config?.models
          });
          setModelConfigData(null); // Clear model data if config is invalid
          return;
        }

        // Find model data directly in config.models
        const modelData = config.models.find(m => m.id === selectedModel);
        setModelConfigData(modelData);
      } catch (error) {
        console.error('Failed to load or process platform API configuration:', error);
        setModelConfigData(null);
      }
    };

    loadFullConfig();
  }, [selectedPlatformId, selectedModel, tabId, getPlatformApiConfig]);

  // Update context status when model config or token stats change
  useEffect(() => {
    const updateContextStatus = async () => {
      if (!tabId || !modelConfigData) {
        setContextStatus({ warningLevel: 'none' });
        return;
      }

      try {
        const status = await calculateContextStatus(modelConfigData);
        setContextStatus(status);
      } catch (error) {
        console.error('Error calculating context status:', error);
        setContextStatus({ warningLevel: 'none' });
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

  // --- State Update Logic (using requestAnimationFrame) ---
  const performStreamingStateUpdate = useCallback(() => {
    rafIdRef.current = null; // Reset the ref after the frame executes
    const messageId = streamingMessageId; // Read current streaming ID from state
    const accumulatedContent = batchedStreamingContentRef.current; // Read buffered content

    if (!messageId) return; // Safety check

    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              content: accumulatedContent, // Update with the full batched content
              isStreaming: true, // Keep streaming flag true during debounced updates
            }
          : msg
      )
    );
  }, [streamingMessageId]); // Dependency: streamingMessageId state

  // Handle streaming response chunks
  useEffect(() => {
    /**
     * Finalizes the state of a message after its stream completes, errors out, or is cancelled.
     * Calculates output tokens for the final content, updates the message in the state array,
     * potentially prepends extracted content, saves history, and triggers token recalculation.
     *
     * @param {string} messageId - ID of the message being finalized.
     * @param {string} finalContentInput - The complete content string received.
     * @param {string|null} model - The model used for the response.
     * @param {boolean} [isError=false] - Flag indicating if the stream ended due to an error.
     * @param {boolean} [isCancelled=false] - Flag indicating if the stream was cancelled by the user.
     */
    const handleStreamComplete = async (messageId, finalContentInput, model, isError = false, isCancelled = false) => {
      try {
        // Calculate output tokens using the potentially modified finalContent - Removed await
        const outputTokens = TokenManagementService.estimateTokens(finalContentInput);
        let finalContent = finalContentInput; // Use a mutable variable
        if (isCancelled) {
          // Append cancellation notice if the stream was cancelled
          finalContent += '\n\n_Stream cancelled by user._';
        }

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
                  content: extractedContent,
                  timestamp: new Date().toISOString(),
                  inputTokens: TokenManagementService.estimateTokens(extractedContent), // Removed await
                  outputTokens: 0,
                  isExtractedContent: true
                };

                // Add extracted content at beginning
                updatedMessages = [contentMessage, ...updatedMessages];

                // Mark as added to prevent duplicate additions
                setExtractedContentAdded(true);
              }
            }
          } catch (extractError) {
            console.error('Error adding extracted content:', extractError);
          }
        }

        // Set messages with all updates at once
        setMessages(updatedMessages);
        batchedStreamingContentRef.current = ''; // Clear buffer on completion

        // Save history
        if (tabId) {
          await ChatHistoryService.saveHistory(tabId, updatedMessages, modelConfigData);
        }
      } catch (error) {
        console.error('Error handling stream completion:', error);
      }
    };

    /**
     * Processes incoming message chunks from the background script during an active stream.
     * Handles error chunks, completion chunks (including cancellation), and intermediate content chunks.
     * Updates the UI live and calls `handleStreamComplete` to finalize the message state.
     * Resets streaming-related state variables upon stream completion, error, or cancellation.
     *
     * @param {object} message - The message object received from `chrome.runtime.onMessage`.
     *                           Expected structure: `{ action: 'streamChunk', chunkData: {...}, streamId: '...' }`
     *                           `chunkData` contains `chunk`, `done`, `error`, `cancelled`, `fullContent`, `model`.
     */
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
          const errorMessage = chunkData.error;
          console.error('Stream error:', errorMessage);

          // Complete the stream with the error message
          await handleStreamComplete(streamingMessageId, errorMessage, chunkData.model || null, true);

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
          // Cancel any pending animation frame before completing
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          // debouncedStateUpdate.cancel(); // Original line removed

          if (chunkData.cancelled === true) {
            // Handle Cancellation: Stream was cancelled by the user (via background script signal)
            console.info(`Stream ${message.streamId} received cancellation signal.`);
            // Use partial content received so far, mark as cancelled but not an error
            const finalContent = chunkData.fullContent || batchedStreamingContentRef.current; // Use buffered ref
            await handleStreamComplete(streamingMessageId, finalContent, chunkData.model, false, true); // isError=false, isCancelled=true

          } else if (chunkData.error) {
            // Handle Error: Stream ended with an error (other than user cancellation)
            const errorMessage = chunkData.error;
            console.error(`Stream ${message.streamId} error:`, errorMessage);
            // Update the message with the error, mark as error, not cancelled
            // Use buffered ref as fallback for error message context if needed, though error message itself is primary
            const finalContentOnError = chunkData.fullContent || batchedStreamingContentRef.current;
            await handleStreamComplete(streamingMessageId, errorMessage, chunkData.model || null, true, false); // isError=true, isCancelled=false

          } else {
            // Handle Success: Stream completed normally
            const finalContent = chunkData.fullContent || batchedStreamingContentRef.current; // Use buffered ref
            console.info(`Stream ${message.streamId} completed successfully. Final length: ${finalContent.length}`);
            // Update message with final content, mark as success (not error, not cancelled)
            await handleStreamComplete(streamingMessageId, finalContent, chunkData.model, false, false); // isError=false, isCancelled=false

          }
          // Reset state regardless of outcome (completion, cancellation, error)
          setStreamingMessageId(null);
          // setStreamingContent(''); // Keep this commented or remove, buffer cleared elsewhere
          setIsCanceling(false); // Reset canceling state
        } else if (chunkContent) {
          // Process Intermediate Chunk: Append chunk to the ref buffer
          batchedStreamingContentRef.current += chunkContent;
          // Schedule UI update using requestAnimationFrame if not already scheduled
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(performStreamingStateUpdate);
          }
        }
      }
    };

    // Add listener
    chrome.runtime.onMessage.addListener(handleStreamChunk);

    return () => {
      chrome.runtime.onMessage.removeListener(handleStreamChunk);
      // Cancel any pending animation frame on cleanup
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null; // Also reset the ref here
      }
    };
  }, [streamingMessageId, messages, visibleMessages, tabId, selectedModel, // Removed streamingContent dependency
      selectedPlatformId, modelConfigData, extractedContentAdded]);

  /**
   * Sends a user message, triggers the API call via processContentViaApi,
   * handles the streaming response (via handleStreamChunk/handleStreamComplete),
   * updates message state, and saves history.
   */
  const sendMessage = async (text = inputValue) => {
    // Retrieve platform/model state from context *inside* the function
    // This ensures we get the latest values when the function is called
    const currentPlatformId = selectedPlatformId;
    const currentModelId = selectedModel;
    const currentHasCreds = hasAnyPlatformCredentials;

    // Pre-flight validation check
    if (!currentPlatformId || !currentModelId || !currentHasCreds) {
      let errorMessage = 'Error: ';
      if (!currentPlatformId) errorMessage += 'Please select a platform. ';
      if (!currentModelId) errorMessage += 'Please select a model. ';
      if (!currentHasCreds) errorMessage += 'Valid API credentials are required for the selected platform.';

      setMessages(prev => [...prev, {
        id: `sys_err_${Date.now()}`,
        role: MESSAGE_ROLES.SYSTEM,
        content: errorMessage.trim(),
        timestamp: new Date().toISOString()
      }]);
      return; // Abort if validation fails
    }

    // Original checks remain
    if (!text.trim() || isProcessing || !tabId) return;

    // Estimate tokens for the user message - Removed await
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
      platformIconUrl: selectedPlatform.iconUrl,
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
    batchedStreamingContentRef.current = ''; // Reset buffer

    // Determine if this is the first message (before adding the current user message)
    const isFirstMessage = messages.length === 0;
    // Determine if the current page is injectable
    const isPageInjectable = currentTab?.url ? isInjectablePage(currentTab.url) : false; // Added injectability check

    try {
      // Format conversation history for the API - Filter out streaming messages and extracted content messages
      const conversationHistory = messages
        .filter(msg => (msg.role === MESSAGE_ROLES.USER || msg.role === MESSAGE_ROLES.ASSISTANT) && !msg.isStreaming)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }));

      // Process with API in streaming mode - Pass explicit IDs
      const result = await processContentViaApi({
        platformId: currentPlatformId, // Use the ID retrieved at the start
        modelId: currentModelId,       // Use the ID retrieved at the start
        promptContent: text.trim(),
        conversationHistory,
        streaming: true,
        // Determine if extraction should be skipped for the first message
        skipInitialExtraction: isFirstMessage ? (!isContentExtractionEnabled || !isPageInjectable) : true, // Updated logic
        // Pass tabId and source explicitly if needed by the hook/API
        options: { tabId, source: INTERFACE_SOURCES.SIDEBAR }
      });

      // Handle case where context extraction was skipped (e.g., non-injectable page)
      if (result && result.skippedContext === true) {
        console.info('Context extraction skipped by background:', result.reason);

        // Create the system message explaining why
        const systemMessage = {
          id: `sys_${Date.now()}`,
          role: MESSAGE_ROLES.SYSTEM,
          content: `Note: ${result.reason || 'Page content could not be included.'}`,
          timestamp: new Date().toISOString(),
        };

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
      resetContentProcessing(); // Ensure hook state is reset on error too
    }
  };

  /**
   * Sends a cancellation request to the background script for the currently active stream,
   * updates the UI state to reflect cancellation, and saves the final state.
   */
  const cancelStream = async () => {
    if (!streamingMessageId || !isProcessing || isCanceling) return;

    const result = await chrome.storage.local.get(STORAGE_KEYS.STREAM_ID);
    // Extract the actual string ID from the object
    const streamId = result[STORAGE_KEYS.STREAM_ID];
    setIsCanceling(true);
    // Cancel any pending animation frame immediately on cancellation request
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    try {
      // Send cancellation message to background script
      const result = await chrome.runtime.sendMessage({
        action: 'cancelStream',
        streamId: streamId,
      });

      // Update the streaming message content to indicate cancellation
      const cancelledContent = batchedStreamingContentRef.current + '\n\n_Stream cancelled by user._';

      // Calculate output tokens for the cancelled content - Removed await
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
                  content: extractedContent,
                  timestamp: new Date().toISOString(),
                  inputTokens: TokenManagementService.estimateTokens(extractedContent), // Removed await
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

      // Save the final state to history (this now implicitly triggers calculateAndUpdateStatistics which handles cost)
      if (tabId) {
        await ChatHistoryService.saveHistory(tabId, finalMessages, modelConfigData);
        // The call to updateAccumulatedCost is removed as it's handled by saveHistory -> calculateAndUpdateStatistics
      }

      // Reset streaming state
      setStreamingMessageId(null);
      batchedStreamingContentRef.current = ''; // Clear buffer on cancellation

    } catch (error) {
      console.error('Error cancelling stream:', error);
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

  /**
   * Clears all chat history, token data, and formatted content stored
   * for the current tab by sending a message to the background script.
   * Prompts the user for confirmation before proceeding.
   */
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
    setExtractedContentAdded,
    setIsCanceling
  ]);

  /**
   * Clears only the stored formatted page content (extracted content)
   * for the current tab from local storage. Also resets the `extractedContentAdded` flag.
   */
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
      apiError: processingError,
      contentType,
      tokenStats,
      contextStatus,
      resetCurrentTabData,
      clearFormattedContentForTab,
      isContentExtractionEnabled,
      setIsContentExtractionEnabled,
      modelConfigData
    }}>
      {children}
    </SidebarChatContext.Provider>
  );
}

export const useSidebarChat = () => useContext(SidebarChatContext);

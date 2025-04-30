import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import PropTypes from 'prop-types';

import { logger } from '../../shared/logger';
import { useSidebarPlatform } from '../../contexts/platform';
import { useContent } from '../../contexts/ContentContext';
import { useTokenTracking } from '../hooks/useTokenTracking';
import ChatHistoryService from '../services/ChatHistoryService';
import TokenManagementService from '../services/TokenManagementService';
import { useContentProcessing } from '../../hooks/useContentProcessing';
import { MESSAGE_ROLES } from '../../shared/constants';
import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants';
import { isInjectablePage } from '../../shared/utils/content-utils';
import { robustSendMessage } from '../../shared/utils/message-utils';

const SidebarChatContext = createContext(null);

SidebarChatProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function SidebarChatProvider({ children }) {
  const {
    selectedPlatformId,
    selectedModel,
    hasAnyPlatformCredentials,
    tabId,
    platforms,
    getPlatformApiConfig,
  } = useSidebarPlatform();

  const { contentType, currentTab } = useContent();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [contextStatus, setContextStatus] = useState({ warningLevel: 'none' });
  const [extractedContentAdded, setExtractedContentAdded] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isContentExtractionEnabled, setIsContentExtractionEnabled] =
    useState(true);
  const [modelConfigData, setModelConfigData] = useState(null);
  const batchedStreamingContentRef = useRef('');
  const rafIdRef = useRef(null);
  const rerunStatsRef = useRef(null);

  // Use the token tracking hook
  const { tokenStats, calculateContextStatus, clearTokenData, calculateStats } =
    useTokenTracking(tabId);

  // Use the content processing hook
  const {
    processContentViaApi,
    isProcessing,
    error: processingError,
    reset: resetContentProcessing,
  } = useContentProcessing(INTERFACE_SOURCES.SIDEBAR);

  // Get platform info
  const selectedPlatform =
    platforms.find((p) => p.id === selectedPlatformId) || {};

  // Load full platform configuration when platform or model changes
  useEffect(() => {
    const loadFullConfig = async () => {
      if (!selectedPlatformId || !selectedModel || !tabId) return;

      try {
        // Get API configuration using the new function (synchronous)
        const config = await getPlatformApiConfig(selectedPlatformId);
        if (!config || !config.models) {
          logger.sidebar.warn(
            'Platform API configuration missing required structure:',
            {
              platformId: selectedPlatformId,
              hasModels: !!config?.models,
            }
          );
          setModelConfigData(null); // Clear model data if config is invalid
          return;
        }

        // Find model data directly in config.models
        const modelData = config.models.find((m) => m.id === selectedModel);
        setModelConfigData(modelData);
      } catch (error) {
        logger.sidebar.error(
          'Failed to load or process platform API configuration:',
          error
        );
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
        logger.sidebar.error('Error calculating context status:', error);
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
        logger.sidebar.error('Error loading tab chat history:', error);
      }
    };

    loadChatHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]); // Model config dependency removed to avoid reload on model switch, stats recalc handles it

  // Get visible messages (filtering out extracted content)
  const visibleMessages = useMemo(() => {
    return messages.filter((msg) => !msg.isExtractedContent);
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
    const handleStreamComplete = async (
      messageId,
      finalContentInput,
      model,
      isError = false,
      isCancelled = false
    ) => {
      // Retrieve rerun stats *before* saving history
      const savedStats = rerunStatsRef.current;
      const retrievedPreTruncationCost = savedStats?.preTruncationCost || 0;
      const retrievedPreTruncationOutput = savedStats?.preTruncationOutput || 0;

      try {
        // Calculate output tokens using the potentially modified finalContent
        const outputTokens =
          TokenManagementService.estimateTokens(finalContentInput);
        let finalContent = finalContentInput; // Use a mutable variable
        if (isCancelled) {
          // Append cancellation notice if the stream was cancelled
          finalContent += '\n\n_Stream cancelled by user._';
        }

        // Find the message being updated to preserve its details
        const originalMessage = messages.find(msg => msg.id === messageId);

        // Update message with final content (using the potentially modified finalContent)
        let updatedMessages = messages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content: finalContent,
                isStreaming: false, // Explicitly mark as not streaming
                model: model || selectedModel, // Use model from chunk or fallback
                platformIconUrl: originalMessage?.platformIconUrl || selectedPlatform.iconUrl, // Preserve original icon
                outputTokens,
                // If this is an error, change the role to system
                role: isError ? MESSAGE_ROLES.SYSTEM : msg.role,
              }
            : msg
        );

        // If content not added yet, add extracted content message
        if (!extractedContentAdded && !isError && !isCancelled) { // Only add if successful completion
          try {
            // Get formatted content from storage
            const result = await chrome.storage.local.get([
              STORAGE_KEYS.TAB_FORMATTED_CONTENT,
            ]);
            const allTabContents = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT];

            if (allTabContents) {
              const tabIdKey = tabId.toString();
              const extractedContent = allTabContents[tabIdKey];

              if (
                extractedContent &&
                typeof extractedContent === 'string' &&
                extractedContent.trim()
              ) {
                const contentMessage = {
                  id: `extracted_${Date.now()}`,
                  role: MESSAGE_ROLES.USER,
                  content: extractedContent,
                  timestamp: new Date().toISOString(),
                  inputTokens:
                    TokenManagementService.estimateTokens(extractedContent),
                  outputTokens: 0,
                  isExtractedContent: true,
                };

                // Find the index of the completed assistant message
                const completedMsgIndex = updatedMessages.findIndex(msg => msg.id === messageId);
                if (completedMsgIndex > 0) { // Ensure it's not the first message
                    // Insert extracted content before the completed assistant message
                    updatedMessages.splice(completedMsgIndex -1, 0, contentMessage);
                    setExtractedContentAdded(true); // Mark as added
                } else {
                     logger.sidebar.warn("Could not find completed message index to insert extracted content.");
                }
              }
            }
          } catch (extractError) {
            logger.sidebar.error(
              'Error adding extracted content:',
              extractError
            );
          }
        }

        // Set messages with all updates at once
        setMessages(updatedMessages);
        batchedStreamingContentRef.current = ''; // Clear buffer on completion

        // Save history, passing the retrieved initial stats
        if (tabId) {
          await ChatHistoryService.saveHistory(
            tabId,
            updatedMessages,
            modelConfigData,
            {
              initialAccumulatedCost: retrievedPreTruncationCost,
              initialOutputTokens: retrievedPreTruncationOutput,
            }
          );
           // Recalculate stats after saving potentially modified history
           await calculateStats(updatedMessages, modelConfigData);
        }
      } catch (error) {
        logger.sidebar.error('Error handling stream completion:', error);
      } finally {
        // Clear the ref after saving history, regardless of success or error
        rerunStatsRef.current = null;
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
          logger.sidebar.error('Invalid chunk data received:', message);
          return;
        }

        // Handle stream error
        if (chunkData.error) {
          const errorMessage = chunkData.error;
          logger.sidebar.error('Stream error:', errorMessage);

          // Complete the stream with the error message
          await handleStreamComplete(
            streamingMessageId,
            errorMessage,
            chunkData.model || null,
            true // isError=true
          );

          setStreamingMessageId(null);
          setIsCanceling(false);

          return;
        }

        // Process chunk content - ensure it's a string
        const chunkContent =
          typeof chunkData.chunk === 'string'
            ? chunkData.chunk
            : chunkData.chunk
              ? JSON.stringify(chunkData.chunk)
              : '';

        // Handle stream completion, cancellation, or error
        if (chunkData.done) {
          // Cancel any pending animation frame before completing
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }

          if (chunkData.cancelled === true) {
            // Handle Cancellation: Stream was cancelled by the user (via background script signal)
            logger.sidebar.info(
              `Stream ${message.streamId} received cancellation signal.`
            );
            // Use partial content received so far, mark as cancelled but not an error
            const finalContent =
              chunkData.fullContent || batchedStreamingContentRef.current; // Use buffered ref
            await handleStreamComplete(
              streamingMessageId,
              finalContent,
              chunkData.model,
              false, // isError=false
              true // isCancelled=true
            );
          } else if (chunkData.error) {
            // Handle Error: Stream ended with an error (other than user cancellation)
            const errorMessage = chunkData.error;
            logger.sidebar.error(
              `Stream ${message.streamId} error:`,
              errorMessage
            );
            // Update the message with the error, mark as error, not cancelled
            await handleStreamComplete(
              streamingMessageId,
              errorMessage,
              chunkData.model || null,
              true, // isError=true
              false // isCancelled=false
            );
          } else {
            // Handle Success: Stream completed normally
            const finalContent =
              chunkData.fullContent || batchedStreamingContentRef.current; // Use buffered ref
            // Update message with final content, mark as success (not error, not cancelled)
            await handleStreamComplete(
              streamingMessageId,
              finalContent,
              chunkData.model,
              false, // isError=false
              false // isCancelled=false
            );
          }
          // Reset state regardless of outcome (completion, cancellation, error)
          setStreamingMessageId(null);
          setIsCanceling(false); // Reset canceling state
        } else if (chunkContent) {
          // Process Intermediate Chunk: Append chunk to the ref buffer
          batchedStreamingContentRef.current += chunkContent;
          // Schedule UI update using requestAnimationFrame if not already scheduled
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(
              performStreamingStateUpdate
            );
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
  }, [
    streamingMessageId,
    messages, // Include messages to access latest state in handleStreamComplete
    tabId,
    selectedModel,
    selectedPlatform.iconUrl, // Include for fallback icon url
    modelConfigData,
    extractedContentAdded,
    setMessages, // Include setters used indirectly
    setStreamingMessageId,
    setIsCanceling,
    setExtractedContentAdded,
    performStreamingStateUpdate, // Include the useCallback function
    calculateStats, // Include for recalculation on completion
  ]);

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
      if (!currentHasCreds)
        errorMessage +=
          'Valid API credentials are required for the selected platform.';

      setMessages((prev) => [
        ...prev,
        {
          id: `sys_err_${Date.now()}`,
          role: MESSAGE_ROLES.SYSTEM,
          content: errorMessage.trim(),
          timestamp: new Date().toISOString(),
        },
      ]);
      return; // Abort if validation fails
    }

    // Original checks remain
    if (!text.trim() || isProcessing || !tabId) return;

    // Estimate tokens for the user message
    const inputTokens = TokenManagementService.estimateTokens(text.trim());
    const userMessageId = `msg_${Date.now()}`;

    const userMessage = {
      id: userMessageId,
      role: MESSAGE_ROLES.USER,
      content: text.trim(),
      timestamp: new Date().toISOString(),
      inputTokens,
      outputTokens: 0,
    };

    // Create placeholder for assistant response with explicit streaming flag
    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage = {
      id: assistantMessageId,
      role: MESSAGE_ROLES.ASSISTANT,
      content: '', // Empty initially, will be streamed
      model: selectedModel,
      platformIconUrl: selectedPlatform.iconUrl,
      platformId: selectedPlatformId,
      timestamp: new Date().toISOString(),
      isStreaming: true,
      inputTokens: 0, // No input tokens for assistant messages
      outputTokens: 0, // Will be updated when streaming completes
    };

    // Update UI with user message and assistant placeholder
    // Use functional update to ensure we have the latest messages state
    setMessages(prevMessages => [...prevMessages, userMessage, assistantMessage]);
    setInputValue('');
    setStreamingMessageId(assistantMessageId);
    batchedStreamingContentRef.current = ''; // Reset buffer

    // Preserve current stats BEFORE the API call (similar to rerun logic)
    const currentAccumulatedCost = tokenStats.accumulatedCost || 0;
    const currentOutputTokens = tokenStats.outputTokens || 0;
    rerunStatsRef.current = {
      preTruncationCost: currentAccumulatedCost,
      preTruncationOutput: currentOutputTokens,
    };

      // Determine if the current page is injectable
    const isPageInjectable = currentTab?.url
      ? isInjectablePage(currentTab.url)
      : false;

    // Decide whether to effectively enable content extraction based on page injectability
    const effectiveContentExtractionEnabled = isPageInjectable
      ? isContentExtractionEnabled
      : false;

    try {
      // Format conversation history for the API - Filter out streaming messages and extracted content messages
      // Use the state *before* adding the new user message and placeholder
      const historyForApi = messages
        .filter(
          (msg) =>
            (msg.role === MESSAGE_ROLES.USER ||
              msg.role === MESSAGE_ROLES.ASSISTANT) &&
            !msg.isStreaming && !msg.isExtractedContent // Exclude extracted content from history sent to API
        )
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }));

      // Process with API in streaming mode - Pass explicit IDs
      const result = await processContentViaApi({
        platformId: currentPlatformId, // Use the ID retrieved at the start
        modelId: currentModelId, // Use the ID retrieved at the start
        promptContent: text.trim(),
        conversationHistory: historyForApi, // Use the filtered history
        streaming: true,
        // Pass the toggle state directly, adjusted for page injectability
        isContentExtractionEnabled: effectiveContentExtractionEnabled,
        options: {
          tabId,
          source: INTERFACE_SOURCES.SIDEBAR,
          // Keep pre-truncation stats if they exist
          ...(rerunStatsRef.current && {
            preTruncationCost: rerunStatsRef.current.preTruncationCost,
            preTruncationOutput: rerunStatsRef.current.preTruncationOutput,
          }),
        },
      });

      // Handle case where context extraction was skipped (e.g., non-injectable page)
      if (result && result.skippedContext === true) {
        logger.sidebar.info(
          'Context extraction skipped by background:',
          result.reason
        );

        // Create the system message explaining why
        const systemMessage = {
          id: `sys_${Date.now()}`,
          role: MESSAGE_ROLES.SYSTEM,
          content: `Note: ${result.reason || 'Page content could not be included.'}`,
          timestamp: new Date().toISOString(),
        };

        // Update state: remove placeholder, add user msg + system msg
        setMessages(prevMessages => {
            // Filter out the placeholder assistant message
            const messagesWithoutPlaceholder = prevMessages.filter(msg => msg.id !== assistantMessageId);
            // Add the user message and the system message
            return [...messagesWithoutPlaceholder, userMessage, systemMessage];
        });

        // Save this state (user message + system message) to history
        if (tabId) {
          // Get the final message array from state after update
          setMessages(currentFinalMessages => {
              ChatHistoryService.saveHistory(
                  tabId,
                  currentFinalMessages,
                  modelConfigData
              );
              // Recalculate stats based on this final state
              calculateStats(currentFinalMessages, modelConfigData);
              return currentFinalMessages; // Return state unchanged for this setter call
          });
        }

        // Reset streaming state as no stream was initiated
        setStreamingMessageId(null);
        resetContentProcessing(); // Reset the hook's processing state
        rerunStatsRef.current = null; // Clear stats ref

        return; // Stop further processing for this message send
      }

      if (!result || !result.success) {
        // Use the error from the result if available, otherwise use a default
        const errorMsg = result?.error || 'Failed to initialize streaming';
        throw new Error(errorMsg);
      }
    } catch (error) {
      logger.sidebar.error('Error processing streaming message:', error);

      // Determine error content based on port closure
      const isPortClosedError = error.isPortClosed;
      const systemErrorMessageContent = isPortClosedError
        ? '[System: The connection was interrupted. Please try sending your message again.]'
        : `Error: ${error.message || 'Failed to process request'}`;


      // Update UI: Replace the placeholder assistant message with a system error message
      setMessages(prevMessages => prevMessages.map(msg =>
            msg.id === assistantMessageId
            ? {
                ...msg, // Keep id, timestamp etc.
                role: MESSAGE_ROLES.SYSTEM,
                content: systemErrorMessageContent,
                isStreaming: false,
                outputTokens: 0, // No output tokens for error
                model: null, // Clear model/platform on error
                platformId: null,
                platformIconUrl: null,
              }
            : msg
        )
      );


      // Save error state to history
      if (tabId) {
           // Get the final message array from state after update
           setMessages(currentFinalMessages => {
               ChatHistoryService.saveHistory(
                   tabId,
                   currentFinalMessages,
                   modelConfigData
               );
               // Recalculate stats based on this final state
               calculateStats(currentFinalMessages, modelConfigData);
               return currentFinalMessages; // Return state unchanged for this setter call
           });
      }

      setStreamingMessageId(null);
      resetContentProcessing(); // Ensure hook state is reset on error too
      rerunStatsRef.current = null; // Clear stats ref
    }
  };

  // --- Rerun/Edit Logic ---

  const rerunMessage = useCallback(
    async (messageId) => {
      if (!tabId || !selectedPlatformId || !selectedModel || isProcessing)
        return;

      const index = messages.findIndex((msg) => msg.id === messageId);
      if (index === -1 || messages[index].role !== MESSAGE_ROLES.USER) {
        logger.sidebar.error(
          'Cannot rerun: Message not found or not a user message.'
        );
        return;
      }

      // Preserve current stats before truncation
      const preTruncationCost = tokenStats.accumulatedCost || 0;
      const preTruncationOutput = tokenStats.outputTokens || 0;
      rerunStatsRef.current = { preTruncationCost, preTruncationOutput }; // Store stats

      // Truncate history up to and including the message to rerun
      const truncatedMessages = messages.slice(0, index + 1);
      setMessages(truncatedMessages); // Update UI immediately with truncated history

      const userMessageToRerun =
        truncatedMessages[truncatedMessages.length - 1];
      const promptContent = userMessageToRerun.content;
      const conversationHistory = truncatedMessages
        .slice(0, -1) // Exclude the message being rerun
        .filter(
          (msg) =>
            (msg.role === MESSAGE_ROLES.USER ||
              msg.role === MESSAGE_ROLES.ASSISTANT) &&
            !msg.isStreaming && !msg.isExtractedContent // Also filter extracted content
        )
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }));

      // Create placeholder for assistant response
      const assistantMessageId = `msg_${Date.now() + 1}`;
      const assistantMessage = {
        id: assistantMessageId,
        role: MESSAGE_ROLES.ASSISTANT,
        content: '', // Empty initially, will be streamed
        model: selectedModel,
        platformIconUrl: selectedPlatform.iconUrl,
        platformId: selectedPlatformId,
        timestamp: new Date().toISOString(),
        isStreaming: true,
        inputTokens: 0,
        outputTokens: 0,
      };

      // Add placeholder AFTER setting truncated messages
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessageId(assistantMessageId);
      batchedStreamingContentRef.current = ''; // Reset buffer

      try {
        const result = await processContentViaApi({
          platformId: selectedPlatformId,
          modelId: selectedModel,
          promptContent,
          conversationHistory,
          streaming: true,
          isContentExtractionEnabled: false, // Reruns don't re-extract based on toggle
          options: {
            tabId,
            source: INTERFACE_SOURCES.SIDEBAR,
            preTruncationCost, // Pass preserved stats
            preTruncationOutput, // Pass preserved stats
          },
        });

        if (!result || !result.success) {
          throw new Error(
            result?.error || 'Failed to initialize streaming for rerun'
          );
        }
      } catch (error) {
        logger.sidebar.error('Error processing rerun message:', error);

        // Determine error content based on port closure
        const isPortClosedError = error.isPortClosed;
        const systemErrorMessageContent = isPortClosedError
          ? '[System: The connection was interrupted during rerun. Please try again.]'
          : `Error: ${error.message || 'Failed to process rerun request'}`;

        // Update UI: Replace the placeholder with a system error message
        setMessages(prevMessages => prevMessages.map(msg =>
            msg.id === assistantMessageId
            ? {
                ...msg, // Keep id, timestamp etc.
                role: MESSAGE_ROLES.SYSTEM,
                content: systemErrorMessageContent,
                isStreaming: false,
                outputTokens: 0,
                model: null,
                platformId: null,
                platformIconUrl: null,
              }
            : msg
          )
        );
        setStreamingMessageId(null);

        // Save error state to history, passing the preserved stats
        if (tabId) {
          const savedStats = rerunStatsRef.current;
          const historyOptions = savedStats
            ? {
                initialAccumulatedCost: savedStats.preTruncationCost || 0,
                initialOutputTokens: savedStats.preTruncationOutput || 0,
              }
            : {};
          // Use functional update to get the latest messages for saving
          setMessages(currentFinalMessages => {
              ChatHistoryService.saveHistory(
                  tabId,
                  currentFinalMessages,
                  modelConfigData,
                  historyOptions
              );
              // Recalculate stats based on this final state
              calculateStats(currentFinalMessages, modelConfigData);
              return currentFinalMessages; // Return state unchanged
          });
        }
        rerunStatsRef.current = null; // Clear stats ref on error
        resetContentProcessing();
      }
    },
    [
      messages,
      tokenStats,
      setMessages,
      processContentViaApi,
      selectedPlatformId,
      selectedModel,
      setStreamingMessageId,
      tabId,
      isProcessing,
      selectedPlatform.iconUrl,
      resetContentProcessing,
      modelConfigData,
      calculateStats, // Added dependency
    ]
  );

  const editAndRerunMessage = useCallback(
    async (messageId, newContent) => {
      if (
        !tabId ||
        !selectedPlatformId ||
        !selectedModel ||
        isProcessing ||
        !newContent.trim()
      )
        return;

      const index = messages.findIndex((msg) => msg.id === messageId);
      if (index === -1 || messages[index].role !== MESSAGE_ROLES.USER) {
        logger.sidebar.error(
          'Cannot edit/rerun: Message not found or not a user message.'
        );
        return;
      }

      // Preserve current stats before truncation
      const preTruncationCost = tokenStats.accumulatedCost || 0;
      const preTruncationOutput = tokenStats.outputTokens || 0;
      rerunStatsRef.current = { preTruncationCost, preTruncationOutput }; // Store stats

      // Truncate history and update the edited message
      let truncatedMessages = messages.slice(0, index + 1);
      const editedMessageIndex = truncatedMessages.length - 1;
      const originalMessage = truncatedMessages[editedMessageIndex];
      const updatedMessage = {
        ...originalMessage,
        content: newContent.trim(),
        inputTokens: TokenManagementService.estimateTokens(newContent.trim()), // Recalculate tokens
      };
      truncatedMessages[editedMessageIndex] = updatedMessage;

      setMessages(truncatedMessages); // Update UI immediately with truncated & edited history

      const promptContent = updatedMessage.content;
      const conversationHistory = truncatedMessages
        .slice(0, -1) // Exclude the edited message
        .filter(
          (msg) =>
            (msg.role === MESSAGE_ROLES.USER ||
              msg.role === MESSAGE_ROLES.ASSISTANT) &&
            !msg.isStreaming && !msg.isExtractedContent // Also filter extracted content
        )
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }));

      // Create placeholder for assistant response
      const assistantMessageId = `msg_${Date.now() + 1}`;
      const assistantMessage = {
        id: assistantMessageId,
        role: MESSAGE_ROLES.ASSISTANT,
        content: '', // Empty initially, will be streamed
        model: selectedModel,
        platformIconUrl: selectedPlatform.iconUrl,
        platformId: selectedPlatformId,
        timestamp: new Date().toISOString(),
        isStreaming: true,
        inputTokens: 0,
        outputTokens: 0,
      };

      // Add placeholder AFTER setting truncated messages
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessageId(assistantMessageId);
      batchedStreamingContentRef.current = ''; // Reset buffer

      try {
        const result = await processContentViaApi({
          platformId: selectedPlatformId,
          modelId: selectedModel,
          promptContent,
          conversationHistory,
          streaming: true,
          isContentExtractionEnabled: false, // Edit/Reruns don't re-extract based on toggle
          options: {
            tabId,
            source: INTERFACE_SOURCES.SIDEBAR,
            preTruncationCost, // Pass preserved stats
            preTruncationOutput, // Pass preserved stats
          },
        });

        if (!result || !result.success) {
          throw new Error(
            result?.error || 'Failed to initialize streaming for edit/rerun'
          );
        }
      } catch (error) {
        logger.sidebar.error('Error processing edit/rerun message:', error);

        // Determine error content based on port closure
        const isPortClosedError = error.isPortClosed;
        const systemErrorMessageContent = isPortClosedError
          ? '[System: The connection was interrupted during edit/rerun. Please try again.]'
          : `Error: ${error.message || 'Failed to process edit/rerun request'}`;

        // Update UI: Replace the placeholder with a system error message
        setMessages(prevMessages => prevMessages.map(msg =>
            msg.id === assistantMessageId
            ? {
                ...msg, // Keep id, timestamp etc.
                role: MESSAGE_ROLES.SYSTEM,
                content: systemErrorMessageContent,
                isStreaming: false,
                outputTokens: 0,
                model: null,
                platformId: null,
                platformIconUrl: null,
              }
            : msg
          )
        );
        setStreamingMessageId(null);

        // Save error state to history, passing the preserved stats
        if (tabId) {
          const savedStats = rerunStatsRef.current;
          const historyOptions = savedStats
            ? {
                initialAccumulatedCost: savedStats.preTruncationCost || 0,
                initialOutputTokens: savedStats.preTruncationOutput || 0,
              }
            : {};
          // Use functional update to get the latest messages for saving
          setMessages(currentFinalMessages => {
              ChatHistoryService.saveHistory(
                  tabId,
                  currentFinalMessages,
                  modelConfigData,
                  historyOptions
              );
              // Recalculate stats based on this final state
               calculateStats(currentFinalMessages, modelConfigData);
              return currentFinalMessages; // Return state unchanged
          });
        }
        rerunStatsRef.current = null; // Clear stats ref on error
        resetContentProcessing();
      }
    },
    [
      messages,
      tokenStats,
      setMessages,
      processContentViaApi,
      selectedPlatformId,
      selectedModel,
      setStreamingMessageId,
      tabId,
      isProcessing,
      selectedPlatform.iconUrl,
      resetContentProcessing,
      modelConfigData,
      calculateStats, // Added dependency
    ]
  );

  const rerunAssistantMessage = useCallback(
    async (assistantMessageId) => {
      // Guard Clauses
      if (!tabId || !selectedPlatformId || !selectedModel || isProcessing)
        return;

      // Find Indices
      const assistantIndex = messages.findIndex(
        (msg) => msg.id === assistantMessageId
      );
      // Find the preceding USER message, skipping any potential SYSTEM or EXTRACTED messages
      let userIndex = -1;
      for (let i = assistantIndex - 1; i >= 0; i--) {
          if (messages[i].role === MESSAGE_ROLES.USER && !messages[i].isExtractedContent) {
              userIndex = i;
              break;
          }
      }

      if (
        assistantIndex <= 0 || // Assistant message must exist and not be the first
        userIndex < 0 // Preceding user message must be found
      ) {
        logger.sidebar.error(
          'Cannot rerun assistant message: Invalid message structure or preceding user message not found.',
          { assistantIndex, userIndex }
        );
        return;
      }

      // Preserve Stats
      const preTruncationCost = tokenStats.accumulatedCost || 0;
      const preTruncationOutput = tokenStats.outputTokens || 0;
      rerunStatsRef.current = { preTruncationCost, preTruncationOutput };

      // Truncate History (up to and including the preceding user message)
      const truncatedMessages = messages.slice(0, userIndex + 1);

      // Update UI immediately
      setMessages(truncatedMessages);

      // Get User Prompt
      const promptContent = truncatedMessages[userIndex].content;

      // Get History (before the user prompt)
      const conversationHistory = truncatedMessages
        .slice(0, userIndex) // Exclude the user message itself
        .filter(
          (msg) =>
            (msg.role === MESSAGE_ROLES.USER ||
              msg.role === MESSAGE_ROLES.ASSISTANT) &&
            !msg.isStreaming && !msg.isExtractedContent // Also filter extracted content
        )
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }));

      // Create Placeholder
      const assistantPlaceholderId = `msg_${Date.now() + 1}`;
      const assistantPlaceholder = {
        id: assistantPlaceholderId,
        role: MESSAGE_ROLES.ASSISTANT,
        content: '',
        model: selectedModel,
        platformIconUrl: selectedPlatform.iconUrl,
        platformId: selectedPlatformId,
        timestamp: new Date().toISOString(),
        isStreaming: true,
        inputTokens: 0,
        outputTokens: 0,
      };

      // Add Placeholder to UI
      setMessages((prev) => [...prev, assistantPlaceholder]);

      // Set Streaming ID
      setStreamingMessageId(assistantPlaceholderId);

      // Reset Buffer
      batchedStreamingContentRef.current = '';

      // API Call
      try {
        const result = await processContentViaApi({
          platformId: selectedPlatformId,
          modelId: selectedModel,
          promptContent,
          conversationHistory,
          streaming: true,
          isContentExtractionEnabled: false, // Assistant reruns don't re-extract based on toggle
          options: {
            tabId,
            source: INTERFACE_SOURCES.SIDEBAR,
            preTruncationCost, // Pass preserved stats
            preTruncationOutput, // Pass preserved stats
          },
        });

        if (!result || !result.success) {
          throw new Error(
            result?.error ||
              'Failed to initialize streaming for assistant rerun'
          );
        }
      } catch (error) {
        logger.sidebar.error(
          'Error processing assistant rerun message:',
          error
        );

        // Determine error content based on port closure
        const isPortClosedError = error.isPortClosed;
        const systemErrorMessageContent = isPortClosedError
          ? '[System: The connection was interrupted during assistant rerun. Please try again.]'
          : `Error: ${error.message || 'Failed to process assistant rerun request'}`;

        // Update UI: Replace the placeholder with a system error message
        setMessages(prevMessages => prevMessages.map(msg =>
            msg.id === assistantPlaceholderId
            ? {
                ...msg, // Keep id, timestamp etc.
                role: MESSAGE_ROLES.SYSTEM,
                content: systemErrorMessageContent,
                isStreaming: false,
                outputTokens: 0,
                model: null,
                platformId: null,
                platformIconUrl: null,
              }
            : msg
          )
        );
        setStreamingMessageId(null);

        // Save error state to history, passing the preserved stats
        if (tabId) {
          const savedStats = rerunStatsRef.current;
          const historyOptions = savedStats
            ? {
                initialAccumulatedCost: savedStats.preTruncationCost || 0,
                initialOutputTokens: savedStats.preTruncationOutput || 0,
              }
            : {};
           // Use functional update to get the latest messages for saving
           setMessages(currentFinalMessages => {
               ChatHistoryService.saveHistory(
                   tabId,
                   currentFinalMessages,
                   modelConfigData,
                   historyOptions
               );
               // Recalculate stats based on this final state
               calculateStats(currentFinalMessages, modelConfigData);
               return currentFinalMessages; // Return state unchanged
           });
        }
        rerunStatsRef.current = null; // Clear stats ref on error
        resetContentProcessing();
      }
    },
    [
      tabId,
      selectedPlatformId,
      selectedModel,
      isProcessing,
      messages,
      tokenStats,
      setMessages,
      processContentViaApi,
      setStreamingMessageId,
      resetContentProcessing,
      selectedPlatform.iconUrl,
      modelConfigData,
      calculateStats, // Added dependency
    ]
  );

  // --- End Rerun/Edit Logic ---

  /**
   * Sends a cancellation request to the background script for the currently active stream,
   * updates the UI state to reflect cancellation, and saves the final state.
   * Wrapped in useCallback to stabilize its reference.
   */
  const cancelStream = useCallback(async () => {
    if (!streamingMessageId || !isProcessing || isCanceling) return;

    const { [STORAGE_KEYS.STREAM_ID]: streamId } = await chrome.storage.local.get(STORAGE_KEYS.STREAM_ID);

    // Check if a valid streamId was retrieved before proceeding
    if (!streamId) {
        logger.sidebar.warn("Attempted to cancel stream, but no active stream ID found in storage.");
        // Optionally reset state here if it's definitively out of sync
        // setIsCanceling(false);
        // setStreamingMessageId(null);
        return;
    }


    setIsCanceling(true);
    // Cancel any pending animation frame immediately on cancellation request
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    try {
      // Send cancellation message to background script
      await robustSendMessage({
        action: 'cancelStream',
        streamId: streamId, // Use the retrieved streamId
      });
      logger.sidebar.info(`Sent cancellation request for stream ID: ${streamId}`);

      // The background script should now send a 'streamChunk' message with done=true and cancelled=true.
      // The handleStreamChunk listener will handle the state update (setting content, isStreaming=false, saving history).
      // We don't need to manually update the message content or save history here anymore,
      // as the handleStreamComplete logic triggered by handleStreamChunk will manage it.

      // We might still want to clear the buffer immediately for responsiveness,
      // though handleStreamComplete will also do this.
      // batchedStreamingContentRef.current = '';

      // Note: We intentionally DO NOT reset streamingMessageId or isCanceling here.
      // The handleStreamChunk listener will do that when it receives the final 'cancelled' chunk.
      // This prevents race conditions where we might reset state before the final chunk arrives.

    } catch (error) {
      logger.sidebar.error('Error sending cancelStream message:', error);
      // If sending the message fails, we might be in an inconsistent state.
      // Resetting state here could be a fallback.
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === streamingMessageId
            ? {
                ...msg,
                content: msg.content + '\n\n_Error trying to cancel stream._',
                isStreaming: false,
              }
            : msg
        )
      );
       // Use functional update to get latest messages for saving
       setMessages(currentFinalMessages => {
            if (tabId) {
                ChatHistoryService.saveHistory(
                    tabId,
                    currentFinalMessages,
                    modelConfigData
                );
                // Recalculate stats
                calculateStats(currentFinalMessages, modelConfigData);
            }
            return currentFinalMessages; // Return state unchanged
        });

      setStreamingMessageId(null);
      batchedStreamingContentRef.current = ''; // Clear buffer on error too
      setIsCanceling(false); // Reset canceling state on error
    }
    // No finally block needed to reset isCanceling, as it's reset by handleStreamChunk or the catch block
  }, [
      // Dependencies for cancelStream:
      streamingMessageId,
      isProcessing,
      isCanceling,
      tabId, // Needed for saving history in error case
      modelConfigData, // Needed for saving history in error case
      setIsCanceling, // State setters are stable but included for clarity
      setStreamingMessageId,
      setMessages,
      calculateStats, // Added dependency
      // robustSendMessage is stable (imported)
      // logger is stable (imported)
      // STORAGE_KEYS is stable (imported)
      // refs (rafIdRef, batchedStreamingContentRef) don't need to be dependencies
  ]);


  // Clear chat history and token metadata
  const clearChat = async () => {
    if (!tabId) return;

    setMessages([]);
    setExtractedContentAdded(false); // Reset the flag so content can be added again
    await ChatHistoryService.clearHistory(tabId);

    // Clear token metadata (which also resets stats)
    await clearTokenData();
  };

  /**
   * Clears all chat history, token data, and formatted content stored
   * for the current tab by sending a message to the background script.
   * Prompts the user for confirmation before proceeding.
   * Also cancels any ongoing stream.
   */
  const resetCurrentTabData = useCallback(async () => {
    if (tabId === null || tabId === undefined) {
      logger.sidebar.warn('resetCurrentTabData called without a valid tabId.');
      return;
    }

    if (
      window.confirm(
        'Are you sure you want to clear all chat history and data for this tab? This action cannot be undone.'
      )
    ) {
      try {
        // Check if a stream is active and needs cancellation *before* clearing data
        if (streamingMessageId && isProcessing && !isCanceling) {
          logger.sidebar.info(
            'Reset requested: Cancelling ongoing stream first...'
          );
          await cancelStream(); // Wait for cancellation attempt
          logger.sidebar.info('Stream cancellation requested before reset.');
          // Note: We proceed even if cancellation fails, as the goal is to clear data.
        }

        // Now send message to clear data in background
        const response = await robustSendMessage({
          action: 'clearTabData',
          tabId: tabId,
        });

        if (response && response.success) {
          // Clear frontend state immediately after background confirmation
          setMessages([]);
          setInputValue('');
          setStreamingMessageId(null); // Ensure streaming ID is cleared
          setExtractedContentAdded(false); // Allow extracted content to be added again
          setIsCanceling(false); // Ensure canceling state is reset

          // Clear token data (which also recalculates stats to zero)
          await clearTokenData();
          logger.sidebar.info(`Successfully reset data for tab: ${tabId}`);
        } else {
          throw new Error(
            response?.error || 'Background script failed to clear data.'
          );
        }
      } catch (error) {
        logger.sidebar.error('Failed to reset tab data:', error);
        // Attempt to reset frontend state even on error for better UX
        setMessages([]);
        setInputValue('');
        setStreamingMessageId(null);
        setExtractedContentAdded(false);
        setIsCanceling(false);
        await clearTokenData(); // Still try to clear token data
      }
    }
  }, [
    tabId,
    clearTokenData,
    setMessages,
    setInputValue,
    setStreamingMessageId,
    setExtractedContentAdded,
    setIsCanceling,
    streamingMessageId, // Need to know if stream is active
    isProcessing,       // Need to know if stream is active
    isCanceling,        // Need to know if cancellation is already in progress
    cancelStream,       // Need the cancel function
  ]);

  /**
   * Clears only the stored formatted page content (extracted content)
   * for the current tab from local storage. Also resets the `extractedContentAdded` flag.
   */
  const clearFormattedContentForTab = useCallback(async () => {
    if (tabId === null || tabId === undefined) {
      logger.sidebar.warn(
        'clearFormattedContentForTab called without a valid tabId.'
      );
      return;
    }

    const tabIdKey = tabId.toString();
    logger.sidebar.info(
      `Attempting to clear formatted content for tab: ${tabIdKey}`
    );

    try {
      // Retrieve the entire formatted content object
      const result = await chrome.storage.local.get(
        STORAGE_KEYS.TAB_FORMATTED_CONTENT
      );
      const allFormattedContent =
        result[STORAGE_KEYS.TAB_FORMATTED_CONTENT] || {};

      // Check if the key exists before deleting
        if (Object.hasOwn(allFormattedContent, tabIdKey)) {
        // Create a mutable copy to avoid modifying the original object directly from storage result
        const updatedFormattedContent = { ...allFormattedContent };

        // Delete the entry for the current tab
        delete updatedFormattedContent[tabIdKey];

        // Save the modified object back to storage
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_FORMATTED_CONTENT]: updatedFormattedContent,
        });
        logger.sidebar.info(
          `Successfully cleared formatted content for tab: ${tabIdKey}`
        );
      } else {
        logger.sidebar.info(
          `No formatted content found in storage for tab: ${tabIdKey}. No action needed.`
        );
      }

      // Also reset the local flag indicating if extracted content was added to the current chat view
      setExtractedContentAdded(false);
      logger.sidebar.info(
        `Reset extractedContentAdded flag for tab: ${tabIdKey}`
      );
    } catch (error) {
      logger.sidebar.error(
        `Error clearing formatted content for tab ${tabIdKey}:`,
        error
      );
    }
  }, [tabId, setExtractedContentAdded]);

  // Add global keydown listener for Escape key cancellation
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      // Check if stream is active and not already canceling
      if (event.key === 'Escape' && streamingMessageId && isProcessing && !isCanceling) {
        logger.sidebar.debug("Escape key pressed, attempting to cancel stream.");
        cancelStream();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
    // Dependency array includes cancelStream (now memoized) and flags needed for the condition
  }, [isProcessing, isCanceling, streamingMessageId, cancelStream]);

  return (
    <SidebarChatContext.Provider
      value={{
        messages: visibleMessages, // Filtered messages for display
        allMessages: messages, // All messages including extracted content
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
        modelConfigData,
        rerunMessage,
        editAndRerunMessage,
        rerunAssistantMessage,
      }}
    >
      {children}
    </SidebarChatContext.Provider>
  );
}

export const useSidebarChat = () => useContext(SidebarChatContext);
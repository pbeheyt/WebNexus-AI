// src/sidepanel/hooks/useChatStreaming.js ---
import { useEffect, useCallback, useRef } from 'react';

import { logger } from '../../shared/logger';
import { MESSAGE_ROLES, STORAGE_KEYS } from '../../shared/constants';

/**
 * Custom hook to manage chat streaming logic, including receiving chunks,
 * updating UI, handling completion/errors/cancellation, and managing cancellation requests.
 *
 * @param {object} args - Dependencies passed from the parent context.
 * @param {number} args.tabId - The current tab ID.
 * @param {function} args.setMessages - State setter for the messages array.
 * @param {Array} args.messages - Current messages array (read-only).
 * @param {object} args.modelConfigData - Configuration for the selected model.
 * @param {string} args.selectedModel - ID of the selected model.
 * @param {object} args.selectedPlatform - Details of the selected platform.
 * @param {object} args.tokenStats - Current token statistics (read-only).
 * @param {React.MutableRefObject} args.rerunStatsRef - Ref holding stats before a rerun/edit.
 * @param {function} args.setExtractedContentAdded - State setter for extracted content flag.
 * @param {boolean} args.isProcessing - Flag indicating if an API call is in progress.
 * @param {boolean} args.isCanceling - Flag indicating if cancellation is in progress.
 * @param {function} args.setIsCanceling - State setter for cancellation flag.
 * @param {string|null} args.streamingMessageId - ID of the message currently being streamed.
 * @param {function} args.setStreamingMessageId - State setter for streaming message ID.
 * @param {React.MutableRefObject} args.batchedStreamingContentRef - Ref for buffering stream chunks.
 * @param {React.MutableRefObject} args.rafIdRef - Ref for requestAnimationFrame ID.
 * @param {object} args.ChatHistoryService - Service for chat history management.
 * @param {object} args.TokenManagementService - Service for token management.
 * @param {function} args.robustSendMessage - Utility for sending messages to background.
 * @param {boolean} args.extractedContentAdded - Flag indicating if extracted content has been added.
 * @returns {object} - Object containing the cancelStream function.
 */
export function useChatStreaming({
  tabId,
  setMessages,
  messages,
  modelConfigData,
  selectedModel,
  rerunStatsRef,
  setExtractedContentAdded,
  isProcessing,
  isCanceling,
  setIsCanceling,
  streamingMessageId,
  setStreamingMessageId,
  batchedStreamingContentRef,
  rafIdRef,
  ChatHistoryService,
  TokenManagementService,
  robustSendMessage,
  extractedContentAdded,
  isThinkingModeEnabled = false,
}) {
  const batchedThinkingContentRef = useRef(''); // Buffer for thinking chunks
  // --- State Update Logic (using requestAnimationFrame) ---
  const performThinkingStreamingStateUpdate = useCallback(() => {
    rafIdRef.current = null; // Reset the ref
    const messageId = streamingMessageId; // Read current streaming ID
    const accumulatedThinkingContent = batchedThinkingContentRef.current; // Read thinking buffer

    if (!messageId) return; // Safety check

    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              thinkingContent: accumulatedThinkingContent, // Update thinkingContent
              isStreaming: true,
            }
          : msg
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingMessageId, batchedThinkingContentRef, rafIdRef, setMessages]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingMessageId, batchedStreamingContentRef, rafIdRef, setMessages]); // Dependencies: relevant state/refs/setters

  // --- Stream Completion Handler ---
  const handleStreamComplete = useCallback(
    async (
      messageId,
      finalContentInput,
      finalThinkingContentInput, // <-- Add this parameter
      model,
      isError = false,
      isCancelled = false
    ) => {
      // Retrieve rerun stats *before* saving history
      const savedStats = rerunStatsRef.current;
      const retrievedPreTruncationCost = savedStats?.preTruncationCost || 0;
      const retrievedPreTruncationOutput = savedStats?.preTruncationOutput || 0;

      try {
        let finalOutputTokensForMessage = 0; // Default to 0
        let finalContent = finalContentInput || ''; // Use mutable variable for content
        let finalThinkingContent = finalThinkingContentInput || ''; // Use mutable variable

        if (isCancelled) {
            // Calculate tokens based on content *before* adding notice
            const regularTokens = TokenManagementService.estimateTokens(finalContent);
            const thinkingTokens = TokenManagementService.estimateTokens(finalThinkingContent);
            finalOutputTokensForMessage = regularTokens + thinkingTokens;
            // Append notice for display (only to regular content)
            finalContent += '\n\n_Stream cancelled by user._';
            // Keep finalThinkingContent as is
        } else if (isError) {
            // Errors don't count towards output tokens
            finalOutputTokensForMessage = 0;
            finalThinkingContent = ''; // Clear thinking content on error
            // finalContent is already the error message passed in finalContentInput
        } else {
            // Normal completion: Calculate combined tokens
            const regularTokens = TokenManagementService.estimateTokens(finalContent);
            const thinkingTokens = TokenManagementService.estimateTokens(finalThinkingContent);
            finalOutputTokensForMessage = regularTokens + thinkingTokens;
            // finalContent and finalThinkingContent are already the complete content passed in
        }

        // Update message with final content (using the potentially modified finalContent)
        let updatedMessages = messages.map((msg) => {
          if (msg.id === messageId) {
            return {
              ...msg,
              content: finalContent, // Use the potentially modified regular content
              thinkingContent: finalThinkingContent, // Set the final thinking content
              isStreaming: false,
              model: model || selectedModel,
              platformIconUrl: msg.platformIconUrl,
              platformId: msg.platformId,
              timestamp: new Date().toISOString(),
              outputTokens: finalOutputTokensForMessage, // Use the correctly calculated token count
              role: isError ? MESSAGE_ROLES.SYSTEM : msg.role, // Keep error role handling
            };
          }
          return msg;
        });

        // If content not added yet, add extracted content message
        if (!extractedContentAdded && !isError) {
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

                // Add extracted content at beginning
                updatedMessages = [contentMessage, ...updatedMessages];

                // Mark as added to prevent duplicate additions
                setExtractedContentAdded(true);
              }
            }
          } catch (extractError) {
            logger.sidepanel.error(
              'Error adding extracted content:',
              extractError
            );
          }
        }

        // Set messages with all updates at once
        setMessages(updatedMessages);
        batchedStreamingContentRef.current = ''; // Clear buffer on completion
        batchedThinkingContentRef.current = ''; // Clear thinking buffer on completion

        // Save history, passing the retrieved initial stats
        if (tabId) {
          const messageBeingUpdated = updatedMessages.find(msg => msg.id === messageId);
          const correctModelConfigForHistory = messageBeingUpdated?.requestModelConfigSnapshot || modelConfigData;
          await ChatHistoryService.saveHistory(
            tabId,
            updatedMessages,
            correctModelConfigForHistory,
            {
              initialAccumulatedCost: retrievedPreTruncationCost,
              initialOutputTokens: retrievedPreTruncationOutput,
            },
            isThinkingModeEnabled
          );
        }
      } catch (error) {
        logger.sidepanel.error('Error handling stream completion:', error);
      } finally {
        // Clear the ref after saving history, regardless of success or error
        rerunStatsRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      messages,
      selectedModel,
      extractedContentAdded,
      tabId,
      modelConfigData,
      rerunStatsRef,
      batchedStreamingContentRef,
      setMessages,
      setExtractedContentAdded,
      ChatHistoryService,
      TokenManagementService,
    ] // Ensure all dependencies used inside are listed
  );

  // --- Effect for Handling Stream Chunks ---
  useEffect(() => {
    /**
     * Processes incoming message chunks from the background script during an active stream.
     * Handles error chunks, completion chunks (including cancellation), and intermediate content chunks.
     * Updates the UI live and calls `handleStreamComplete` to finalize the message state.
     * Resets streaming-related state variables upon stream completion, error, or cancellation.
     *
     * @param {object} message - The message object received from `chrome.runtime.onMessage`.
     */
    const handleStreamChunk = async (message) => {
      if (message.action === 'streamChunk' && streamingMessageId) {
        const { chunkData } = message;

        if (!chunkData) {
          logger.sidepanel.error('Invalid chunk data received:', message);
          return;
        }

        if (chunkData.error) {
          const errorMessage = chunkData.error;
          logger.sidepanel.error('Stream error:', errorMessage);
          await handleStreamComplete(
            streamingMessageId,
            errorMessage,
            '', // No thinking content on error
            chunkData.model || null,
            true // isError
          );
          setStreamingMessageId(null);
          setIsCanceling(false);
          return;
        }

        if (chunkData.done) {
          // --- Stream Done Handling ---
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }

          let finalContent = chunkData.fullContent || batchedStreamingContentRef.current;
          // Ensure we capture the final thinking content from the buffer before clearing
          let finalThinkingContent = batchedThinkingContentRef.current;

          if (chunkData.cancelled === true) {
            logger.sidepanel.info(
              `Stream ${message.streamId} received cancellation signal.`
            );
            await handleStreamComplete(
              streamingMessageId,
              finalContent, // Pass regular content
              finalThinkingContent, // Pass thinking content
              chunkData.model,
              false, // isError
              true // isCancelled
            );
          } else if (chunkData.error) {
            const errorMessage = chunkData.error;
            logger.sidepanel.error(
              `Stream ${message.streamId} error:`,
              errorMessage
            );
            await handleStreamComplete(
              streamingMessageId,
              errorMessage, // Pass error message as regular content
              '', // No thinking content on error
              chunkData.model || null,
              true, // isError
              false // isCancelled
            );
          } else {
            // Normal completion
            await handleStreamComplete(
              streamingMessageId,
              finalContent, // Pass regular content
              finalThinkingContent, // Pass thinking content
              chunkData.model,
              false, // isError
              false // isCancelled
            );
          }
          setStreamingMessageId(null);
          setIsCanceling(false);
          // Clear both buffers on completion/error/cancel
          batchedStreamingContentRef.current = '';
          batchedThinkingContentRef.current = '';

        } else if (chunkData.thinkingChunk) {
          // --- Handle Thinking Chunk ---
          batchedThinkingContentRef.current += chunkData.thinkingChunk;
          // Use a separate state update function for thinking content
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(
              performThinkingStreamingStateUpdate // Call the new function
            );
          }
        } else if (chunkData.chunk) {
          // --- Handle Regular Content Chunk ---
          const chunkContent = typeof chunkData.chunk === 'string'
            ? chunkData.chunk
            : chunkData.chunk
              ? JSON.stringify(chunkData.chunk)
              : '';
          batchedStreamingContentRef.current += chunkContent;
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(
              performStreamingStateUpdate // Call the existing function
            );
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleStreamChunk);

    return () => {
      chrome.runtime.onMessage.removeListener(handleStreamChunk);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [
    streamingMessageId,
    handleStreamComplete,
    setStreamingMessageId,
    setIsCanceling,
    batchedStreamingContentRef,
    rafIdRef,
    performStreamingStateUpdate,
    performThinkingStreamingStateUpdate,
  ]); // Dependencies for the listener effect

  // --- Stream Cancellation Logic ---
  const cancelStream = useCallback(async () => {
    if (!streamingMessageId || !isProcessing || isCanceling) return;

    const { [STORAGE_KEYS.API_STREAM_ID]: streamId } =
      await chrome.storage.local.get(STORAGE_KEYS.API_STREAM_ID);
    setIsCanceling(true);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    try {
      batchedThinkingContentRef.current = ''; // Clear thinking buffer on cancel
      await robustSendMessage({
        action: 'cancelStream',
        streamId: streamId,
      });
    } catch (error) {
      logger.sidepanel.error('Error cancelling stream:', error);
      setStreamingMessageId(null);
    } finally {
      setIsCanceling(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    streamingMessageId,
    isProcessing,
    isCanceling,
    setIsCanceling,
    rafIdRef,
    batchedThinkingContentRef,
    messages, // Need current messages for update
    extractedContentAdded, // Need flag state
    tabId,
    modelConfigData,
    setMessages,
    setExtractedContentAdded,
    setStreamingMessageId,
    ChatHistoryService,
    TokenManagementService,
    robustSendMessage,
  ]); // Dependencies for cancelStream

  // --- Effect for Escape Key Cancellation ---
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (event.key === 'Escape' && isProcessing && !isCanceling) {
        cancelStream();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isProcessing, isCanceling, cancelStream]); // Dependencies for Escape listener

  // Return the functions managed by this hook
  return { cancelStream };
}

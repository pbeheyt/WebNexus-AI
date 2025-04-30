// src/sidebar/hooks/useChatStreaming.js
import { useEffect, useCallback } from 'react';

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
  messages, // Receive messages state
  modelConfigData,
  selectedModel,
  // selectedPlatform, // Not directly used in moved logic, but handleStreamComplete uses platformIconUrl from message
  // tokenStats, // Not directly used in moved logic, but handleStreamComplete calls services that might use it implicitly
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
  extractedContentAdded, // Receive extractedContentAdded state
}) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingMessageId, batchedStreamingContentRef, rafIdRef, setMessages]); // Dependencies: relevant state/refs/setters

  // --- Stream Completion Handler ---
  const handleStreamComplete = useCallback(
    async (
      messageId,
      finalContentInput,
      model,
      isError = false,
      isCancelled = false
    ) => {
      logger.sidebar.debug('[TokenDebug] handleStreamComplete: Received args:', { messageId, finalContentInput, model, isError, isCancelled });
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
          logger.sidebar.debug('[TokenDebug] handleStreamComplete: finalContent *after* cancel append (isCancelled=true):', finalContent);
        }

        // Update message with final content (using the potentially modified finalContent)
        let updatedMessages = messages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content: finalContent,
                isStreaming: false, // Explicitly mark as not streaming
                model: model || selectedModel,
                platformIconUrl: msg.platformIconUrl, // Keep existing icon URL
                outputTokens,
                // If this is an error, change the role to system
                role: isError ? MESSAGE_ROLES.SYSTEM : msg.role,
              }
            : msg
        );

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
            logger.sidebar.error(
              'Error adding extracted content:',
              extractError
            );
          }
        }

        // Set messages with all updates at once
        logger.sidebar.debug('[TokenDebug] handleStreamComplete: updatedMessages array before setMessages:', updatedMessages);
        setMessages(updatedMessages);
        batchedStreamingContentRef.current = ''; // Clear buffer on completion

        // Save history, passing the retrieved initial stats
        if (tabId) {
          logger.sidebar.debug('[TokenDebug] handleStreamComplete: Calling ChatHistoryService.saveHistory with:', { tabId, updatedMessages, modelConfigData, options: { initialAccumulatedCost: retrievedPreTruncationCost, initialOutputTokens: retrievedPreTruncationOutput } });
          await ChatHistoryService.saveHistory(
            tabId,
            updatedMessages,
            modelConfigData,
            {
              initialAccumulatedCost: retrievedPreTruncationCost,
              initialOutputTokens: retrievedPreTruncationOutput,
            }
          );
        }
      } catch (error) {
        logger.sidebar.error('Error handling stream completion:', error);
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
          logger.sidebar.error('Invalid chunk data received:', message);
          return;
        }

        if (chunkData.error) {
          const errorMessage = chunkData.error;
          logger.sidebar.error('Stream error:', errorMessage);
          await handleStreamComplete(
            streamingMessageId,
            errorMessage,
            chunkData.model || null,
            true
          );
          setStreamingMessageId(null);
          setIsCanceling(false);
          return;
        }

        const chunkContent =
          typeof chunkData.chunk === 'string'
            ? chunkData.chunk
            : chunkData.chunk
              ? JSON.stringify(chunkData.chunk)
              : '';

        if (chunkData.done) {
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }

          if (chunkData.cancelled === true) {
            logger.sidebar.info(
              `Stream ${message.streamId} received cancellation signal.`
            );
            const finalContent =
              chunkData.fullContent || batchedStreamingContentRef.current;
            await handleStreamComplete(
              streamingMessageId,
              finalContent,
              chunkData.model,
              false,
              true
            );
          } else if (chunkData.error) {
            const errorMessage = chunkData.error;
            logger.sidebar.error(
              `Stream ${message.streamId} error:`,
              errorMessage
            );
            await handleStreamComplete(
              streamingMessageId,
              errorMessage,
              chunkData.model || null,
              true,
              false
            );
          } else {
            const finalContent =
              chunkData.fullContent || batchedStreamingContentRef.current;
            await handleStreamComplete(
              streamingMessageId,
              finalContent,
              chunkData.model,
              false,
              false
            );
          }
          setStreamingMessageId(null);
          setIsCanceling(false);
        } else if (chunkContent) {
          batchedStreamingContentRef.current += chunkContent;
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(
              performStreamingStateUpdate
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
  ]); // Dependencies for the listener effect

  // --- Stream Cancellation Logic ---
  const cancelStream = useCallback(async () => {
    if (!streamingMessageId || !isProcessing || isCanceling) return;

    const { [STORAGE_KEYS.STREAM_ID]: streamId } =
      await chrome.storage.local.get(STORAGE_KEYS.STREAM_ID);
    logger.sidebar.debug('[TokenDebug] cancelStream: Initial batched content before cancel append:', batchedStreamingContentRef.current);
    logger.sidebar.debug('[TokenDebug] cancelStream: Messages state *before* cancel append:', messages);
    setIsCanceling(true);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    try {
      await robustSendMessage({
        action: 'cancelStream',
        streamId: streamId,
      });

      const cancelledContent =
        batchedStreamingContentRef.current + '\n\n_Stream cancelled by user._';
      logger.sidebar.debug('[TokenDebug] cancelStream: Content *after* cancel append:', cancelledContent);
      const outputTokens =
        TokenManagementService.estimateTokens(cancelledContent);

      let messagesAfterCancel = messages; // Start with current messages

      if (!extractedContentAdded) {
        try {
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

              const cancelledMsgIndex = messages.findIndex(
                (msg) => msg.id === streamingMessageId
              );

              if (cancelledMsgIndex !== -1) {
                const messagesWithContent = [
                  ...messages.slice(0, cancelledMsgIndex),
                  contentMessage,
                  ...messages.slice(cancelledMsgIndex),
                ];
                messagesAfterCancel = messagesWithContent;
                setMessages(messagesAfterCancel);
                setExtractedContentAdded(true);
              } else {
                logger.sidebar.warn(
                  'Cancelled message not found, cannot insert extracted content correctly.'
                );
              }
            }
          }
        } catch (extractError) {
          logger.sidebar.error(
            'Error adding extracted content during cancellation:',
            extractError
          );
        }
      }

      const finalMessages = messagesAfterCancel.map((msg) =>
        msg.id === streamingMessageId
          ? {
              ...msg,
              content: cancelledContent,
              isStreaming: false,
              outputTokens,
            }
          : msg
      );

      logger.sidebar.debug('[TokenDebug] cancelStream: finalMessages array before setMessages:', finalMessages);
      setMessages(finalMessages);

      if (tabId) {
        logger.sidebar.debug('[TokenDebug] cancelStream: Calling ChatHistoryService.saveHistory with:', { tabId, finalMessages, modelConfigData });
        await ChatHistoryService.saveHistory(
          tabId,
          finalMessages,
          modelConfigData
        );
      }

      setStreamingMessageId(null);
      batchedStreamingContentRef.current = '';
    } catch (error) {
      logger.sidebar.error('Error cancelling stream:', error);
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
    batchedStreamingContentRef,
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

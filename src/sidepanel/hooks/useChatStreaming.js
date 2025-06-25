// src/sidepanel/hooks/useChatStreaming.js ---
import { useEffect, useCallback, useRef } from 'react';

import { logger } from '../../shared/logger';
import { MESSAGE_ROLES, STORAGE_KEYS } from '../../shared/constants';

/**
 * Custom hook to manage chat streaming logic, including receiving chunks,
 * updating UI, handling completion/errors/cancellation, and managing cancellation requests.
 *
 * @param {object} args - Dependencies passed from the parent context.
 * @param {number} [args.tabId] - The current tab ID (optional, for logging or specific tab interactions).
 * @param {string} args.chatSessionId - The current chat session ID.
 * @param {function} args.setMessages - State setter for the messages array.
 * @param {Array} args.messages - Current messages array (read-only).
 * @param {object} args.modelConfigData - Configuration for the selected model.
 * @param {string} args.selectedModel - ID of the selected model.
 * @param {object} args.selectedPlatform - Details of the selected platform.
 * @param {object} args.tokenStats - Current token statistics (read-only).
 * @param {React.MutableRefObject} args.rerunStatsRef - Ref holding stats before a rerun/edit.
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
 * @param {boolean} [args.isThinkingModeEnabled=false] - Whether thinking mode is active.
 * @returns {object} - Object containing the cancelStream function.
 */
export function useChatStreaming({
  chatSessionId,
  setMessages,
  modelConfigData,
  selectedModel,
  rerunStatsRef,
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
  isThinkingModeEnabled = false,
  showErrorNotification,
}) {
  const batchedThinkingContentRef = useRef('');
  const performThinkingStreamingStateUpdate = useCallback(() => {
    rafIdRef.current = null;
    const messageId = streamingMessageId;
    const accumulatedThinkingContent = batchedThinkingContentRef.current;

    if (!messageId) return;

    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              thinkingContent: accumulatedThinkingContent,
              isStreaming: true,
            }
          : msg
      )
    );
  }, [streamingMessageId, batchedThinkingContentRef, rafIdRef, setMessages]);

  const performStreamingStateUpdate = useCallback(() => {
    rafIdRef.current = null;
    const messageId = streamingMessageId;
    const accumulatedContent = batchedStreamingContentRef.current;

    if (!messageId) return;

    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              content: accumulatedContent,
              isStreaming: true,
            }
          : msg
      )
    );
  }, [streamingMessageId, batchedStreamingContentRef, rafIdRef, setMessages]);

  const handleStreamComplete = useCallback(
    async (
      messageId,
      finalContentInput,
      finalThinkingContentInput,
      model,
      isError = false,
      isCancelled = false
    ) => {
      const savedStats = rerunStatsRef.current;
      const retrievedPreTruncationCost = savedStats?.preTruncationCost || 0;
      const retrievedPreTruncationOutput = savedStats?.preTruncationOutput || 0;

      try {
        // Use functional update for setMessages
        setMessages((prevMessages) => {
          // Find the assistant message and the preceding user message
          const assistantMessageIndex = prevMessages.findIndex(
            (msg) => msg.id === messageId
          );
          let systemPromptForThisTurn = null;
          if (assistantMessageIndex > 0) {
            const userMessageForThisTurn =
              prevMessages[assistantMessageIndex - 1];
            if (
              userMessageForThisTurn &&
              userMessageForThisTurn.role === MESSAGE_ROLES.USER
            ) {
              systemPromptForThisTurn =
                userMessageForThisTurn.systemPromptUsedForThisTurn || null;
            }
          }

          let finalOutputTokensForMessage = 0;
          let finalContent = finalContentInput || '';
          let finalThinkingContent = finalThinkingContentInput || '';

          if (isCancelled) {
            const regularTokens =
              TokenManagementService.estimateTokens(finalContent);
            const thinkingTokens =
              TokenManagementService.estimateTokens(finalThinkingContent);
            finalOutputTokensForMessage = regularTokens + thinkingTokens;
            finalContent += '\n\n_Stream cancelled by user._';
          } else if (isError) {
            finalOutputTokensForMessage = 0;
            finalThinkingContent = ''; // Clear thinking content on error
          } else {
            const regularTokens =
              TokenManagementService.estimateTokens(finalContent);
            const thinkingTokens =
              TokenManagementService.estimateTokens(finalThinkingContent);
            finalOutputTokensForMessage = regularTokens + thinkingTokens;
          }

          let updatedMessagesArray = prevMessages.map((msg) => {
            if (msg.id === messageId) {
              return {
                ...msg,
                content: finalContent,
                thinkingContent: finalThinkingContent,
                isStreaming: false,
                modelId: model || selectedModel, // Use model from chunkData if available
                platformId: msg.platformId,
                timestamp: new Date().toISOString(),
                outputTokens: finalOutputTokensForMessage,
                role: isError ? MESSAGE_ROLES.SYSTEM : msg.role, // Change role on error
                // apiCost will be calculated and added below
              };
            }
            return msg; // Return other messages unchanged (this preserves pageContextUsed on user messages)
          });

          // --- API Cost Calculation and History Saving ---
          if (chatSessionId) {
            // Use chatSessionId here
            const finalUpdatedMessagesForStateAndHistory =
              updatedMessagesArray.map((msg) => {
                if (msg.id === messageId && !isError) {
                  // Only try to add cost if not an error
                  let tempApiCost = null;
                  let costBreakdown = null;

                  if (modelConfigData && modelConfigData.pricing) {
                    const tempTurnStats =
                      TokenManagementService.calculateTokenStatisticsFromMessages(
                        updatedMessagesArray.slice(
                          0,
                          updatedMessagesArray.findIndex(
                            (m) => m.id === messageId
                          ) + 1
                        ),
                        null
                      );

                    const costInfo = TokenManagementService.calculateCost(
                      tempTurnStats.inputTokensInLastApiCall,
                      finalOutputTokensForMessage,
                      modelConfigData,
                      isThinkingModeEnabled
                    );

                    tempApiCost = costInfo.totalCost;
                    costBreakdown = {
                      inputTokens: tempTurnStats.inputTokensInLastApiCall,
                      outputTokens: finalOutputTokensForMessage,
                      inputTokenPrice: costInfo.inputTokenPrice,
                      outputTokenPrice: costInfo.outputTokenPrice,
                    };
                  }
                  return { ...msg, apiCost: tempApiCost, costBreakdown };
                }
                return msg;
              });

            ChatHistoryService.saveHistory(
              chatSessionId, // Use chatSessionId here
              finalUpdatedMessagesForStateAndHistory,
              modelConfigData, // Use modelConfigData from the hook's closure
              {
                initialAccumulatedCost: retrievedPreTruncationCost,
                initialOutputTokens: retrievedPreTruncationOutput,
              },
              isThinkingModeEnabled,
              systemPromptForThisTurn
            ).catch((err) => {
              const lastError = chrome.runtime.lastError;
              if (lastError?.message?.includes('QUOTA_BYTES')) {
                showErrorNotification(
                  'Local storage limit reached. Could not save chat history.'
                );
              } else {
                logger.sidepanel.error(
                  'Error saving history in functional update:',
                  err
                );
                showErrorNotification(
                  'An error occurred while saving chat history.'
                );
              }
            });

            return finalUpdatedMessagesForStateAndHistory; // Return the array with cost (if calculated)
          }
          return updatedMessagesArray; // Fallback if no tabId
        });

        batchedStreamingContentRef.current = '';
        batchedThinkingContentRef.current = '';
      } catch (error) {
        logger.sidepanel.error('Error handling stream completion:', error);
        // Ensure state is cleaned up even on error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  isStreaming: false,
                  role: MESSAGE_ROLES.SYSTEM,
                  content: m.content || 'Error during completion.',
                }
              : m
          )
        );
      } finally {
        rerunStatsRef.current = null;
      }
    },
    [
      selectedModel,
      chatSessionId, // Use chatSessionId here
      modelConfigData,
      rerunStatsRef,
      batchedStreamingContentRef,
      batchedThinkingContentRef,
      setMessages,
      ChatHistoryService,
      TokenManagementService,
      isThinkingModeEnabled,
      showErrorNotification,
      // tabId is implicitly included if it's part of the dependencies for other reasons,
      // but the core logic here now depends on chatSessionId for history.
    ]
  );

  useEffect(() => {
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
            '',
            chunkData.model || null,
            true
          );
          setStreamingMessageId(null);
          setIsCanceling(false);
          return;
        }

        if (chunkData.done) {
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }

          let finalContent =
            chunkData.fullContent || batchedStreamingContentRef.current;
          let finalThinkingContent = batchedThinkingContentRef.current;

          if (chunkData.cancelled === true) {
            logger.sidepanel.info(
              `Stream ${message.streamId} received cancellation signal.`
            );
            await handleStreamComplete(
              streamingMessageId,
              finalContent,
              finalThinkingContent,
              chunkData.model,
              false,
              true
            );
          } else if (chunkData.error) {
            const errorMessage = chunkData.error;
            logger.sidepanel.error(
              `Stream ${message.streamId} error:`,
              errorMessage
            );
            await handleStreamComplete(
              streamingMessageId,
              errorMessage,
              '',
              chunkData.model || null,
              true,
              false
            );
          } else {
            await handleStreamComplete(
              streamingMessageId,
              finalContent,
              finalThinkingContent,
              chunkData.model,
              false,
              false
            );
          }
          setStreamingMessageId(null);
          setIsCanceling(false);
          batchedStreamingContentRef.current = '';
          batchedThinkingContentRef.current = '';
        } else if (chunkData.thinkingChunk) {
          batchedThinkingContentRef.current += chunkData.thinkingChunk;
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(
              performThinkingStreamingStateUpdate
            );
          }
        } else if (chunkData.chunk) {
          const chunkContent =
            typeof chunkData.chunk === 'string'
              ? chunkData.chunk
              : chunkData.chunk
                ? JSON.stringify(chunkData.chunk)
                : '';
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
    batchedThinkingContentRef,
    rafIdRef,
    performStreamingStateUpdate,
    performThinkingStreamingStateUpdate,
  ]);

  const cancelStream = useCallback(async () => {
    if (!streamingMessageId || !isProcessing || isCanceling) return;

    const { [STORAGE_KEYS.API_STREAM_ID]: streamIdFromStorage } =
      await chrome.storage.local.get(STORAGE_KEYS.API_STREAM_ID);
    setIsCanceling(true);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    try {
      batchedThinkingContentRef.current = '';
      await robustSendMessage({
        action: 'cancelStream',
        streamId: streamIdFromStorage,
      });
    } catch (error) {
      logger.sidepanel.error('Error cancelling stream:', error);
      setStreamingMessageId(null); // Should be handled by stream completion, fallback
    } finally {
      setIsCanceling(false); // Should be handled by stream completion, fallback
    }
  }, [
    streamingMessageId,
    isProcessing,
    isCanceling,
    setIsCanceling,
    rafIdRef,
    batchedThinkingContentRef,
    robustSendMessage,
    setStreamingMessageId,
  ]);

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
  }, [isProcessing, isCanceling, cancelStream]);

  return { cancelStream };
}

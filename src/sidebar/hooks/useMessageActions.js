// src/sidebar/hooks/useMessageActions.js
import { useCallback } from 'react';

import { logger } from '../../shared/logger';
import { MESSAGE_ROLES, INTERFACE_SOURCES } from '../../shared/constants';

/**
 * Custom hook to manage message actions like rerun, edit & rerun.
 *
 * @param {object} args - Dependencies passed from the parent context.
 * @param {number} args.tabId - The current tab ID.
 * @param {function} args.setMessages - State setter for the messages array.
 * @param {Array} args.messages - Current messages array (read-only).
 * @param {string} args.selectedPlatformId - ID of the selected platform.
 * @param {string} args.selectedModel - ID of the selected model.
 * @param {object} args.selectedPlatform - Details of the selected platform.
 * @param {boolean} args.isProcessing - Flag indicating if an API call is in progress.
 * @param {function} args.processContentViaApi - Function to call the API.
 * @param {object} args.tokenStats - Current token statistics (read-only).
 * @param {React.MutableRefObject} args.rerunStatsRef - Ref holding stats before a rerun/edit.
 * @param {function} args.setStreamingMessageId - State setter for streaming message ID.
 * @param {React.MutableRefObject} args.batchedStreamingContentRef - Ref for buffering stream chunks.
 * @param {function} args.resetContentProcessing - Function to reset API processing state.
 * @param {object} args.modelConfigData - Configuration for the selected model.
 * @param {object} args.ChatHistoryService - Service for chat history management.
 * @param {object} args.TokenManagementService - Service for token management.
 * @returns {object} - Object containing action functions: { rerunMessage, editAndRerunMessage, rerunAssistantMessage }.
 */
export function useMessageActions({
  tabId,
  setMessages,
  messages,
  selectedPlatformId,
  selectedModel,
  selectedPlatform,
  isProcessing,
  processContentViaApi,
  tokenStats,
  rerunStatsRef,
  setStreamingMessageId,
  batchedStreamingContentRef,
  resetContentProcessing,
  modelConfigData,
  ChatHistoryService,
  TokenManagementService,
}) {
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

      const preTruncationCost = tokenStats.accumulatedCost || 0;
      const preTruncationOutput = tokenStats.outputTokens || 0;
      rerunStatsRef.current = { preTruncationCost, preTruncationOutput };

      const truncatedMessages = messages.slice(0, index + 1);
      setMessages(truncatedMessages);

      const userMessageToRerun =
        truncatedMessages[truncatedMessages.length - 1];
      const promptContent = userMessageToRerun.content;
      const conversationHistory = truncatedMessages
        .slice(0, -1)
        .filter(
          (msg) =>
            (msg.role === MESSAGE_ROLES.USER ||
              msg.role === MESSAGE_ROLES.ASSISTANT) &&
            !msg.isStreaming
        )
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }));

      const assistantMessageId = `msg_${Date.now() + 1}`;
      const assistantMessage = {
        id: assistantMessageId,
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

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessageId(assistantMessageId);
      batchedStreamingContentRef.current = '';

      try {
        const result = await processContentViaApi({
          platformId: selectedPlatformId,
          modelId: selectedModel,
          promptContent,
          conversationHistory,
          streaming: true,
          isContentExtractionEnabled: false,
          options: {
            tabId,
            source: INTERFACE_SOURCES.SIDEBAR,
            preTruncationCost,
            preTruncationOutput,
          },
        });

        if (!result || !result.success) {
          throw new Error(
            result?.error || 'Failed to initialize streaming for rerun'
          );
        }
      } catch (error) {
        logger.sidebar.error('Error processing rerun message:', error);

        const isPortClosedError = error.isPortClosed;
        const systemErrorMessageContent = isPortClosedError
          ? '[System: The connection was interrupted during rerun. Please try again.]'
          : `Error: ${error.message || 'Failed to process rerun request'}`;

        const errorMessages = truncatedMessages;
        const systemErrorMessage = {
          id: assistantMessageId,
          role: MESSAGE_ROLES.SYSTEM,
          content: systemErrorMessageContent,
          timestamp: new Date().toISOString(),
          isStreaming: false,
        };
        setMessages([...errorMessages, systemErrorMessage]);
        setStreamingMessageId(null);

        if (tabId) {
          const savedStats = rerunStatsRef.current;
          const historyOptions = savedStats
            ? {
                initialAccumulatedCost: savedStats.preTruncationCost || 0,
                initialOutputTokens: savedStats.preTruncationOutput || 0,
              }
            : {};
          await ChatHistoryService.saveHistory(
            tabId,
            [...errorMessages, systemErrorMessage],
            modelConfigData,
            historyOptions
          );
        }
        rerunStatsRef.current = null;
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
      rerunStatsRef,
      batchedStreamingContentRef,
      ChatHistoryService,
    ] // Dependencies
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

      const preTruncationCost = tokenStats.accumulatedCost || 0;
      const preTruncationOutput = tokenStats.outputTokens || 0;
      rerunStatsRef.current = { preTruncationCost, preTruncationOutput };

      let truncatedMessages = messages.slice(0, index + 1);
      const editedMessageIndex = truncatedMessages.length - 1;
      const originalMessage = truncatedMessages[editedMessageIndex];
      const updatedMessage = {
        ...originalMessage,
        content: newContent.trim(),
        inputTokens: TokenManagementService.estimateTokens(newContent.trim()),
      };
      truncatedMessages[editedMessageIndex] = updatedMessage;

      setMessages(truncatedMessages);

      const promptContent = updatedMessage.content;
      const conversationHistory = truncatedMessages
        .slice(0, -1)
        .filter(
          (msg) =>
            (msg.role === MESSAGE_ROLES.USER ||
              msg.role === MESSAGE_ROLES.ASSISTANT) &&
            !msg.isStreaming
        )
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }));

      const assistantMessageId = `msg_${Date.now() + 1}`;
      const assistantMessage = {
        id: assistantMessageId,
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

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessageId(assistantMessageId);
      batchedStreamingContentRef.current = '';

      try {
        const result = await processContentViaApi({
          platformId: selectedPlatformId,
          modelId: selectedModel,
          promptContent,
          conversationHistory,
          streaming: true,
          isContentExtractionEnabled: false,
          options: {
            tabId,
            source: INTERFACE_SOURCES.SIDEBAR,
            preTruncationCost,
            preTruncationOutput,
          },
        });

        if (!result || !result.success) {
          throw new Error(
            result?.error || 'Failed to initialize streaming for edit/rerun'
          );
        }
      } catch (error) {
        logger.sidebar.error('Error processing edit/rerun message:', error);

        const isPortClosedError = error.isPortClosed;
        const systemErrorMessageContent = isPortClosedError
          ? '[System: The connection was interrupted during edit/rerun. Please try again.]'
          : `Error: ${error.message || 'Failed to process edit/rerun request'}`;

        const errorMessages = truncatedMessages;
        const systemErrorMessage = {
          id: assistantMessageId,
          role: MESSAGE_ROLES.SYSTEM,
          content: systemErrorMessageContent,
          timestamp: new Date().toISOString(),
          isStreaming: false,
        };
        setMessages([...errorMessages, systemErrorMessage]);
        setStreamingMessageId(null);

        if (tabId) {
          const savedStats = rerunStatsRef.current;
          const historyOptions = savedStats
            ? {
                initialAccumulatedCost: savedStats.preTruncationCost || 0,
                initialOutputTokens: savedStats.preTruncationOutput || 0,
              }
            : {};
          await ChatHistoryService.saveHistory(
            tabId,
            [...errorMessages, systemErrorMessage],
            modelConfigData,
            historyOptions
          );
        }
        rerunStatsRef.current = null;
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
      rerunStatsRef,
      batchedStreamingContentRef,
      ChatHistoryService,
      TokenManagementService,
    ] // Dependencies
  );

  const rerunAssistantMessage = useCallback(
    async (assistantMessageId) => {
      if (!tabId || !selectedPlatformId || !selectedModel || isProcessing)
        return;

      const assistantIndex = messages.findIndex(
        (msg) => msg.id === assistantMessageId
      );
      const userIndex = assistantIndex - 1;

      if (
        assistantIndex <= 0 ||
        userIndex < 0 ||
        messages[userIndex].role !== MESSAGE_ROLES.USER
      ) {
        logger.sidebar.error(
          'Cannot rerun assistant message: Invalid message structure or preceding user message not found.',
          { assistantIndex, userIndex }
        );
        return;
      }

      const preTruncationCost = tokenStats.accumulatedCost || 0;
      const preTruncationOutput = tokenStats.outputTokens || 0;
      rerunStatsRef.current = { preTruncationCost, preTruncationOutput };

      const truncatedMessages = messages.slice(0, userIndex + 1);
      setMessages(truncatedMessages);

      const promptContent = truncatedMessages[userIndex].content;
      const conversationHistory = truncatedMessages
        .slice(0, userIndex)
        .filter(
          (msg) =>
            (msg.role === MESSAGE_ROLES.USER ||
              msg.role === MESSAGE_ROLES.ASSISTANT) &&
            !msg.isStreaming
        )
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }));

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

      setMessages((prev) => [...prev, assistantPlaceholder]);
      setStreamingMessageId(assistantPlaceholderId);
      batchedStreamingContentRef.current = '';

      try {
        const result = await processContentViaApi({
          platformId: selectedPlatformId,
          modelId: selectedModel,
          promptContent,
          conversationHistory,
          streaming: true,
          isContentExtractionEnabled: false,
          options: {
            tabId,
            source: INTERFACE_SOURCES.SIDEBAR,
            preTruncationCost,
            preTruncationOutput,
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

        const isPortClosedError = error.isPortClosed;
        const systemErrorMessageContent = isPortClosedError
          ? '[System: The connection was interrupted during assistant rerun. Please try again.]'
          : `Error: ${error.message || 'Failed to process assistant rerun request'}`;

        const errorMessages = truncatedMessages;
        const systemErrorMessage = {
          id: assistantPlaceholderId,
          role: MESSAGE_ROLES.SYSTEM,
          content: systemErrorMessageContent,
          timestamp: new Date().toISOString(),
          isStreaming: false,
        };
        setMessages([...errorMessages, systemErrorMessage]);
        setStreamingMessageId(null);

        if (tabId) {
          const savedStats = rerunStatsRef.current;
          const historyOptions = savedStats
            ? {
                initialAccumulatedCost: savedStats.preTruncationCost || 0,
                initialOutputTokens: savedStats.preTruncationOutput || 0,
              }
            : {};
          await ChatHistoryService.saveHistory(
            tabId,
            [...errorMessages, systemErrorMessage],
            modelConfigData,
            historyOptions
          );
        }
        rerunStatsRef.current = null;
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
      rerunStatsRef,
      batchedStreamingContentRef,
      ChatHistoryService,
    ] // Dependencies
  );

  return { rerunMessage, editAndRerunMessage, rerunAssistantMessage };
}
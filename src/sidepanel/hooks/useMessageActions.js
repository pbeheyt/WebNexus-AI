// src/sidepanel/hooks/useMessageActions.js

import { useCallback } from 'react';

import { logger } from '../../shared/logger';
import { MESSAGE_ROLES, INTERFACE_SOURCES } from '../../shared/constants';
import { useContent } from '../../contexts/ContentContext';
import { isInjectablePage } from '../../shared/utils/content-utils';

/**
 * Internal helper function to initiate the API call sequence for reruns/edits.
 * Encapsulates common logic like creating placeholders and calling the API initiator.
 *
 * @param {object} args - Arguments object.
 * @param {string} args.promptContent - The content of the user prompt.
 * @param {Array} args.conversationHistory - The history to send to the API.
 * @param {Array} args.truncatedMessages - The messages array after truncation (and potential edit).
 * @param {string} args.assistantPlaceholderId - The ID for the new assistant message.
 * @param {function} args._initiateApiCall - The helper function from context to call the API.
 * @param {function} args.setMessages - State setter for messages.
 * @param {function} args.setStreamingMessageId - State setter for streaming ID.
 * @param {React.MutableRefObject} args.batchedStreamingContentRef - Ref for stream buffer.
 * @param {string} args.selectedModel - Current selected model ID.
 * @param {object} args.selectedPlatform - Current selected platform details.
 * @param {string} args.selectedPlatformId - Current selected platform ID.
 * @param {number} args.tabId - Current tab ID.
 * @param {object} args.rerunStatsRef - Ref containing pre-truncation stats.
 * @param {function} args.processContentViaApi - API processing function.
 * @param {function} args.resetContentProcessing - Function to reset API state.
 * @param {object} args.modelConfigData - Current model configuration.
 * @param {object} args.ChatHistoryService - Chat history service.
 */
const _initiateRerunSequence = async ({
  promptContent,
  conversationHistory,
  truncatedMessages,
  assistantPlaceholderId,
  _initiateApiCall,
  setMessages,
  setStreamingMessageId,
  batchedStreamingContentRef,
  selectedModel,
  selectedPlatformId,
  tabId,
  currentTab,
  rerunStatsRef,
  isContentExtractionEnabled,
  isThinkingModeEnabled,
  processContentViaApi,
  resetContentProcessing,
  modelConfigData,
  ChatHistoryService,
}) => {
  const assistantPlaceholder = {
    id: assistantPlaceholderId,
    role: MESSAGE_ROLES.ASSISTANT,
    content: '',
    thinkingContent: '',
    platformId: selectedPlatformId, // This is correct, from function args
    modelId: selectedModel, // This is the modelId, from function args
    timestamp: new Date().toISOString(),
    isStreaming: true,
    inputTokens: 0,
    outputTokens: 0,
    apiCost: null, // Initialize apiCost to null
  };

  // Add placeholder *after* potential edit in editAndRerunMessage
  setMessages([...truncatedMessages, assistantPlaceholder]);
  setStreamingMessageId(assistantPlaceholderId);
  batchedStreamingContentRef.current = '';

  // --- Determine effective content extraction state ---
  const isPageInjectable = currentTab?.url
    ? isInjectablePage(currentTab.url)
    : false;
  // 'isContentExtractionEnabled' below refers to the parameter passed to _initiateRerunSequence (the toggle state)
  const effectiveContentExtractionEnabled = isPageInjectable
    ? isContentExtractionEnabled
    : false;
  logger.sidepanel.info(
    `[_initiateRerunSequence] Page injectable: ${isPageInjectable}, Toggle state: ${isContentExtractionEnabled}, Effective: ${effectiveContentExtractionEnabled}`
  );

  // Use the passed-in _initiateApiCall helper
  await _initiateApiCall({
    platformId: selectedPlatformId,
    modelId: selectedModel,
    promptContent,
    conversationHistory,
    streaming: true,
    isContentExtractionEnabled: effectiveContentExtractionEnabled,
    isThinkingModeEnabled: isThinkingModeEnabled,
    options: {
      tabId,
      source: INTERFACE_SOURCES.SIDEPANEL,
      ...(rerunStatsRef.current && {
        preTruncationCost: rerunStatsRef.current.preTruncationCost,
        preTruncationOutput: rerunStatsRef.current.preTruncationOutput,
      }),
    },
    // Pass dependencies needed by _initiateApiCall
    processContentViaApi,
    setMessages,
    setStreamingMessageId,
    resetContentProcessing,
    ChatHistoryService,
    modelConfigData,
    tabId,
    assistantMessageIdOnError: assistantPlaceholderId,
    messagesOnError: truncatedMessages,
    rerunStatsRef,
  });
};

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
 * @param {function} args._initiateApiCall - Helper function from context to initiate API calls.
 * @returns {object} - Object containing action functions: { rerunMessage, editAndRerunMessage, rerunAssistantMessage }.
 */
export function useMessageActions({
  tabId,
  setMessages,
  messages,
  selectedPlatformId,
  selectedModel,
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
  _initiateApiCall,
  isContentExtractionEnabled,
  isThinkingModeEnabled,
}) {
  const { currentTab } = useContent();
  const rerunMessage = useCallback(
    async (messageId) => {
      // --- Guards ---
      if (!tabId || !selectedPlatformId || !selectedModel || isProcessing)
        return;
      const index = messages.findIndex((msg) => msg.id === messageId);
      if (index === -1 || messages[index].role !== MESSAGE_ROLES.USER) {
        logger.sidepanel.error(
          'Cannot rerun: Message not found or not a user message.'
        );
        return;
      }

      // --- Setup ---
      rerunStatsRef.current = {
        preTruncationCost: tokenStats.accumulatedCost || 0,
        preTruncationOutput: tokenStats.outputTokens || 0,
      };
      const truncatedMessages = messages.slice(0, index + 1);
      const promptContent = truncatedMessages[index].content;
      const conversationHistory = truncatedMessages
        .slice(0, index)
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

      // --- Delegate to Helper ---
      await _initiateRerunSequence({
        promptContent,
        conversationHistory,
        truncatedMessages,
        assistantPlaceholderId,
        _initiateApiCall,
        setMessages,
        setStreamingMessageId,
        batchedStreamingContentRef,
        selectedModel,
        selectedPlatformId,
        tabId,
        currentTab: currentTab,
        rerunStatsRef,
        isContentExtractionEnabled,
        isThinkingModeEnabled,
        processContentViaApi,
        resetContentProcessing,
        modelConfigData,
        ChatHistoryService,
      });
    },
    [
      messages,
      tokenStats,
      setMessages,
      selectedPlatformId,
      selectedModel,
      setStreamingMessageId,
      tabId,
      isProcessing,
      resetContentProcessing,
      modelConfigData,
      rerunStatsRef,
      batchedStreamingContentRef,
      ChatHistoryService,
      _initiateApiCall,
      processContentViaApi,
      isContentExtractionEnabled,
      isThinkingModeEnabled,
      currentTab,
    ]
  );

  const editAndRerunMessage = useCallback(
    async (messageId, newContent) => {
      // --- Guards ---
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
        logger.sidepanel.error(
          'Cannot edit/rerun: Message not found or not a user message.'
        );
        return;
      }

      // --- Setup ---
      rerunStatsRef.current = {
        preTruncationCost: tokenStats.accumulatedCost || 0,
        preTruncationOutput: tokenStats.outputTokens || 0,
      };
      const truncatedMessages = messages.slice(0, index + 1);
      const editedMessageIndex = truncatedMessages.length - 1;
      const updatedMessage = {
        ...truncatedMessages[editedMessageIndex],
        content: newContent.trim(),
        inputTokens: TokenManagementService.estimateTokens(newContent.trim()),
      };
      truncatedMessages[editedMessageIndex] = updatedMessage;

      // --- Update State Immediately for Edit ---
      setMessages(truncatedMessages); // Reflect edit before API call

      // --- Prepare for Helper ---
      const promptContent = updatedMessage.content;
      const conversationHistory = truncatedMessages
        .slice(0, editedMessageIndex) // Use index before edit
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

      // --- Delegate to Helper ---
      await _initiateRerunSequence({
        promptContent,
        conversationHistory,
        truncatedMessages, // Pass the already updated messages
        assistantPlaceholderId,
        _initiateApiCall,
        setMessages,
        setStreamingMessageId,
        batchedStreamingContentRef,
        selectedModel,
        selectedPlatformId,
        tabId,
        currentTab: currentTab,
        rerunStatsRef,
        isContentExtractionEnabled,
        isThinkingModeEnabled,
        processContentViaApi,
        resetContentProcessing,
        modelConfigData,
        ChatHistoryService,
      });
    },
    [
      messages,
      tokenStats,
      setMessages,
      selectedPlatformId,
      selectedModel,
      setStreamingMessageId,
      tabId,
      isProcessing,
      resetContentProcessing,
      modelConfigData,
      rerunStatsRef,
      batchedStreamingContentRef,
      ChatHistoryService,
      TokenManagementService,
      _initiateApiCall,
      processContentViaApi,
      isContentExtractionEnabled,
      isThinkingModeEnabled,
      currentTab,
    ]
  );

  const rerunAssistantMessage = useCallback(
    async (assistantMessageId) => {
      // --- Guards ---
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
        logger.sidepanel.error(
          'Cannot rerun assistant message: Invalid message structure or preceding user message not found.',
          { assistantIndex, userIndex }
        );
        return;
      }

      // --- Setup ---
      rerunStatsRef.current = {
        preTruncationCost: tokenStats.accumulatedCost || 0,
        preTruncationOutput: tokenStats.outputTokens || 0,
      };
      const truncatedMessages = messages.slice(0, userIndex + 1);
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

      // --- Delegate to Helper ---
      await _initiateRerunSequence({
        promptContent,
        conversationHistory,
        truncatedMessages,
        assistantPlaceholderId,
        _initiateApiCall,
        setMessages,
        setStreamingMessageId,
        batchedStreamingContentRef,
        selectedModel,
        selectedPlatformId,
        tabId,
        rerunStatsRef,
        isContentExtractionEnabled,
        isThinkingModeEnabled,
        processContentViaApi,
        resetContentProcessing,
        modelConfigData,
        ChatHistoryService,
      });
    },
    [
      tabId,
      selectedPlatformId,
      selectedModel,
      isProcessing,
      messages,
      tokenStats,
      setMessages,
      setStreamingMessageId,
      resetContentProcessing,
      modelConfigData,
      rerunStatsRef,
      batchedStreamingContentRef,
      ChatHistoryService,
      _initiateApiCall,
      processContentViaApi,
      isContentExtractionEnabled,
      isThinkingModeEnabled,
    ]
  );

  return { rerunMessage, editAndRerunMessage, rerunAssistantMessage };
}

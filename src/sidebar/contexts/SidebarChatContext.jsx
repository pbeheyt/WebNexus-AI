// src/sidebar/contexts/SidebarChatContext.jsx

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
import { useChatStreaming } from '../hooks/useChatStreaming';
import { useMessageActions } from '../hooks/useMessageActions';
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

  // Refs remain in the context as they are shared between hooks/context logic
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
  const selectedPlatform = useMemo(
    () => platforms.find((p) => p.id === selectedPlatformId) || {},
    [platforms, selectedPlatformId]
  );

  // --- Internal Helper: Initiate API Call ---
  // This function is defined here and passed down via context value
  const _initiateApiCall = useCallback(
    async ({
      platformId,
      modelId,
      promptContent,
      conversationHistory,
      streaming,
      isContentExtractionEnabled,
      options,
      // Dependencies needed for error handling and state updates
      assistantMessageIdOnError,
      messagesOnError, // State *before* placeholder was added
      rerunStatsRef: localRerunStatsRef, // Use passed ref
    }) => {
      try {
        const result = await processContentViaApi({
          platformId,
          modelId,
          promptContent,
          conversationHistory,
          streaming,
          isContentExtractionEnabled,
          options,
        });

        if (result && result.skippedContext === true) {
          logger.sidebar.info(
            'Context extraction skipped by background:',
            result.reason
          );
          const systemMessage = {
            id: `sys_${Date.now()}`,
            role: MESSAGE_ROLES.SYSTEM,
            content: `Note: ${result.reason || 'Page content could not be included.'}`,
            timestamp: new Date().toISOString(),
          };
          // Update messages: Use messagesOnError which is the state before the placeholder
          const finalMessages = [...messagesOnError, systemMessage];
          setMessages(finalMessages);
          if (options.tabId) {
            await ChatHistoryService.saveHistory(
              options.tabId,
              finalMessages,
              modelConfigData
            );
          }
          setStreamingMessageId(null); // No stream started
          resetContentProcessing(); // Reset API state
          return false; // Indicate stream did not start
        }

        if (!result || !result.success) {
          const errorMsg = result?.error || 'Failed to initialize streaming';
          throw new Error(errorMsg); // Throw to be caught by catch block
        }

        return true; // Indicate stream started successfully
      } catch (error) {
        logger.sidebar.error('Error initiating API call:', error);
        const isPortClosedError = error.isPortClosed;
        const systemErrorMessageContent = isPortClosedError
          ? '[System: The connection was interrupted. Please try sending your message again.]'
          : `Error: ${error.message || 'Failed to process request'}`;

        // Use messagesOnError (state before placeholder) + new system error message
        const systemErrorMessage = {
          id: assistantMessageIdOnError, // Use the placeholder ID for the error message
          role: MESSAGE_ROLES.SYSTEM,
          content: systemErrorMessageContent,
          timestamp: new Date().toISOString(),
          isStreaming: false,
        };
        const finalErrorMessages = [...messagesOnError, systemErrorMessage];
        setMessages(finalErrorMessages);

        if (options.tabId) {
          // Handle potential rerun stats cleanup on error
          const savedStats = localRerunStatsRef?.current;
          const historyOptions = savedStats
            ? {
                initialAccumulatedCost: savedStats.preTruncationCost || 0,
                initialOutputTokens: savedStats.preTruncationOutput || 0,
              }
            : {};
          await ChatHistoryService.saveHistory(
            options.tabId,
            finalErrorMessages,
            modelConfigData,
            historyOptions
          );
        }
        if (localRerunStatsRef) localRerunStatsRef.current = null; // Clear ref on error
        setStreamingMessageId(null);
        resetContentProcessing();
        return false; // Indicate stream did not start
      }
    },
    [
      processContentViaApi,
      setMessages,
      setStreamingMessageId,
      resetContentProcessing,
      modelConfigData,
    ] // Dependencies for _initiateApiCall
  );
  // --- End Internal Helper ---

  // --- Instantiate Hooks (Pass _initiateApiCall) ---
  const { cancelStream } = useChatStreaming({
    tabId,
    setMessages,
    messages,
    modelConfigData,
    selectedModel,
    selectedPlatform,
    tokenStats,
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
  });

  const { rerunMessage, editAndRerunMessage, rerunAssistantMessage } =
    useMessageActions({
      tabId,
      setMessages,
      messages,
      selectedPlatformId,
      selectedModel,
      selectedPlatform,
      isProcessing,
      processContentViaApi, // Pass down for _initiateApiCall
      tokenStats,
      rerunStatsRef,
      setStreamingMessageId,
      batchedStreamingContentRef,
      resetContentProcessing, // Pass down for _initiateApiCall
      modelConfigData, // Pass down for _initiateApiCall
      ChatHistoryService, // Pass down for _initiateApiCall
      TokenManagementService,
      _initiateApiCall, // Pass the helper function
    });
  // --- End Hook Instantiation ---

  // Load full platform configuration when platform or model changes
  useEffect(() => {
    const loadFullConfig = async () => {
      if (!selectedPlatformId || !selectedModel || !tabId) return;

      try {
        const config = await getPlatformApiConfig(selectedPlatformId);
        if (!config || !config.models) {
          logger.sidebar.warn(
            'Platform API configuration missing required structure:',
            {
              platformId: selectedPlatformId,
              hasModels: !!config?.models,
            }
          );
          setModelConfigData(null);
          return;
        }
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
        const history = await ChatHistoryService.getHistory(tabId);
        setMessages(history);
        if (history.length > 0 && modelConfigData) {
          await calculateStats(history, modelConfigData);
        }
        // Check if extracted content message exists
        const hasExtracted = history.some((msg) => msg.isExtractedContent);
        setExtractedContentAdded(hasExtracted);
      } catch (error) {
        logger.sidebar.error('Error loading tab chat history:', error);
      }
    };
    loadChatHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]); // Keep modelConfigData dependency out to avoid reload on model change

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

  // --- Send Message Logic (Uses _initiateApiCall) ---
  const sendMessage = async (text = inputValue) => {
    const currentPlatformId = selectedPlatformId;
    const currentModelId = selectedModel;
    const currentHasCreds = hasAnyPlatformCredentials;

    // --- Initial Validation ---
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
      return;
    }
    if (!text.trim() || isProcessing || !tabId) return;

    // --- Prepare Messages and State ---
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

    const messagesBeforeApiCall = [...messages, userMessage]; // State before placeholder
    const messagesWithPlaceholder = [...messagesBeforeApiCall, assistantMessage];

    setMessages(messagesWithPlaceholder); // Update UI with user message and placeholder
    setInputValue('');
    setStreamingMessageId(assistantMessageId); // Set streaming ID here
    batchedStreamingContentRef.current = '';

    // Store pre-send stats (relevant if this becomes a rerun later)
    rerunStatsRef.current = {
      preTruncationCost: tokenStats.accumulatedCost || 0,
      preTruncationOutput: tokenStats.outputTokens || 0,
    };

    const isPageInjectable = currentTab?.url
      ? isInjectablePage(currentTab.url)
      : false;
    const effectiveContentExtractionEnabled = isPageInjectable
      ? isContentExtractionEnabled
      : false;

    const conversationHistory = messages // Use messages state *before* adding new user/assistant msg
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

    // --- Delegate API Call Initiation ---
    await _initiateApiCall({
      platformId: currentPlatformId,
      modelId: currentModelId,
      promptContent: text.trim(),
      conversationHistory,
      streaming: true,
      isContentExtractionEnabled: effectiveContentExtractionEnabled,
      options: {
        tabId,
        source: INTERFACE_SOURCES.SIDEBAR,
        ...(rerunStatsRef.current && {
          preTruncationCost: rerunStatsRef.current.preTruncationCost,
          preTruncationOutput: rerunStatsRef.current.preTruncationOutput,
        }),
      },
      // Pass necessary info for error handling within _initiateApiCall
      assistantMessageIdOnError: assistantMessageId,
      messagesOnError: messagesBeforeApiCall, // Pass state before placeholder
      rerunStatsRef: rerunStatsRef, // Pass the ref itself
    });
    // No further try/catch needed here, _initiateApiCall handles it
  };
  // --- End Send Message Logic ---

  // --- Utility Functions (Remain in Context) ---
  const clearChat = async () => {
    if (!tabId) return;
    setMessages([]);
    setExtractedContentAdded(false); // Reset flag
    await ChatHistoryService.clearHistory(tabId);
    await clearTokenData(); // Clear associated tokens
  };

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
      const result = await chrome.storage.local.get(
        STORAGE_KEYS.TAB_FORMATTED_CONTENT
      );
      const allFormattedContent =
        result[STORAGE_KEYS.TAB_FORMATTED_CONTENT] || {};
      if (Object.hasOwn(allFormattedContent, tabIdKey)) {
        const updatedFormattedContent = { ...allFormattedContent };
        delete updatedFormattedContent[tabIdKey];
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
      // Only reset the flag, don't clear messages here
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
        if (streamingMessageId && isProcessing && !isCanceling) {
          logger.sidebar.info(
            'Refresh requested: Cancelling ongoing stream first...'
          );
          await cancelStream(); // Call cancelStream from the hook
          logger.sidebar.info('Stream cancellation attempted.');
        }
        // Clear history and tokens via service first
        await ChatHistoryService.clearHistory(tabId); // Clears tokens too
        // Then clear any remaining formatted content specifically
        await clearFormattedContentForTab();

        // Reset local state
        setMessages([]);
        setInputValue('');
        setStreamingMessageId(null);
        setExtractedContentAdded(false);
        setIsCanceling(false);
        await clearTokenData(); // Ensure token state is reset too

        // Optionally notify background if other state needs clearing there
        // const response = await robustSendMessage({ action: 'clearTabData', tabId: tabId });
        // Handle response if needed

        logger.sidebar.info(`Successfully reset data for tab ${tabId}`);
      } catch (error) {
        logger.sidebar.error('Failed to reset tab data:', error);
        // Attempt to reset local state even on error
        setMessages([]);
        setInputValue('');
        setStreamingMessageId(null);
        setExtractedContentAdded(false);
        setIsCanceling(false); // Ensure canceling state is reset
        await clearTokenData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tabId,
    clearTokenData,
    setMessages,
    setInputValue,
    setStreamingMessageId,
    setExtractedContentAdded,
    setIsCanceling,
    streamingMessageId,
    isProcessing,
    isCanceling,
    cancelStream, // Add cancelStream from hook as dependency
    clearFormattedContentForTab, // Add new dependency
  ]);

  // --- End Utility Functions ---

  return (
    <SidebarChatContext.Provider
      value={{
        // State
        messages: visibleMessages,
        allMessages: messages,
        inputValue,
        contextStatus,
        extractedContentAdded,
        isContentExtractionEnabled,
        modelConfigData,
        isProcessing,
        isCanceling,
        apiError: processingError,
        contentType,
        tokenStats,

        // Setters / Actions
        setInputValue,
        setIsContentExtractionEnabled,
        sendMessage,
        cancelStream,
        clearChat,
        resetCurrentTabData,
        clearFormattedContentForTab,
        rerunMessage,
        editAndRerunMessage,
        rerunAssistantMessage,
        // No need to expose _initiateApiCall directly to consumers
      }}
    >
      {children}
    </SidebarChatContext.Provider>
  );
}

export const useSidebarChat = () => useContext(SidebarChatContext);

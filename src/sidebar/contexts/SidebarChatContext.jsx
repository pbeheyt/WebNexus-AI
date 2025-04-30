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
import { useChatStreaming } from '../hooks/useChatStreaming'; // Import new hook
import { useMessageActions } from '../hooks/useMessageActions'; // Import new hook
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

  // --- Instantiate New Hooks ---
  const { cancelStream } = useChatStreaming({
    tabId,
    setMessages,
    messages, // Pass messages state
    modelConfigData,
    selectedModel,
    selectedPlatform, // Pass platform details
    tokenStats, // Pass token stats
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
    extractedContentAdded, // Pass extracted content flag
  });

  const { rerunMessage, editAndRerunMessage, rerunAssistantMessage } =
    useMessageActions({
      tabId,
      setMessages,
      messages, // Pass messages state
      selectedPlatformId,
      selectedModel,
      selectedPlatform, // Pass platform details
      isProcessing,
      processContentViaApi,
      tokenStats, // Pass token stats
      rerunStatsRef,
      setStreamingMessageId,
      batchedStreamingContentRef,
      resetContentProcessing,
      modelConfigData,
      ChatHistoryService,
      TokenManagementService,
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
        setExtractedContentAdded(history.length > 0);
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

  // --- Send Message Logic (Remains in Context) ---
  const sendMessage = async (text = inputValue) => {
    const currentPlatformId = selectedPlatformId;
    const currentModelId = selectedModel;
    const currentHasCreds = hasAnyPlatformCredentials;

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

    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setStreamingMessageId(assistantMessageId); // Set streaming ID here
    batchedStreamingContentRef.current = '';

    const currentAccumulatedCost = tokenStats.accumulatedCost || 0;
    const currentOutputTokens = tokenStats.outputTokens || 0;
    rerunStatsRef.current = {
      preTruncationCost: currentAccumulatedCost,
      preTruncationOutput: currentOutputTokens,
    };

    const isPageInjectable = currentTab?.url
      ? isInjectablePage(currentTab.url)
      : false;
    const effectiveContentExtractionEnabled = isPageInjectable
      ? isContentExtractionEnabled
      : false;

    try {
      const conversationHistory = messages
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

      const result = await processContentViaApi({
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
        const finalMessages = messages.concat(userMessage, systemMessage);
        setMessages(finalMessages);
        if (tabId) {
          await ChatHistoryService.saveHistory(
            tabId,
            finalMessages,
            modelConfigData
          );
        }
        setStreamingMessageId(null);
        resetContentProcessing();
        return;
      }

      if (!result || !result.success) {
        const errorMsg = result?.error || 'Failed to initialize streaming';
        throw new Error(errorMsg);
      }
    } catch (error) {
      logger.sidebar.error('Error processing streaming message:', error);
      const isPortClosedError = error.isPortClosed;
      const systemErrorMessageContent = isPortClosedError
        ? '[System: The connection was interrupted. Please try sending your message again.]'
        : `Error: ${error.message || 'Failed to process request'}`;

      const errorMessages = messages
        .map((msg) => (msg.id === userMessageId ? msg : null))
        .filter(Boolean);
      const systemErrorMessage = {
        id: assistantMessageId,
        role: MESSAGE_ROLES.SYSTEM,
        content: systemErrorMessageContent,
        timestamp: new Date().toISOString(),
        isStreaming: false,
      };
      const finalErrorMessages = [...errorMessages, systemErrorMessage];
      setMessages(finalErrorMessages);
      if (tabId) {
        await ChatHistoryService.saveHistory(
          tabId,
          finalErrorMessages,
          modelConfigData
        );
      }
      setStreamingMessageId(null);
      resetContentProcessing();
    }
  };
  // --- End Send Message Logic ---

  // --- Utility Functions (Remain in Context) ---
  const clearChat = async () => {
    if (!tabId) return;
    setMessages([]);
    setExtractedContentAdded(false);
    await ChatHistoryService.clearHistory(tabId);
    await clearTokenData();
  };

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
        const response = await robustSendMessage({
          action: 'clearTabData',
          tabId: tabId,
        });
        if (response && response.success) {
          setMessages([]);
          setInputValue('');
          setStreamingMessageId(null);
          setExtractedContentAdded(false);
          setIsCanceling(false);
          await clearTokenData();
        } else {
          throw new Error(
            response?.error || 'Background script failed to clear data.'
          );
        }
      } catch (error) {
        logger.sidebar.error('Failed to reset tab data:', error);
        setIsCanceling(false);
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
  ]);

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
  // --- End Utility Functions ---

  return (
    <SidebarChatContext.Provider
      value={{
        // State
        messages: visibleMessages, // Use alias for filtered messages
        allMessages: messages, // Provide raw messages if needed elsewhere
        inputValue,
        contextStatus,
        extractedContentAdded,
        isContentExtractionEnabled,
        modelConfigData,
        isProcessing, // From useContentProcessing
        isCanceling, // Local state
        apiError: processingError, // From useContentProcessing
        contentType, // From useContent
        tokenStats, // From useTokenTracking

        // Setters / Actions
        setInputValue,
        setIsContentExtractionEnabled,
        sendMessage, // Local function
        cancelStream, // From useChatStreaming hook
        clearChat, // Local function
        resetCurrentTabData, // Local function
        clearFormattedContentForTab, // Local function
        rerunMessage, // From useMessageActions hook
        editAndRerunMessage, // From useMessageActions hook
        rerunAssistantMessage, // From useMessageActions hook
      }}
    >
      {children}
    </SidebarChatContext.Provider>
  );
}

export const useSidebarChat = () => useContext(SidebarChatContext);
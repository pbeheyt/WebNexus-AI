// src/sidepanel/contexts/SidepanelChatContext.jsx

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
import { useSidePanelPlatform } from '../../contexts/platform';
import { useContent } from '../../contexts/ContentContext';
import { useTokenTracking } from '../hooks/useTokenTracking';
import { useChatStreaming } from '../hooks/useChatStreaming';
import { useMessageActions } from '../hooks/useMessageActions';
import { useChatSessionManagement } from '../hooks/useChatSessionManagement';
import ChatHistoryService from '../services/ChatHistoryService';
import TokenManagementService from '../services/TokenManagementService';
import { useNotification } from '../../components';
import { useContentProcessing } from '../../hooks/useContentProcessing';
import { MESSAGE_ROLES } from '../../shared/constants';
import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants';
import { isInjectablePage } from '../../shared/utils/content-utils';
import { robustSendMessage } from '../../shared/utils/message-utils';

const SidePanelChatContext = createContext(null);

SidePanelChatProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function SidePanelChatProvider({ children }) {
  const {
    selectedPlatformId,
    selectedModel,
    hasAnyPlatformCredentials,
    tabId,
    platforms,
    getPlatformApiConfig,
    selectPlatform,
    selectModel,
    isLoading: isPlatformLoading, // Get loading state from platform context
  } = useSidePanelPlatform();

  const { contentType, currentTab } = useContent();
  const [inputValue, setInputValue] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [stableContextStatus, setStableContextStatus] = useState({
    warningLevel: 'none',
  });
  const [isCanceling, setIsCanceling] = useState(false);
  const [isContentExtractionEnabled, setIsContentExtractionEnabled] =
    useState(true);
  const [modelConfigData, setModelConfigData] = useState(null);
  const [stableModelConfigData, setStableModelConfigData] = useState(null);
  const [stableTokenStats, setStableTokenStats] = useState(
    TokenManagementService._getEmptyStats()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isThinkingModeEnabled, setIsThinkingModeEnabled] = useState(false);

  // --- Core Hooks ---
  // FIX: Call useChatSessionManagement first to define currentChatSessionId
  const [contextViewData, setContextViewData] = useState(null);
  const {
    messages,
    setMessages,
    currentChatSessionId,
    currentView,
    createNewChat,
    selectChatSession,
    deleteSelectedChatSession,
    switchToView,
  } = useChatSessionManagement({
    tabId,
    selectedPlatformId,
    selectedModel,
    selectPlatform,
    selectModel,
    isPlatformLoading,
  });

  const { success: showSuccessNotification, error: showErrorNotification } = useNotification();

  // FIX: Now call useTokenTracking with the defined currentChatSessionId
  const { tokenStats, calculateContextStatus, clearTokenData } =
    useTokenTracking(currentChatSessionId);

  const {
    processContentViaApi,
    isProcessing,
    error: processingError,
    reset: resetContentProcessing,
  } = useContentProcessing(INTERFACE_SOURCES.SIDEPANEL);

  // Refs remain in the context as they are shared between hooks/context logic
  const batchedStreamingContentRef = useRef('');
  const rafIdRef = useRef(null);
  const rerunStatsRef = useRef(null);

  // Get platform info
  const selectedPlatform = useMemo(
    () => platforms.find((p) => p.id === selectedPlatformId) || {},
    [platforms, selectedPlatformId]
  );

  // --- Internal Helper: Initiate API Call ---
  const _initiateApiCall = useCallback(
    async ({
      platformId,
      modelId,
      promptContent,
      conversationHistory,
      streaming,
      isContentExtractionEnabled: localIsContentExtractionEnabled,
      isThinkingModeEnabled: localIsThinkingModeEnabled,
      options,
      assistantMessageIdOnError,
      messagesOnError,
      rerunStatsRef: localRerunStatsRef,
    }) => {
      try {
        const result = await processContentViaApi({
          platformId,
          modelId,
          promptContent,
          conversationHistory,
          streaming,
          isContentExtractionEnabled: localIsContentExtractionEnabled,
          isThinkingModeEnabled: localIsThinkingModeEnabled,
          options,
        });

        if (result && result.contentSuccessfullyIncluded) {
          setIsContentExtractionEnabled(false);
          logger.sidepanel.info(
            'Content was successfully included in API call, toggling extraction OFF.'
          );
        }

        if (result && result.skippedContext === true) {
          logger.sidepanel.info(
            'Context extraction skipped by background:',
            result.reason
          );
          const systemMessage = {
            id: `sys_${Date.now()}`,
            role: MESSAGE_ROLES.SYSTEM,
            content: `Note: ${result.reason || 'Page content could not be included.'}`,
            timestamp: new Date().toISOString(),
          };
          const finalMessages = [...messagesOnError, systemMessage];
          setMessages(finalMessages);
          if (options.chatSessionId) {
            await ChatHistoryService.saveHistory(
              options.chatSessionId,
              finalMessages,
              modelConfigData
            );
          }
          setStreamingMessageId(null);
          resetContentProcessing();
          return {
            success: false,
            error: result.reason || 'Context extraction was skipped',
            contentSuccessfullyIncluded: false,
            extractedPageContent: null,
            systemPromptUsed: null,
          };
        }

        if (!result || !result.success) {
          const errorMsg = result?.error || 'Failed to initialize streaming';
          throw new Error(errorMsg);
        }

        return {
          success: true,
          streamId: result.streamId,
          contentSuccessfullyIncluded: result.contentSuccessfullyIncluded,
          extractedPageContent: result.extractedPageContent,
          systemPromptUsed: result.systemPromptUsed,
        };
      } catch (error) {
        logger.sidepanel.error('Error initiating API call:', error);
        const isPortClosedError = error.isPortClosed;
        const systemErrorMessageContent = isPortClosedError
          ? '[System: The connection was interrupted. Please try sending your message again.]'
          : `Error: ${error.message || 'Failed to process request'}`;

        const systemErrorMessage = {
          id: assistantMessageIdOnError,
          role: MESSAGE_ROLES.SYSTEM,
          content: systemErrorMessageContent,
          timestamp: new Date().toISOString(),
          isStreaming: false,
        };
        const finalErrorMessages = [...messagesOnError, systemErrorMessage];
        setMessages(finalErrorMessages);

        if (options.chatSessionId) {
          const savedStats = localRerunStatsRef?.current;
          const historyOptions = savedStats
            ? {
                initialAccumulatedCost: savedStats.preTruncationCost || 0,
                initialOutputTokens: savedStats.preTruncationOutput || 0,
              }
            : {};
          await ChatHistoryService.saveHistory(
            options.chatSessionId,
            finalErrorMessages,
            modelConfigData,
            historyOptions
          );
        }
        if (localRerunStatsRef) localRerunStatsRef.current = null;
        setStreamingMessageId(null);
        resetContentProcessing();
        return {
          success: false,
          error: error.message || 'Failed to process request',
          contentSuccessfullyIncluded: false,
          extractedPageContent: null,
          systemPromptUsed: null,
        };
      }
    },
    [
      processContentViaApi,
      setMessages,
      setStreamingMessageId,
      resetContentProcessing,
      modelConfigData,
      setIsContentExtractionEnabled,
    ]
  );

  // --- Instantiate Hooks (Pass _initiateApiCall) ---
  const { cancelStream } = useChatStreaming({
    chatSessionId: currentChatSessionId,
    setMessages,
    messages,
    modelConfigData,
    selectedModel,
    selectedPlatform,
    tokenStats,
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
    isThinkingModeEnabled,
  });

  const { rerunMessage, editAndRerunMessage, rerunAssistantMessage } =
    useMessageActions({
      tabId,
      chatSessionId: currentChatSessionId,
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
      _initiateApiCall,
      isContentExtractionEnabled,
      isThinkingModeEnabled,
    });

  // Load full platform configuration when platform or model changes
  useEffect(() => {
    const loadFullConfig = async () => {
      if (!selectedPlatformId || !selectedModel || !tabId) return;

      try {
        const config = await getPlatformApiConfig(selectedPlatformId);
        if (!config || !config.models) {
          logger.sidepanel.warn(
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
        setStableModelConfigData(modelData);
      } catch (error) {
        logger.sidepanel.error(
          'Failed to load or process platform API configuration:',
          error
        );
        setModelConfigData(null);
        setStableModelConfigData(null);
      }
    };
    loadFullConfig();
  }, [selectedPlatformId, selectedModel, tabId, getPlatformApiConfig]);

  // Update context status when model config or token stats change
  useEffect(() => {
    const updateContextStatus = async () => {
      if (!tabId || !modelConfigData) {
        return;
      }
      try {
        const status = await calculateContextStatus(modelConfigData);
        if (status && typeof status === 'object') {
          setStableContextStatus(status);
        }
      } catch (error) {
        logger.sidepanel.error('Error calculating context status:', error);
      }
    };
    updateContextStatus();
  }, [tabId, modelConfigData, tokenStats, calculateContextStatus]);

  // Stabilize tokenStats for UI consumers
  useEffect(() => {
    if (!isPlatformLoading) {
      setStableTokenStats(tokenStats);
    }
  }, [tokenStats, isPlatformLoading]);

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

  // Load Thinking Mode preference when dependencies change
  useEffect(() => {
    const loadPreference = async () => {
      if (!selectedPlatformId || !selectedModel || !tabId || !modelConfigData) {
        setIsThinkingModeEnabled(false);
        return;
      }

      if (modelConfigData?.thinking?.toggleable === true) {
        try {
          const result = await chrome.storage.sync.get(
            STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE
          );
          const prefs =
            result[STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE] || {};
          const modePref = prefs[selectedPlatformId]?.[selectedModel];
          setIsThinkingModeEnabled(modePref === undefined ? false : modePref);
        } catch (err) {
          logger.sidepanel.error(
            'Error loading thinking mode preference:',
            err
          );
          setIsThinkingModeEnabled(false);
        }
      } else {
        setIsThinkingModeEnabled(false);
      }
    };

    loadPreference();
  }, [selectedPlatformId, selectedModel, tabId, modelConfigData]);

  // Listen for external changes to the current chat session
  useEffect(() => {
    if (!chrome.storage?.onChanged) return;

    const handleStorageChange = async (changes, areaName) => {
      if (
        areaName !== 'local' ||
        !changes[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] ||
        !currentChatSessionId
      ) {
        return;
      }

      const newValue = changes[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS].newValue;
      const currentSessionNewData = newValue
        ? newValue[currentChatSessionId]
        : null;

      if (currentSessionNewData) {
        const newMessages = currentSessionNewData.messages || [];
        if (JSON.stringify(newMessages) !== JSON.stringify(messages)) {
          logger.sidepanel.info(
            `Session ${currentChatSessionId} updated in storage. Reloading messages.`
          );
          setMessages(newMessages);
        }
      } else {
        logger.sidepanel.info(
          `Session ${currentChatSessionId} was deleted from storage. Clearing local messages.`
        );
        setMessages([]);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [currentChatSessionId, messages, setMessages]);

  // --- Send Message Logic ---
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
      thinkingContent: '',
      platformId: currentPlatformId,
      modelId: currentModelId,
      timestamp: new Date().toISOString(),
      isStreaming: true,
      inputTokens: 0,
      outputTokens: 0,
      apiCost: null,
    };

    const messagesBeforeApiCall = [...messages, userMessage];
    const messagesWithPlaceholder = [
      ...messagesBeforeApiCall,
      assistantMessage,
    ];

    setMessages(messagesWithPlaceholder);
    setInputValue('');
    setStreamingMessageId(assistantMessageId);
    batchedStreamingContentRef.current = '';

    rerunStatsRef.current = {
      preTruncationCost: tokenStats.accumulatedCost || 0,
      preTruncationOutput: tokenStats.outputTokens || 0,
    };

    const localIsContentExtractionEnabled = isContentExtractionEnabled;
    const localIsThinkingModeEnabled = isThinkingModeEnabled;

    const isPageInjectable = currentTab?.url
      ? isInjectablePage(currentTab.url)
      : false;
    const effectiveContentExtractionEnabled = isPageInjectable
      ? localIsContentExtractionEnabled
      : false;

    const conversationHistory = messages
      .filter(
        (msg) =>
          (msg.role === MESSAGE_ROLES.USER ||
            msg.role === MESSAGE_ROLES.ASSISTANT) &&
          !msg.isStreaming
      )
      .map((msg) => {
        const historyItem = {
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        };
        if (msg.role === MESSAGE_ROLES.USER && msg.pageContextUsed) {
          historyItem.pageContextUsed = msg.pageContextUsed;
        }
        return historyItem;
      });

    const apiCallSetupResult = await _initiateApiCall({
      platformId: currentPlatformId,
      modelId: currentModelId,
      promptContent: text.trim(),
      conversationHistory,
      streaming: true,
      isContentExtractionEnabled: effectiveContentExtractionEnabled,
      isThinkingModeEnabled: localIsThinkingModeEnabled,
      options: {
        tabId,
        chatSessionId: currentChatSessionId,
        source: INTERFACE_SOURCES.SIDEPANEL,
        ...(rerunStatsRef.current && {
          preTruncationCost: rerunStatsRef.current.preTruncationCost,
          preTruncationOutput: rerunStatsRef.current.preTruncationOutput,
        }),
      },
      assistantMessageIdOnError: assistantMessageId,
      messagesOnError: messagesBeforeApiCall,
      rerunStatsRef: rerunStatsRef,
    });

    if (apiCallSetupResult.success) {
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === userMessageId) {
            const updatedMsg = { ...msg };
            if (
              apiCallSetupResult.contentSuccessfullyIncluded &&
              apiCallSetupResult.extractedPageContent
            ) {
              updatedMsg.pageContextUsed =
                apiCallSetupResult.extractedPageContent;
            }
            updatedMsg.systemPromptUsedForThisTurn =
              apiCallSetupResult.systemPromptUsed;
            if (apiCallSetupResult.contentSuccessfullyIncluded) {
              updatedMsg.contextTypeUsed = contentType;
            }
            return updatedMsg;
          }
          return msg;
        })
      );
    }
  };

  const resetCurrentTabData = useCallback(async () => {
    if (tabId === null) return;
    if (isRefreshing) return;

    if (
      !window.confirm(
        'Are you sure you want to start a new chat for this tab? This will DELETE the current chat session and its history.'
      )
    ) {
      return;
    }

    setIsRefreshing(true);
    logger.sidepanel.info(
      `SidePanelChatContext: resetCurrentTabData for tab ${tabId}`
    );
    try {
      const sessionToPotentiallyDelete = currentChatSessionId;
      if (streamingMessageId && isProcessing && !isCanceling) {
        await cancelStream();
      }

      if (sessionToPotentiallyDelete) {
        await ChatHistoryService.deleteChatSession(sessionToPotentiallyDelete);
      }

      await createNewChat();
    } catch (error) {
      logger.sidepanel.error(
        'Error during resetCurrentTabData (starting new chat):',
        error
      );
      setMessages([]);
      setInputValue('');
      setStreamingMessageId(null);
      setIsCanceling(false);
      if (typeof clearTokenData === 'function' && currentChatSessionId)
        await clearTokenData(currentChatSessionId);
      setIsContentExtractionEnabled(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    tabId,
    isRefreshing,
    streamingMessageId,
    isProcessing,
    isCanceling,
    createNewChat,
    cancelStream,
    clearTokenData,
    currentChatSessionId,
    setMessages,
  ]);

  const clearChat = useCallback(async () => {
    if (!currentChatSessionId) return;
    if (
      !window.confirm(
        'Are you sure you want to clear all messages from the current chat session? This action cannot be undone.'
      )
    ) {
      return;
    }
    logger.sidepanel.info(
      `SidePanelChatContext: Clearing messages for session ${currentChatSessionId}`
    );
    try {
      setMessages([]);
      await ChatHistoryService.saveHistory(
        currentChatSessionId,
        [],
        modelConfigData,
        {},
        isThinkingModeEnabled,
        null
      );
      if (typeof clearTokenData === 'function')
        await clearTokenData(currentChatSessionId);
    } catch (error) {
      logger.sidepanel.error(
        `Error clearing chat for session ${currentChatSessionId}:`,
        error
      );
      const history = await ChatHistoryService.getHistory(currentChatSessionId);
      setMessages(history);
    }
  }, [
    currentChatSessionId,
    modelConfigData,
    isThinkingModeEnabled,
    clearTokenData,
    setMessages,
  ]);

  const toggleThinkingMode = useCallback(
    async (newState) => {
      if (!selectedPlatformId || !selectedModel) return;
      setIsThinkingModeEnabled(newState);
      try {
        const result = await chrome.storage.sync.get(
          STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE
        );
        const prefs =
          result[STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE] || {};
        if (!prefs[selectedPlatformId]) {
          prefs[selectedPlatformId] = {};
        }
        prefs[selectedPlatformId][selectedModel] = newState;
        await chrome.storage.sync.set({
          [STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE]: prefs,
        });
      } catch (err) {
        logger.sidepanel.error('Error saving thinking mode preference:', err);
      }
    },
    [selectedPlatformId, selectedModel]
  );

  const switchToContextView = useCallback(
    (data) => {
      setContextViewData(data);
      switchToView('context');
    },
    [switchToView]
  );

  const deleteMultipleChatSessions = useCallback(async (sessionIdsToDelete) => {
    if (!Array.isArray(sessionIdsToDelete) || sessionIdsToDelete.length === 0) {
      return;
    }

    try {
      await ChatHistoryService.deleteMultipleChatSessions(sessionIdsToDelete);
      
      // Check if the currently active session was among those deleted
      if (currentChatSessionId && sessionIdsToDelete.includes(currentChatSessionId)) {
        logger.sidepanel.info(`Active session ${currentChatSessionId} was deleted. Creating a new one.`);
        await createNewChat(); // This will handle the transition gracefully
      }
      
      showSuccessNotification(`${sessionIdsToDelete.length} chat(s) deleted successfully.`);

    } catch (error) {
      logger.sidepanel.error('Error in context deleteMultipleChatSessions:', error);
      showErrorNotification('Failed to delete chats. Please try again.');
    }
  }, [currentChatSessionId, createNewChat, showSuccessNotification, showErrorNotification]);

  return (
    <SidePanelChatContext.Provider
      value={{
        messages: visibleMessages,
        currentChatSessionId,
        currentView,
        contextViewData,
        inputValue,
        contextStatus: stableContextStatus,
        isContentExtractionEnabled,
        modelConfigData: stableModelConfigData,
        isProcessing,
        isCanceling,
        isRefreshing,
        apiError: processingError,
        contentType,
        tokenStats: stableTokenStats,
        isThinkingModeEnabled,
        toggleThinkingMode,
        setInputValue,
        setIsContentExtractionEnabled,
        sendMessage,
        cancelStream,
        clearChat,
        resetCurrentTabData,
        rerunMessage,
        editAndRerunMessage,
        rerunAssistantMessage,
        createNewChat,
        selectChatSession,
        switchToView,
        switchToContextView,
        deleteSelectedChatSession,
        deleteMultipleChatSessions,
      }}
    >
      {children}
    </SidePanelChatContext.Provider>
  );
}

export const useSidePanelChat = () => useContext(SidePanelChatContext);

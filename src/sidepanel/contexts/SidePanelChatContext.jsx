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

import SidePanelStateManager from '../../services/SidePanelStateManager.js';
import { logger } from '../../shared/logger';
import { useSidePanelPlatform } from '../../contexts/platform';
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
  } = useSidePanelPlatform();

  const { contentType, currentTab } = useContent();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [stableContextStatus, setStableContextStatus] = useState({
    warningLevel: 'none',
  });
  const [isCanceling, setIsCanceling] = useState(false);
  const [isContentExtractionEnabled, setIsContentExtractionEnabled] =
    useState(true); // Default to true (ON)
  const [modelConfigData, setModelConfigData] = useState(null);
  const [stableModelConfigData, setStableModelConfigData] = useState(null);
  const [stableTokenStats, setStableTokenStats] = useState(
    TokenManagementService._getEmptyStats()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isThinkingModeEnabled, setIsThinkingModeEnabled] = useState(false);

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
  } = useContentProcessing(INTERFACE_SOURCES.SIDEPANEL);

  // Get platform info
  const selectedPlatform = useMemo(
    () => platforms.find((p) => p.id === selectedPlatformId) || {},
    [platforms, selectedPlatformId]
  );

 useEffect(() => {
    // Using your logger for consistency, but console.log is fine too
    logger.sidepanel.debug('[DEBUG SidePanelChatContext] `messages` state updated:', JSON.parse(JSON.stringify(messages)));
    // You could also log other relevant states here if needed, e.g., streamingMessageId
  }, [messages]);

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

        // Auto-toggle content extraction OFF if it was successfully included
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
          if (options.tabId) {
            await ChatHistoryService.saveHistory(
              options.tabId,
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
            extractedPageContent: null
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
          extractedPageContent: result.extractedPageContent
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

        if (options.tabId) {
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
        if (localRerunStatsRef) localRerunStatsRef.current = null;
        setStreamingMessageId(null);
        resetContentProcessing();
        return {
          success: false,
          error: error.message || 'Failed to process request',
          contentSuccessfullyIncluded: false,
          extractedPageContent: null
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
    tabId,
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
  const { isLoading: isPlatformLoading } = useSidePanelPlatform();

  useEffect(() => {
    if (!isPlatformLoading) {
      setStableTokenStats(tokenStats);
    }
  }, [tokenStats, isPlatformLoading]);

  // Load chat history for current tab & set initial content extraction toggle state
  useEffect(() => {
    const loadChatHistoryAndSetToggle = async () => {
      if (!tabId) return;
      try {
        const history = await ChatHistoryService.getHistory(tabId);
        setMessages(history);

        // Set initial state of isContentExtractionEnabled based on history
        if (history.length === 0) {
          setIsContentExtractionEnabled(true); // ON for new chat
        } else {
          setIsContentExtractionEnabled(false); // OFF if history exists
        }

        if (history.length > 0 && modelConfigData) {
          await calculateStats(history, modelConfigData);
        }
      } catch (error) {
        logger.sidepanel.error('Error loading tab chat history:', error);
        setIsContentExtractionEnabled(true); // Default to ON on error
      }
    };
    loadChatHistoryAndSetToggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]); // modelConfigData removed to prevent toggle reset on model change

  // Get visible messages (filtering out extracted content - this might be removed if extracted content is no longer a separate message type)
  const visibleMessages = useMemo(() => {
    // If extracted content is no longer a separate message type, this can be simplified to: return messages;
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

    // Use the current state of isContentExtractionEnabled for this call
    const localIsContentExtractionEnabled = isContentExtractionEnabled;
    const localIsThinkingModeEnabled = isThinkingModeEnabled;

    const isPageInjectable = currentTab?.url
      ? isInjectablePage(currentTab.url)
      : false;
    const effectiveContentExtractionEnabled = isPageInjectable
      ? localIsContentExtractionEnabled // Use the current toggle state
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
        // Conditionally add pageContextUsed if it exists on the user message
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

    // Update userMessage in the messages array if content was successfully included
    if (apiCallSetupResult.success && apiCallSetupResult.contentSuccessfullyIncluded && apiCallSetupResult.extractedPageContent) {
      setMessages(prevMessages => prevMessages.map(msg => {
        if (msg.id === userMessageId) {
          return {
            ...msg,
            pageContextUsed: apiCallSetupResult.extractedPageContent
          };
        }
        return msg;
      }));
    }
  };

  // --- Utility Functions (Remain in Context) ---
  const clearChat = async () => {
    if (!tabId) return;
    setMessages([]);
    await ChatHistoryService.clearHistory(tabId);
    await clearTokenData();
  };

  // This function is now less relevant as content is always re-extracted if toggle is ON.
  // Keeping it for now in case it's used elsewhere, but its direct utility for sidepanel context might be diminished.
  const clearFormattedContentForTab = useCallback(async () => {
    if (tabId === null || tabId === undefined) {
      logger.sidepanel.warn(
        'clearFormattedContentForTab called without a valid tabId.'
      );
      return;
    }
    logger.sidepanel.info(
      `Requesting SidePanelStateManager to clear formatted content for tab: ${tabId}`
    );
    try {
      await SidePanelStateManager.clearFormattedContentForTab(tabId);
      logger.sidepanel.info(
        `SidePanelStateManager successfully cleared formatted content for tab: ${tabId}`
      );
    } catch (error) {
      logger.sidepanel.error(
        `Error calling SidePanelStateManager.clearFormattedContentForTab for tab ${tabId}:`,
        error
      );
    }
  }, [tabId]);

  const resetCurrentTabData = useCallback(async () => {
    if (tabId === null || tabId === undefined) {
      logger.sidepanel.warn(
        'resetCurrentTabData called without a valid tabId.'
      );
      return;
    }
    if (isRefreshing) {
      logger.sidepanel.warn('Refresh already in progress. Ignoring request.');
      return;
    }

    if (
      window.confirm(
        'Are you sure you want to clear all chat history and data for this tab? This action cannot be undone.'
      )
    ) {
      setIsRefreshing(true);
      try {
        if (streamingMessageId && isProcessing && !isCanceling) {
          logger.sidepanel.info(
            'Refresh requested: Cancelling ongoing stream first...'
          );
          await cancelStream();
          logger.sidepanel.info('Stream cancellation attempted.');
        }

        logger.sidepanel.info(
          `Requesting background to clear data for tab ${tabId}`
        );
        try {
          const clearResponse = await robustSendMessage({
            action: 'clearTabData',
            tabId: tabId,
          });
          if (clearResponse && clearResponse.success) {
            logger.sidepanel.info(
              `Background confirmed clearing data for tab ${tabId}`
            );
          } else {
            logger.sidepanel.error(
              'Background failed to confirm tab data clear:',
              clearResponse?.error
            );
          }
        } catch (sendError) {
          logger.sidepanel.error(
            'Error sending clearTabData message to background:',
            sendError
          );
        }

        logger.sidepanel.info('Resetting local sidepanel state...');
        setMessages([]);
        setInputValue('');
        setStreamingMessageId(null);
        setIsCanceling(false);
        await clearTokenData();
        setIsContentExtractionEnabled(true); // Reset toggle to ON after refresh
        logger.sidepanel.info('Local sidepanel state reset complete.');
      } catch (error) {
        logger.sidepanel.error(
          'Error during the refresh process (excluding background communication):',
          error
        );
        try {
          setMessages([]);
          setInputValue('');
          setStreamingMessageId(null);
          setIsCanceling(false);
          await clearTokenData();
          setIsContentExtractionEnabled(true); // Reset toggle to ON even on error
        } catch (resetError) {
          logger.sidepanel.error(
            'Error during fallback state reset:',
            resetError
          );
        }
      } finally {
        logger.sidepanel.info(
          'Setting isRefreshing to false in finally block.'
        );
        setIsRefreshing(false);
      }
    }
  }, [
    tabId,
    isRefreshing,
    clearTokenData,
    cancelStream,
    streamingMessageId,
    isProcessing,
    isCanceling,
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
        logger.sidepanel.info(
          `Thinking mode preference saved for ${selectedPlatformId}/${selectedModel}: ${newState}`
        );
      } catch (err) {
        logger.sidepanel.error('Error saving thinking mode preference:', err);
      }
    },
    [selectedPlatformId, selectedModel]
  );

  return (
    <SidePanelChatContext.Provider
      value={{
        messages: visibleMessages,
        allMessages: messages,
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
        clearFormattedContentForTab,
        rerunMessage,
        editAndRerunMessage,
        rerunAssistantMessage,
      }}
    >
      {children}
    </SidePanelChatContext.Provider>
  );
}

export const useSidePanelChat = () => useContext(SidePanelChatContext);

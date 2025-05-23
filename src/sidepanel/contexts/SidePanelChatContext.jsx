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
  const [stableContextStatus, setStableContextStatus] = useState({ warningLevel: 'none' });
  const [extractedContentAdded, setExtractedContentAdded] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isContentExtractionEnabled, setIsContentExtractionEnabled] =
    useState(true);
  const [modelConfigData, setModelConfigData] = useState(null);
  const [stableModelConfigData, setStableModelConfigData] = useState(null);
  const [stableTokenStats, setStableTokenStats] = useState(TokenManagementService._getEmptyStats());
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
      isThinkingModeEnabled,
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
          isThinkingModeEnabled: isThinkingModeEnabled,
          options,
        });

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
        logger.sidepanel.error('Error initiating API call:', error);
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
  // --- End Hook Instantiation ---

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
        // Don't update stableContextStatus - keep previous valid state
        return;
      }
      try {
        const status = await calculateContextStatus(modelConfigData);
        // Only update stable status if we got a valid status object
        if (status && typeof status === 'object') {
          setStableContextStatus(status);
        }
      } catch (error) {
        logger.sidepanel.error('Error calculating context status:', error);
        // Don't update stableContextStatus on error - keep previous valid state
      }
    };
    updateContextStatus();
  }, [tabId, modelConfigData, tokenStats, calculateContextStatus]);

  // Stabilize tokenStats for UI consumers
  const { isLoading: isPlatformLoading } = useSidePanelPlatform(); // Get loading state outside effect

  useEffect(() => {
    if (!isPlatformLoading) {
      setStableTokenStats(tokenStats); // Update stable stats when loading is done
    }
  }, [tokenStats, isPlatformLoading]); // Depend on internal tokenStats and isPlatformLoading

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
        logger.sidepanel.error('Error loading tab chat history:', error);
      }
    };
    loadChatHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]); // ModelConfigData dependency out to avoid reload on model change

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
      // Only proceed if platform/model/tab are selected and config data is loaded
      if (!selectedPlatformId || !selectedModel || !tabId || !modelConfigData) {
        setIsThinkingModeEnabled(false); // Default to false if dependencies aren't ready
        return;
      }

      // Check if the loaded model config allows toggling
      if (modelConfigData?.thinking?.toggleable === true) {
        try {
          const result = await chrome.storage.sync.get(STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE);
          const prefs = result[STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE] || {};
          const modePref = prefs[selectedPlatformId]?.[selectedModel];
          // Set state based on preference, default to false if undefined
          setIsThinkingModeEnabled(modePref === undefined ? false : modePref);
        } catch (err) {
          logger.sidepanel.error("Error loading thinking mode preference:", err);
          setIsThinkingModeEnabled(false); // Default to false on error
        }
      } else {
        // If not toggleable, ensure state is false
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
      thinkingContent: '',
      model: selectedModel,
      modelDisplayName: modelConfigData?.displayName || selectedModel, // <-- ADD THIS LINE, prefer displayName from modelConfigData
      platformIconUrl: selectedPlatform.iconUrl,
      platformId: selectedPlatformId,
      timestamp: new Date().toISOString(),
      isStreaming: true,
      inputTokens: 0,
      outputTokens: 0,
      requestModelId: selectedModel,
      requestModelConfigSnapshot: modelConfigData,
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
      isThinkingModeEnabled: isThinkingModeEnabled,
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
      logger.sidepanel.warn('clearFormattedContentForTab called without a valid tabId.');
      return;
    }
    logger.sidepanel.info(`Requesting SidePanelStateManager to clear formatted content for tab: ${tabId}`);
    try {
      await SidePanelStateManager.clearFormattedContentForTab(tabId);
      setExtractedContentAdded(false); // Keep this local state update
      logger.sidepanel.info(`SidePanelStateManager successfully cleared formatted content for tab: ${tabId}`);
    } catch (error) {
      logger.sidepanel.error(`Error calling SidePanelStateManager.clearFormattedContentForTab for tab ${tabId}:`, error);
    }
  }, [tabId, setExtractedContentAdded]);

  const resetCurrentTabData = useCallback(async () => {
    if (tabId === null || tabId === undefined) {
      logger.sidepanel.warn('resetCurrentTabData called without a valid tabId.');
      return;
    }
    // Prevent concurrent refreshes
    if (isRefreshing) {
        logger.sidepanel.warn('Refresh already in progress. Ignoring request.');
        return;
    }

    if (
      window.confirm(
        'Are you sure you want to clear all chat history and data for this tab? This action cannot be undone.'
      )
    ) {
      // Set refreshing state immediately
      setIsRefreshing(true);

      try {
        // 1. Cancel any ongoing stream
        if (streamingMessageId && isProcessing && !isCanceling) {
          logger.sidepanel.info(
            'Refresh requested: Cancelling ongoing stream first...'
          );
          await cancelStream(); // Wait for cancellation attempt
          logger.sidepanel.info('Stream cancellation attempted.');
        }

        // 2. Notify background to clear its data (attempt and log, but don't block local reset on failure)
        logger.sidepanel.info(`Requesting background to clear data for tab ${tabId}`);
        try {
            const clearResponse = await robustSendMessage({ action: 'clearTabData', tabId: tabId });
            if (clearResponse && clearResponse.success) {
                logger.sidepanel.info(`Background confirmed clearing data for tab ${tabId}`);
            } else {
                logger.sidepanel.error('Background failed to confirm tab data clear:', clearResponse?.error);
                // Proceed with local reset even if background fails
            }
        } catch (sendError) {
             logger.sidepanel.error('Error sending clearTabData message to background:', sendError);
             // Proceed with local reset despite background communication failure
        }

        // 3. Reset local state *after* attempting background clear
        logger.sidepanel.info('Resetting local sidepanel state...');
        setMessages([]);
        setInputValue('');
        setStreamingMessageId(null);
        setExtractedContentAdded(false);
        setIsCanceling(false); // Ensure canceling state is reset if cancellation happened
        await clearTokenData(); // Clear associated tokens and reset local token state
        logger.sidepanel.info('Local sidepanel state reset complete.');

      } catch (error) {
        // Catch errors primarily from stream cancellation or clearTokenData
        logger.sidepanel.error('Error during the refresh process (excluding background communication):', error);
        // Attempt to reset local state even on these errors
        try {
            setMessages([]);
            setInputValue('');
            setStreamingMessageId(null);
            setExtractedContentAdded(false);
            setIsCanceling(false);
            await clearTokenData();
        } catch (resetError) {
            logger.sidepanel.error('Error during fallback state reset:', resetError);
        }
      } finally {
        // 4. ALWAYS turn off refreshing state
        logger.sidepanel.info('Setting isRefreshing to false in finally block.');
        setIsRefreshing(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tabId,
    isRefreshing,
    clearTokenData,
    setMessages,
    setInputValue,
    setStreamingMessageId,
    setExtractedContentAdded,
    setIsCanceling,
    streamingMessageId,
    isProcessing,
    isCanceling,
    cancelStream,
    robustSendMessage,
  ]);

  // Toggle Thinking Mode handler
  const toggleThinkingMode = useCallback(async (newState) => {
    // Only proceed if platform/model are selected
    if (!selectedPlatformId || !selectedModel) return;

    setIsThinkingModeEnabled(newState);

    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE);
      const prefs = result[STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE] || {};

      // Ensure platform object exists
      if (!prefs[selectedPlatformId]) {
        prefs[selectedPlatformId] = {};
      }

      // Update the specific model preference
      prefs[selectedPlatformId][selectedModel] = newState;

      // Save back to storage
      await chrome.storage.sync.set({ [STORAGE_KEYS.SIDEPANEL_THINKING_MODE_PREFERENCE]: prefs });
      logger.sidepanel.info(`Thinking mode preference saved for ${selectedPlatformId}/${selectedModel}: ${newState}`);
    } catch (err) {
      logger.sidepanel.error("Error saving thinking mode preference:", err);
    }
  }, [selectedPlatformId, selectedModel]); // Dependencies for the handler

  // --- End Utility Functions ---

  return (
    <SidePanelChatContext.Provider
      value={{
        // State
        messages: visibleMessages,
        allMessages: messages,
        inputValue,
        contextStatus: stableContextStatus,
        extractedContentAdded,
        isContentExtractionEnabled,
        modelConfigData: stableModelConfigData,
        isProcessing,
        isCanceling,
        isRefreshing,
        apiError: processingError,
        contentType,
        tokenStats: stableTokenStats,
        isThinkingModeEnabled,

        // Setters / Actions
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

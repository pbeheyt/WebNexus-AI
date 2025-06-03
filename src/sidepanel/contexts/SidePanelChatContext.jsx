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
  const [currentChatSessionId, setCurrentChatSessionId] = useState(null);
  const [currentView, setCurrentView] = useState('chat'); // 'chat' or 'history'

  // Refs remain in the context as they are shared between hooks/context logic
  const batchedStreamingContentRef = useRef('');
  const rafIdRef = useRef(null);
  const rerunStatsRef = useRef(null);
  const isInitializingSessionRef = useRef(false);

  // Use the token tracking hook
  const { tokenStats, calculateContextStatus, clearTokenData } =
    useTokenTracking(currentChatSessionId);

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
            systemPromptUsed: null
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
          systemPromptUsed: result.systemPromptUsed
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
          systemPromptUsed: null
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
      tabId, // Kept for context extraction, core logic shifts to chatSessionId
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
  const { isLoading: isPlatformLoading } = useSidePanelPlatform();

  useEffect(() => {
    if (!isPlatformLoading) {
      setStableTokenStats(tokenStats);
    }
  }, [tokenStats, isPlatformLoading]);

  // Comprehensive Initialization Logic
  useEffect(() => {
    const initializeContext = async () => {
      if (isInitializingSessionRef.current) {
        logger.sidepanel.debug('SidePanelChatContext: Initialization already in progress, skipping.');
        return;
      }
      isInitializingSessionRef.current = true;

      if (!tabId || !selectedPlatformId) { // selectedModel might not be ready immediately
        // Don't clear messages here, wait for valid context or new session
        isInitializingSessionRef.current = false; // Release lock if exiting early
        return;
      }

      logger.sidepanel.info(`SidePanelChatContext: Initializing for tabId: ${tabId}`);
      try {
        const tabUIState = await SidePanelStateManager.getTabUIState(tabId);
        let activeSessionId = tabUIState.activeChatSessionId;
        let sessionMessages = [];

        if (!activeSessionId) {
          logger.sidepanel.info(`SidePanelChatContext: No active session for tab ${tabId}. Creating new one.`);
          const newSession = await ChatHistoryService.createNewChatSession({
            platformId: selectedPlatformId,
            modelId: selectedModel, // Pass current selectedModel (could be null)
            initialTabUrl: currentTab?.url,
            initialTabTitle: currentTab?.title,
          });

          if (newSession && newSession.metadata) {
            activeSessionId = newSession.metadata.id;
            await SidePanelStateManager.setTabUIVisibility(tabId, true); // Ensure visibility
            await SidePanelStateManager.setActiveChatSessionForTab(tabId, activeSessionId);
            await SidePanelStateManager.setTabViewMode(tabId, 'chat'); // Default to chat view
            logger.sidepanel.info(`SidePanelChatContext: New provisional session ${activeSessionId} created and set for tab ${tabId}.`);
            
            setMessages([]);
            if (typeof clearTokenData === 'function') await clearTokenData(activeSessionId);
            setCurrentChatSessionId(activeSessionId);
            setCurrentView('chat');
          } else {
            logger.sidepanel.error('SidePanelChatContext: Failed to create a new chat session.');
            setMessages([]);
            setCurrentChatSessionId(null);
            setCurrentView('chat');
            // Exit early from initializeContext if session creation fails
            // The finally block will still run to release the lock
            return; 
          }
        } else { // activeSessionId exists for the tab
          logger.sidepanel.info(`SidePanelChatContext: Tab ${tabId} has active session ${activeSessionId}. Checking its status.`);
          const sessionMetadata = await ChatHistoryService.getSessionMetadata(activeSessionId);

          if (sessionMetadata) {
            if (sessionMetadata.isProvisional === true && selectedModel && selectedModel !== sessionMetadata.modelId) {
              logger.sidepanel.info(`SidePanelChatContext: Active session ${activeSessionId} is provisional and model changed (or was null). Updating metadata from ${sessionMetadata.modelId} to ${selectedModel}.`);
              await ChatHistoryService.updateSessionMetadata(activeSessionId, {
                platformId: selectedPlatformId, // Re-affirm platformId too
                modelId: selectedModel,
              });
              // Metadata updated, proceed to load this session
            } else if (sessionMetadata.isProvisional === true) {
                 logger.sidepanel.info(`SidePanelChatContext: Active session ${activeSessionId} is provisional. Model is ${sessionMetadata.modelId || 'null'}, selectedModel is ${selectedModel || 'null'}. No metadata update needed or selectedModel not ready.`);
            } else {
                 logger.sidepanel.info(`SidePanelChatContext: Active session ${activeSessionId} is not provisional. Loading as is.`);
            }
            
            // Load messages for the (potentially updated) active session
            sessionMessages = await ChatHistoryService.getHistory(activeSessionId);
            setCurrentChatSessionId(activeSessionId);
            setMessages(sessionMessages);
            setCurrentView(tabUIState.currentView || 'chat'); // Respect stored view or default to chat
          } else {
            // Metadata for activeSessionId not found - inconsistent state
            logger.sidepanel.error(`SidePanelChatContext: Metadata not found for supposedly active session ${activeSessionId} on tab ${tabId}. Resetting tab's active session.`);
            await SidePanelStateManager.setActiveChatSessionForTab(tabId, null);
            // This will cause initializeContext to re-run (due to potential state change or next render),
            // and it should then fall into the `!activeSessionId` path to create a new session.
            // Reset local state to reflect no active session for this render.
            setCurrentChatSessionId(null);
            setMessages([]);
            setCurrentView('chat');
            // Exit early, the next run of initializeContext will handle creation.
            // The finally block will still run to release the lock.
            return;
          }
        }
      } catch (error) {
        logger.sidepanel.error('Error initializing SidePanelChatContext:', error);
        setMessages([]); 
        setCurrentChatSessionId(null);
        setCurrentView('chat');
      } finally {
        isInitializingSessionRef.current = false;
        logger.sidepanel.debug('SidePanelChatContext: Initialization lock released.');
      }
    };

    initializeContext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, selectedPlatformId, selectedModel, currentTab?.url, currentTab?.title, clearTokenData]); // Dependencies for re-initialization

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

  // Add this useEffect hook inside SidePanelChatProvider
  useEffect(() => {
    if (!chrome.storage || !chrome.storage.onChanged) {
      logger.sidepanel.warn('chrome.storage.onChanged API not available. Cannot listen for chat session updates.');
      return;
    }

    const handleStorageChange = async (changes, areaName) => {
      if (areaName !== 'local' || !changes[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || !currentChatSessionId) {
        return;
      }

      logger.sidepanel.debug('SidePanelChatContext: Storage change detected for GLOBAL_CHAT_SESSIONS.', { currentChatSessionId });

      const newValue = changes[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS].newValue;
      const oldValue = changes[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS].oldValue;

      const currentSessionNewData = newValue ? newValue[currentChatSessionId] : null;
      const currentSessionOldData = oldValue ? oldValue[currentChatSessionId] : null;

      // Determine if a reload is needed for the current session
      let needsReload = false;
      if (currentSessionNewData) { // If new data for the current session exists
        if (!currentSessionOldData) { // And old data didn't exist (e.g., session just created by another context)
          needsReload = true;
          logger.sidepanel.info(`SidePanelChatContext: Session ${currentChatSessionId} appeared in storage. Reloading messages.`);
        } else {
          // Compare relevant parts, e.g., lastActivityAt or message count if metadata is simple
          // For now, comparing lastActivityAt is a good proxy for "content changed"
          const newTimestamp = currentSessionNewData.metadata?.lastActivityAt;
          const oldTimestamp = currentSessionOldData.metadata?.lastActivityAt;
          if (newTimestamp && newTimestamp !== oldTimestamp) {
            needsReload = true;
            logger.sidepanel.info(`SidePanelChatContext: Session ${currentChatSessionId} updated (lastActivityAt changed). Reloading messages.`);
          } else if (!newTimestamp && oldTimestamp) {
            // New data exists but has no timestamp, while old one did (unlikely but possible)
            needsReload = true;
            logger.sidepanel.info(`SidePanelChatContext: Session ${currentChatSessionId} metadata changed (timestamp removed). Reloading messages.`);
          }
          // More sophisticated diffing could be added here if needed, e.g., comparing message array lengths
          // or a dedicated "version" or "revision" number in the session metadata.
        }
      } else if (currentSessionOldData && !currentSessionNewData) {
        // Session was deleted
        logger.sidepanel.info(`SidePanelChatContext: Session ${currentChatSessionId} was deleted from storage. Clearing local messages.`);
        setMessages([]); // Clear messages as the session is gone
        // Potentially call createNewChat or logic to handle session deletion here if needed
        return; // Exit early, no messages to fetch
      }


      if (needsReload) {
        logger.sidepanel.info(`SidePanelChatContext: Reloading messages for session ${currentChatSessionId} due to storage change.`);
        try {
          const updatedMessages = await ChatHistoryService.getHistory(currentChatSessionId);
          setMessages(updatedMessages);
          logger.sidepanel.info(`SidePanelChatContext: Messages for session ${currentChatSessionId} reloaded successfully.`);
        } catch (error) {
          logger.sidepanel.error(`SidePanelChatContext: Error reloading messages for session ${currentChatSessionId} after storage change:`, error);
        }
      } else {
        logger.sidepanel.debug(`SidePanelChatContext: Storage change for GLOBAL_CHAT_SESSIONS did not affect current session ${currentChatSessionId}, or no detectable change requiring reload.`);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    logger.sidepanel.info('SidePanelChatContext: Added storage.onChanged listener for chat sessions.');

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      logger.sidepanel.info('SidePanelChatContext: Removed storage.onChanged listener for chat sessions.');
    };
  }, [currentChatSessionId, setMessages]);

  const createNewChat = useCallback(async () => {
    if (!tabId || !selectedPlatformId ) return; // selectedModel can be null initially
    logger.sidepanel.info(`SidePanelChatContext: createNewChat called for tab ${tabId}`);
    
    const previousActiveSessionId = currentChatSessionId; // Capture previous session ID

    try {
      const newSession = await ChatHistoryService.createNewChatSession({
        platformId: selectedPlatformId,
        modelId: selectedModel,
        initialTabUrl: currentTab?.url,
        initialTabTitle: currentTab?.title,
      });
      if (newSession && newSession.metadata) {
        const newChatSessionId = newSession.metadata.id;
        await SidePanelStateManager.setTabUIVisibility(tabId, true);
        await SidePanelStateManager.setActiveChatSessionForTab(tabId, newChatSessionId);
        await SidePanelStateManager.setTabViewMode(tabId, 'chat');
        setCurrentChatSessionId(newChatSessionId);
        setMessages([]);
        setCurrentView('chat');
        if (typeof clearTokenData === 'function') await clearTokenData(newChatSessionId);
        logger.sidepanel.info(`Successfully created and switched to new session ${newChatSessionId} for tab ${tabId}.`);

        // Cleanup previous provisional session if necessary
        if (previousActiveSessionId && previousActiveSessionId !== newChatSessionId) {
          logger.sidepanel.info(`Checking previous session ${previousActiveSessionId} for cleanup.`);
          const previousSessionMetadata = await ChatHistoryService.getSessionMetadata(previousActiveSessionId);
          if (previousSessionMetadata && previousSessionMetadata.isProvisional === true) {
            logger.sidepanel.info(`Previous session ${previousActiveSessionId} was provisional. Deleting it.`);
            await ChatHistoryService.deleteChatSession(previousActiveSessionId);
            logger.sidepanel.info(`Successfully deleted provisional session ${previousActiveSessionId}.`);
          } else if (previousSessionMetadata) {
            logger.sidepanel.info(`Previous session ${previousActiveSessionId} was not provisional. No cleanup needed.`);
          } else {
            logger.sidepanel.warn(`Could not retrieve metadata for previous session ${previousActiveSessionId}. No cleanup performed.`);
          }
        }

      } else {
         logger.sidepanel.error('Failed to create new chat session in createNewChat.');
      }
    } catch (error) {
      logger.sidepanel.error('Error in createNewChat:', error);
    }
  }, [tabId, selectedPlatformId, selectedModel, currentTab, clearTokenData, currentChatSessionId]); // Added currentChatSessionId to dependencies

  const selectChatSession = useCallback(async (chatSessionIdToSelect) => {
    if (!tabId || !chatSessionIdToSelect) return;
    logger.sidepanel.info(`SidePanelChatContext: selectChatSession called for tab ${tabId}, session ${chatSessionIdToSelect}`);
    try {
      await SidePanelStateManager.setTabUIVisibility(tabId, true);
      await SidePanelStateManager.setActiveChatSessionForTab(tabId, chatSessionIdToSelect);
      await SidePanelStateManager.setTabViewMode(tabId, 'chat');
      setCurrentChatSessionId(chatSessionIdToSelect);
      const history = await ChatHistoryService.getHistory(chatSessionIdToSelect);
      setMessages(history);
      setCurrentView('chat');
      // Token stats will be reloaded by useTokenTracking due to currentChatSessionId change
      logger.sidepanel.info(`Successfully selected session ${chatSessionIdToSelect} for tab ${tabId}.`);
    } catch (error) {
      logger.sidepanel.error('Error in selectChatSession:', error);
    }
  }, [tabId]);

  const switchToHistoryView = useCallback(async () => {
    if (!tabId) return;
    await SidePanelStateManager.setTabViewMode(tabId, 'history');
    setCurrentView('history');
  }, [tabId]);

  const switchToChatView = useCallback(async () => {
    if (!tabId) return;
    await SidePanelStateManager.setTabViewMode(tabId, 'chat');
    setCurrentView('chat');
  }, [tabId]);

  const deleteSelectedChatSession = useCallback(async (chatSessionIdToDelete) => {
    if (!tabId || !chatSessionIdToDelete) return;
    logger.sidepanel.info(`SidePanelChatContext: deleteSelectedChatSession called for session ${chatSessionIdToDelete}, current tab ${tabId}`);
    try {
      await ChatHistoryService.deleteChatSession(chatSessionIdToDelete);
      // If the deleted session was active in the current tab, create a new one.
      if (chatSessionIdToDelete === currentChatSessionId) {
        logger.sidepanel.info(`Deleted session ${chatSessionIdToDelete} was active. Creating a new one for tab ${tabId}.`);
        await createNewChat(); // This will set a new active session and switch view to 'chat'
      } else {
        // If a different session was deleted, and we are in history view, stay there.
        // The history view component will need to refresh its list.
        // If we were in chat view for a *different* session, that remains active.
      }
      // The ChatHistoryListView component will be responsible for re-fetching its list.
    } catch (error) {
      logger.sidepanel.error('Error in deleteSelectedChatSession:', error);
    }
  }, [tabId, currentChatSessionId, createNewChat]);

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
        tabId, // Keep tabId for other potential uses (e.g. source, logging)
        chatSessionId: currentChatSessionId, // Add this
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

    // Update userMessage in the messages array if API call was successful
    if (apiCallSetupResult.success) {
      setMessages(prevMessages => prevMessages.map(msg => {
        if (msg.id === userMessageId) {
          const updatedMsg = { ...msg };
          if (apiCallSetupResult.contentSuccessfullyIncluded && apiCallSetupResult.extractedPageContent) {
            updatedMsg.pageContextUsed = apiCallSetupResult.extractedPageContent;
          }
            // Add the systemPromptUsed to the user message
            updatedMsg.systemPromptUsedForThisTurn = apiCallSetupResult.systemPromptUsed;
            // Store contextTypeUsed if context was included
            if (apiCallSetupResult.contentSuccessfullyIncluded) {
              updatedMsg.contextTypeUsed = contentType;
            }
            return updatedMsg;
        }
        return msg;
      }));
    }
  };

  // --- Utility Functions (Remain in Context) ---
  const resetCurrentTabData = useCallback(async () => {
    if (tabId === null || tabId === undefined) {
      logger.sidepanel.warn('resetCurrentTabData called without a valid tabId.');
      return;
    }
    if (isRefreshing) {
      logger.sidepanel.warn('Refresh already in progress. Ignoring request.');
      return;
    }

    // Confirmation dialog
    if (!window.confirm('Are you sure you want to start a new chat for this tab? This will DELETE the current chat session and its history.')) {
      return;
    }

    setIsRefreshing(true);
    logger.sidepanel.info(`SidePanelChatContext: resetCurrentTabData (starting new chat) for tab ${tabId}`);
    try {
      const sessionToPotentiallyDelete = currentChatSessionId;
      if (streamingMessageId && isProcessing && !isCanceling) {
        logger.sidepanel.info('Refresh requested: Cancelling ongoing stream first...');
        await cancelStream(); // cancelStream is from useChatStreaming
        logger.sidepanel.info('Stream cancellation attempted.');
      }

      // Existing stream cancellation logic ends here or above

      if (sessionToPotentiallyDelete) {
        logger.sidepanel.info(`Refresh requested: Attempting to delete previous session ${sessionToPotentiallyDelete}.`);
        try {
          const deleteSuccess = await ChatHistoryService.deleteChatSession(sessionToPotentiallyDelete);
          if (deleteSuccess) {
            logger.sidepanel.info(`Successfully deleted previous session ${sessionToPotentiallyDelete} as part of refresh.`);
          } else {
            logger.sidepanel.warn(`Failed to delete previous session ${sessionToPotentiallyDelete} during refresh, but proceeding to create new chat.`);
          }
        } catch (deleteError) {
          logger.sidepanel.error(`Error deleting previous session ${sessionToPotentiallyDelete} during refresh:`, deleteError);
          // Continue to create new chat even if deletion fails
        }
      }

      // Call to createNewChat() follows
      await createNewChat(); 
      
      // The original 'clearTabData' message to background is no longer directly relevant here
      // for deleting global history. It might be repurposed if specific tab-UI-state needs resetting beyond new chat.
      // For now, createNewChat handles associating the tab with a new session.

      logger.sidepanel.info('Local sidepanel state reset for new chat complete.');
    } catch (error) {
      logger.sidepanel.error('Error during resetCurrentTabData (starting new chat):', error);
      // Fallback: try to ensure a clean state even on error
      setMessages([]);
      setInputValue('');
      setStreamingMessageId(null);
      setIsCanceling(false);
      if (typeof clearTokenData === 'function' && currentChatSessionId) await clearTokenData(currentChatSessionId);
      setIsContentExtractionEnabled(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [tabId, isRefreshing, streamingMessageId, isProcessing, isCanceling, createNewChat, cancelStream, clearTokenData, currentChatSessionId]);
  
  const clearChat = useCallback(async () => {
    if (!currentChatSessionId) {
      logger.sidepanel.warn('clearChat called without an active chat session.');
      return;
    }
    if (!window.confirm('Are you sure you want to clear all messages from the current chat session? This action cannot be undone.')) {
      return;
    }
    logger.sidepanel.info(`SidePanelChatContext: Clearing messages for session ${currentChatSessionId}`);
    try {
      setMessages([]); // Clear UI immediately
      // Save empty messages to the service. Pass necessary params.
      // modelConfigData might be needed by saveHistory for token stats.
      await ChatHistoryService.saveHistory(currentChatSessionId, [], modelConfigData, {}, isThinkingModeEnabled, null);
      if (typeof clearTokenData === 'function') await clearTokenData(currentChatSessionId); // Clear associated token stats
      // The session itself (metadata) still exists.
      logger.sidepanel.info(`Messages cleared for session ${currentChatSessionId}.`);
    } catch (error) {
      logger.sidepanel.error(`Error clearing chat for session ${currentChatSessionId}:`, error);
      // Potentially reload history to revert UI if save failed.
      const history = await ChatHistoryService.getHistory(currentChatSessionId);
      setMessages(history);
    }
  }, [currentChatSessionId, modelConfigData, isThinkingModeEnabled, clearTokenData]);

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
        messages: visibleMessages, // These are now for the currentChatSessionId
        currentChatSessionId,
        currentView,
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
        resetCurrentTabData, // This now means "start new chat for this tab"
        clearFormattedContentForTab, // Purpose might need review, kept for now
        rerunMessage,
        editAndRerunMessage,
        rerunAssistantMessage,
        // New functions and state
        createNewChat,
        selectChatSession,
        switchToHistoryView,
        switchToChatView,
        deleteSelectedChatSession,
      }}
    >
      {children}
    </SidePanelChatContext.Provider>
  );
}

export const useSidePanelChat = () => useContext(SidePanelChatContext);

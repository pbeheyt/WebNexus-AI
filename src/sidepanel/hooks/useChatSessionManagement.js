// src/sidepanel/hooks/useChatSessionManagement.js
import { useState, useEffect, useCallback, useRef } from 'react';

import { logger } from '../../shared/logger';
import SidePanelStateManager from '../../services/SidePanelStateManager';
import ChatHistoryService from '../services/ChatHistoryService';
import { useContent } from '../../contexts/ContentContext';

/**
 * Manages the lifecycle and state of chat sessions for the sidepanel.
 * This includes loading, creating, switching, and deleting sessions,
 * and synchronizing the UI with the active session's state.
 * @param {object} args - Hook dependencies.
 * @param {number} args.tabId - The ID of the current tab.
 * @param {string} args.selectedPlatformId - The ID of the currently selected platform.
 * @param {string} args.selectedModel - The ID of the currently selected model.
 * @param {function} args.selectPlatform - Function to select a platform.
 * @param {function} args.selectModel - Function to select a model.
 * @param {boolean} args.isPlatformLoading - Flag indicating if the platform context is loading.
 * @returns {object} - Session state and management functions.
 */
export function useChatSessionManagement({
  tabId,
  selectedPlatformId,
  selectedModel,
  selectPlatform,
  selectModel,
  isPlatformLoading,
  setScrollToMessageId, // Add this line
}) {
  const { currentTab } = useContent();
  const [messages, setMessages] = useState([]);
  const [currentChatSessionId, setCurrentChatSessionId] = useState(null);
  const [currentView, setCurrentView] = useState('chat'); // 'chat' or 'history'
  const isInitializingSessionRef = useRef(false);
  const syncedSessionIdRef = useRef(null); // Ref to prevent re-syncing

  // Effect to synchronize the platform/model with the loaded chat session
  useEffect(() => {
    const syncPlatformWithSession = async () => {
      // Prevent re-syncing for the same session after user interaction
      if (currentChatSessionId === syncedSessionIdRef.current) {
        return;
      }

      if (
        !currentChatSessionId ||
        isPlatformLoading || // Wait for platform context to be ready
        !selectPlatform ||
        !selectModel
      ) {
        return;
      }

      try {
        const sessionMetadata =
          await ChatHistoryService.getSessionMetadata(currentChatSessionId);
        if (!sessionMetadata || sessionMetadata.isProvisional) {
          return; // Don't change selection for new/provisional sessions
        }

        const { platformId: sessionPlatformId, modelId: sessionModelId } =
          sessionMetadata;

        if (sessionPlatformId && sessionPlatformId !== selectedPlatformId) {
          logger.sidepanel.info(
            `Session loading: Syncing platform to ${sessionPlatformId}.`
          );
          await selectPlatform(sessionPlatformId, { savePreference: false });
          // Mark as synced after initiating the change
          syncedSessionIdRef.current = currentChatSessionId;
          return; // Allow context to update before proceeding
        }

        if (
          sessionModelId &&
          sessionPlatformId === selectedPlatformId &&
          sessionModelId !== selectedModel
        ) {
          logger.sidepanel.info(
            `Session loading: Syncing model to ${sessionModelId}.`
          );
          await selectModel(sessionModelId, { savePreference: false });
        }
        // Mark as synced after platform/model checks are complete
        syncedSessionIdRef.current = currentChatSessionId;
      } catch (error) {
        logger.sidepanel.error(
          'Error syncing platform/model with session:',
          error
        );
      }
    };

    syncPlatformWithSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChatSessionId, selectedPlatformId, isPlatformLoading]);

  // Comprehensive Initialization Logic
  useEffect(() => {
    const initializeContext = async () => {
      if (isInitializingSessionRef.current) {
        logger.sidepanel.debug(
          'ChatSessionManagement: Initialization already in progress, skipping.'
        );
        return;
      }
      isInitializingSessionRef.current = true;

      if (!tabId || !selectedPlatformId) {
        isInitializingSessionRef.current = false;
        return;
      }

      logger.sidepanel.info(
        `ChatSessionManagement: Initializing for tabId: ${tabId}`
      );
      try {
        const tabUIState = await SidePanelStateManager.getTabUIState(tabId);
        let activeSessionId = tabUIState.activeChatSessionId;
        let sessionMessages = [];

        if (!activeSessionId) {
          logger.sidepanel.info(
            `ChatSessionManagement: No active session for tab ${tabId}. Creating new one.`
          );
          syncedSessionIdRef.current = null; // Reset sync state for new session
          const newSession = await ChatHistoryService.createNewChatSession({
            platformId: selectedPlatformId,
            modelId: selectedModel,
            initialTabUrl: currentTab?.url,
            initialTabTitle: currentTab?.title,
          });

          if (newSession?.metadata) {
            activeSessionId = newSession.metadata.id;
            await SidePanelStateManager.setActiveChatSessionForTab(
              tabId,
              activeSessionId
            );
            await SidePanelStateManager.setTabViewMode(tabId, 'chat');
            setMessages([]);
            setCurrentChatSessionId(activeSessionId);
            setCurrentView('chat');
          } else {
            logger.sidepanel.error(
              'ChatSessionManagement: Failed to create a new chat session.'
            );
            setCurrentChatSessionId(null);
            setCurrentView('chat');
          }
        } else {
          logger.sidepanel.info(
            `ChatSessionManagement: Tab ${tabId} has active session ${activeSessionId}. Checking status.`
          );
          const sessionMetadata =
            await ChatHistoryService.getSessionMetadata(activeSessionId);

          if (sessionMetadata) {
            sessionMessages = await ChatHistoryService.getHistory(
              activeSessionId
            );
            setCurrentChatSessionId(activeSessionId);
            setMessages(sessionMessages);
            // Prevent getting stuck in context view on reload
            const viewToSet =
              tabUIState.currentView === 'context'
                ? 'chat'
                : tabUIState.currentView || 'chat';
            setCurrentView(viewToSet);
          } else {
            logger.sidepanel.error(
              `ChatSessionManagement: Metadata not found for active session ${activeSessionId}. Resetting.`
            );
            await SidePanelStateManager.setActiveChatSessionForTab(tabId, null);
            setCurrentChatSessionId(null);
            setMessages([]);
            setCurrentView('chat');
            // Re-run initialization to create a new session
            isInitializingSessionRef.current = false;
            initializeContext();
            return;
          }
        }
      } catch (error) {
        logger.sidepanel.error(
          'Error initializing ChatSessionManagement:',
          error
        );
        setCurrentChatSessionId(null);
        setMessages([]);
        setCurrentView('chat');
      } finally {
        isInitializingSessionRef.current = false;
      }
    };

    initializeContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, selectedPlatformId, selectedModel]);

      const createNewChat = useCallback(async () => {
        if (!tabId || !selectedPlatformId) return;
        logger.sidepanel.info(
          `ChatSessionManagement: createNewChat called for tab ${tabId}`
        );
    
        const previousActiveSessionId = currentChatSessionId;
        syncedSessionIdRef.current = null; // Allow sync for new session
    
        // Let errors propagate to be caught by the caller
        const newSession = await ChatHistoryService.createNewChatSession({
          platformId: selectedPlatformId,
          modelId: selectedModel,
          initialTabUrl: currentTab?.url,
          initialTabTitle: currentTab?.title,
        });
        
        if (newSession?.metadata) {
          const newChatSessionId = newSession.metadata.id;
          await SidePanelStateManager.setActiveChatSessionForTab(
            tabId,
            newChatSessionId
          );
          await SidePanelStateManager.setTabViewMode(tabId, 'chat');
          setCurrentChatSessionId(newChatSessionId);
          setMessages([]);
          setCurrentView('chat');

          if (previousActiveSessionId && previousActiveSessionId !== newChatSessionId) {
            const prevMeta = await ChatHistoryService.getSessionMetadata(previousActiveSessionId);
            if (prevMeta?.isProvisional) {
              await ChatHistoryService.deleteChatSession(previousActiveSessionId);
            }
          }
        }
      }, [
        tabId,
        selectedPlatformId,
        selectedModel,
        currentTab,
        currentChatSessionId,
      ]);

      const selectChatSession = useCallback(
        async (chatSessionIdToSelect) => {
          if (!tabId || !chatSessionIdToSelect) return;
          // Let errors propagate to be caught by the caller
          syncedSessionIdRef.current = null; // Allow sync for newly selected session
          await SidePanelStateManager.setActiveChatSessionForTab(
            tabId,
            chatSessionIdToSelect
          );
          await SidePanelStateManager.setTabViewMode(tabId, 'chat');
          setCurrentChatSessionId(chatSessionIdToSelect);
          const history = await ChatHistoryService.getHistory(
            chatSessionIdToSelect
          );
          setMessages(history);
          setCurrentView('chat');

          // New logic: set scroll target to last user message
          if (history.length > 0) {
            const lastUserMessage = history
              .slice()
              .reverse()
              .find((msg) => msg.role === 'user');
            if (lastUserMessage) {
              setScrollToMessageId(lastUserMessage.id);
            }
          }
        },
        [tabId, setMessages, setScrollToMessageId]
      );

  const switchToView = useCallback(
    async (viewName) => {
      if (!tabId || !['chat', 'history', 'context'].includes(viewName)) return;
      await SidePanelStateManager.setTabViewMode(tabId, viewName);
      setCurrentView(viewName);
    },
    [tabId]
  );

      const deleteSelectedChatSession = useCallback(
        async (chatSessionIdToDelete) => {
          if (!tabId || !chatSessionIdToDelete) return;
          // Let errors propagate to be caught by the caller
          await ChatHistoryService.deleteChatSession(chatSessionIdToDelete);
          if (chatSessionIdToDelete === currentChatSessionId) {
            await createNewChat();
          }
        },
        [tabId, currentChatSessionId, createNewChat]
      );

  return {
    messages,
    setMessages,
    currentChatSessionId,
    currentView,
    createNewChat,
    selectChatSession,
    deleteSelectedChatSession,
    switchToView,
  };
}

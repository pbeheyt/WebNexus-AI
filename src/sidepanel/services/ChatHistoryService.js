// src/sidepanel/services/ChatHistoryService.js

import { logger } from '../../shared/logger';
import {
  STORAGE_KEYS,
  MAX_MESSAGES_PER_TAB_HISTORY,
  MAX_CHAT_TITLE_LENGTH,
} from '../../shared/constants';


import TokenManagementService from './TokenManagementService';

/**
 * Service for managing tab-specific chat histories
 */
class ChatHistoryService {
  /**
   * Get chat history for a specific chat session
   * @param {string} chatSessionId - The chat session ID
   * @returns {Promise<Array>} Chat history messages
   */
  static async getHistory(chatSessionId) {
    try {
      if (!chatSessionId) {
        logger.sidepanel.error(
          'ChatHistoryService: No chatSessionId provided for getHistory'
        );
        return [];
      }

      // Get all global chat sessions
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.GLOBAL_CHAT_SESSIONS,
      ]);
      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};

      // Return messages for this session or empty array
      return allSessions[chatSessionId]?.messages || [];
    } catch (error) {
      logger.sidepanel.error(
        'ChatHistoryService: Error getting chat session messages:',
        error
      );
      return [];
    }
  }



  /**
   * Save chat history for a specific chat session
   * @param {string} chatSessionId - The chat session ID
   * @param {Array} messages - Chat history messages
   * @param {Object} modelConfig - Model configuration (optional, for token tracking and session metadata)
   * @param {Object} [options={}] - Optional parameters like initial stats for reruns.
   * @param {number} [options.initialAccumulatedCost] - Starting cost for calculation (used in reruns).
   * @param {number} [options.initialOutputTokens] - Starting output tokens for calculation (used in reruns).
   * @param {boolean} [isThinkingModeEnabled=false] - Whether thinking mode is active
   * @param {string | null} [systemPromptForThisTurn=null] - The system prompt used for the current turn.
   * @returns {Promise<boolean|Object>} Success status or token stats object
   */
    static async saveHistory(
        chatSessionId,
        messages,
        modelConfig = null,
        options = {},
        isThinkingModeEnabled = false,
        systemPromptForThisTurn = null
      ) {
        if (!chatSessionId) {
          logger.sidepanel.error(
            'ChatHistoryService: No chatSessionId provided for saveHistory'
          );
          // Throw an error instead of returning false
          throw new Error('Cannot save history without a chatSessionId.');
        }
    
        try {

      // Get all global chat sessions
      const result = await chrome.storage.local.get([STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]);
      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};

      // Limit number of messages to prevent storage problems
      const limitedMessages = messages.slice(-MAX_MESSAGES_PER_TAB_HISTORY);

      // Transform messages for storage to reduce footprint
      const storableMessages = limitedMessages.map(msg => {
        const {
          // eslint-disable-next-line no-unused-vars
          isStreaming,
          // eslint-disable-next-line no-unused-vars
          inputTokens,
          // eslint-disable-next-line no-unused-vars
          outputTokens,
          thinkingContent,
          // eslint-disable-next-line no-unused-vars
          systemPromptUsedForThisTurn,
          ...restOfMsg
        } = msg;

        const storableMsg = { ...restOfMsg };

        // Omit thinkingContent if it's an empty string
        if (thinkingContent && thinkingContent.trim() !== '') {
          storableMsg.thinkingContent = thinkingContent;
        }

        return storableMsg;
      });

      const currentSession = allSessions[chatSessionId];

      if (currentSession) {
        // --- Smart Auto-Titling for Provisional Sessions ---
        if (currentSession.metadata?.isProvisional === true && messages.length > 0) {
          const firstUserMessage = messages.find((msg) => msg.role === 'user');
          const initialTabTitle = currentSession.metadata.initialTabTitle;

          if (firstUserMessage) {
            // Priority 1: If page context was used, use the page's title.
            if (firstUserMessage.pageContextUsed && initialTabTitle) {
              currentSession.metadata.title = initialTabTitle.substring(0, 150); // Use a reasonable length
              logger.sidepanel.info(`ChatHistoryService: Set title from page context for session ${chatSessionId}: "${currentSession.metadata.title}"`);
            
            // Priority 2: If no context, use the first user message if it's long enough.
            } else if (firstUserMessage.content) {
              const words = firstUserMessage.content.trim().split(/\s+/);
              if (words.length >= 4) {
                currentSession.metadata.title = words.slice(0, 20).join(' ') + (words.length > 20 ? '...' : '');
                logger.sidepanel.info(`ChatHistoryService: Generated title from first message for session ${chatSessionId}: "${currentSession.metadata.title}"`);
              }
              // Priority 3 (Fallback): If the message is too short, the title remains "New Chat".
            }
          }
          
          // Commit the session (remove provisional status) to lock the title.
          currentSession.metadata.isProvisional = false;
          logger.sidepanel.info(`ChatHistoryService: Committed provisional session ${chatSessionId}.`);
        }

        // --- Update History and Metadata ---
        currentSession.messages = storableMessages;
        currentSession.metadata.lastActivityAt = new Date().toISOString();

        // --- Update Platform & Model ID from Last Assistant Message ---
        const lastAssistantMessage = messages
          .slice()
          .reverse()
          .find((msg) => msg.role === 'assistant');

        if (lastAssistantMessage) {
          if (lastAssistantMessage.platformId) {
            currentSession.metadata.platformId = lastAssistantMessage.platformId;
          }
          if (lastAssistantMessage.modelId) {
            currentSession.metadata.modelId = lastAssistantMessage.modelId;
          }
        }
      } else {
        logger.sidepanel.error(
          `ChatHistoryService: Attempted to save history for non-existent chatSessionId: ${chatSessionId}`
        );
        return false;
      }

      // Save updated sessions
      await chrome.storage.local.set({
        [STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]: allSessions,
      });

      // Calculate and save token statistics using TokenManagementService, passing options
      const stats = await TokenManagementService.calculateAndUpdateStatistics(
        chatSessionId,
        limitedMessages,
        modelConfig,
        options,
        isThinkingModeEnabled, // Pass thinking mode state
        systemPromptForThisTurn // Pass system prompt for this turn
      );

          return stats;
        } catch (error) {
          logger.sidepanel.error(
            'ChatHistoryService: Error saving chat session:',
            error
          );
          // Re-throw the error to be handled by the caller
          throw error;
        }
      }

      static async createNewChatSession({ platformId, modelId, initialTabUrl, initialTabTitle } = {}) {
        // No try-catch here, let errors propagate
        const chatSessionId = `${STORAGE_KEYS.CHAT_SESSION_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const now = new Date().toISOString();
        const newSession = {
        metadata: {
          id: chatSessionId,
          title: 'New Chat',
          createdAt: now,
          lastActivityAt: now,
          platformId: platformId || null,
          modelId: modelId || null,
          initialTabUrl: initialTabUrl || null,
          initialTabTitle: initialTabTitle || null,
          isProvisional: true,
        },
        messages: [],
      };

      const result = await chrome.storage.local.get([STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]);
      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};
      allSessions[chatSessionId] = newSession;

          await chrome.storage.local.set({ [STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]: allSessions });
          logger.sidepanel.info(`ChatHistoryService: Created new PROVISIONAL chat session: ${chatSessionId}`);
          return newSession; // Return the full session object
      }

  static async getAllChatSessionsMetadata() {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]);
      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};
      const metadataArray = Object.values(allSessions)
        .filter(session => session.metadata && session.metadata.isProvisional !== true)
        .map(session => session.metadata)
        .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
      return metadataArray;
    } catch (error) {
      logger.sidepanel.error('ChatHistoryService: Error getting all chat sessions metadata:', error);
      return [];
    }
  }

      static async deleteChatSession(chatSessionId) {
        if (!chatSessionId) {
          logger.sidepanel.error('ChatHistoryService: No chatSessionId provided for deleteChatSession');
          throw new Error('Cannot delete session without a chatSessionId.');
        }
    
        try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]);
      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};

      if (allSessions[chatSessionId]) {
        delete allSessions[chatSessionId];
        await chrome.storage.local.set({ [STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]: allSessions });
        await TokenManagementService.clearTokenStatistics(chatSessionId); // Use the refactored service
        logger.sidepanel.info(`ChatHistoryService: Deleted chat session: ${chatSessionId}`);
        return true;
      }
      logger.sidepanel.warn(`ChatHistoryService: Chat session ${chatSessionId} not found for deletion.`);
          return false;
        } catch (error) {
          logger.sidepanel.error(`ChatHistoryService: Error deleting chat session ${chatSessionId}:`, error);
          throw error;
        }
      }

  static async updateSessionTitle(chatSessionId, newTitle) {
    const trimmedTitle = newTitle?.trim();
    if (!trimmedTitle) {
      throw new Error('Title cannot be empty.');
    }
    if (trimmedTitle.length > MAX_CHAT_TITLE_LENGTH) {
      throw new Error(`Title cannot exceed ${MAX_CHAT_TITLE_LENGTH} characters.`);
    }

    // `updateSessionMetadata` will now throw on failure, so we just need to await it.
    // If it completes without throwing, the operation was successful.
    await this.updateSessionMetadata(chatSessionId, {
      title: trimmedTitle,
    });

    return true;
  }

      static async deleteMultipleChatSessions(chatSessionIds) {
        if (!Array.isArray(chatSessionIds) || chatSessionIds.length === 0) {
          logger.sidepanel.warn('ChatHistoryService: deleteMultipleChatSessions called with invalid or empty array.');
          return; // Return early, not an error state.
        }
    
        try {
          const storageData = await chrome.storage.local.get([
            STORAGE_KEYS.GLOBAL_CHAT_SESSIONS,
        STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS,
      ]);

      const allSessions = storageData[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};
      const allTokenStats = storageData[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] || {};

      let sessionsChanged = false;
      let tokensChanged = false;

      for (const sessionId of chatSessionIds) {
        if (allSessions[sessionId]) {
          delete allSessions[sessionId];
          sessionsChanged = true;
        }
        if (allTokenStats[sessionId]) {
          delete allTokenStats[sessionId];
          tokensChanged = true;
        }
      }

      const dataToUpdate = {};
      const keysToRemove = [];

      if (sessionsChanged) {
        if (Object.keys(allSessions).length > 0) {
          dataToUpdate[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] = allSessions;
        } else {
          keysToRemove.push(STORAGE_KEYS.GLOBAL_CHAT_SESSIONS);
        }
      }

      if (tokensChanged) {
        if (Object.keys(allTokenStats).length > 0) {
          dataToUpdate[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] = allTokenStats;
        } else {
          keysToRemove.push(STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS);
        }
      }

      if (Object.keys(dataToUpdate).length > 0) {
        await chrome.storage.local.set(dataToUpdate);
      }
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }

          logger.sidepanel.info(`ChatHistoryService: Deleted ${chatSessionIds.length} chat sessions.`);
          return true;
    
        } catch (error) {
          logger.sidepanel.error('ChatHistoryService: Error deleting multiple chat sessions:', error);
          throw error;
        }
      }

      static async updateSessionMetadata(chatSessionId, metadataUpdate) {
        if (!chatSessionId || !metadataUpdate || typeof metadataUpdate !== 'object') {
          logger.sidepanel.error('ChatHistoryService: updateSessionMetadata called with invalid arguments.', { chatSessionId, metadataUpdate });
          throw new Error('Invalid arguments for updateSessionMetadata.');
        }
    
        try {
          const result = await chrome.storage.local.get([STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]);
      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};

      if (allSessions[chatSessionId] && allSessions[chatSessionId].metadata) {
        // Merge new metadata and update last activity timestamp
        allSessions[chatSessionId].metadata = {
          ...allSessions[chatSessionId].metadata,
          ...metadataUpdate,
          lastActivityAt: new Date().toISOString(),
        };

        await chrome.storage.local.set({ [STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]: allSessions });
        logger.sidepanel.info(`ChatHistoryService: Updated metadata for session ${chatSessionId}.`, metadataUpdate);
        return true;
      } else {
        logger.sidepanel.warn(`ChatHistoryService: Session ${chatSessionId} not found for metadata update.`);
        return false;
          }
        } catch (error) {
          logger.sidepanel.error(`ChatHistoryService: Error updating metadata for session ${chatSessionId}:`, error);
          throw error;
        }
      }

  /**
   * Get token statistics for a specific tab
   * Delegates to TokenManagementService
   * @param {number} tabId - Tab identifier
   * @returns {Promise<Object>} - Token usage statistics
   */
  static async calculateTokenStatistics(tabId) {
    return TokenManagementService.getTokenStatistics(tabId);
  }

  /**
   * Calculate context window status for a tab
   * Delegates to TokenManagementService
   * @param {number} tabId - Tab ID
   * @param {Object} modelConfig - Model configuration with context window size
   * @returns {Promise<Object>} - Context window status
   */
  static async calculateContextStatus(tabId, modelConfig) {
    const stats = await TokenManagementService.getTokenStatistics(tabId);
    return TokenManagementService.calculateContextStatus(stats, modelConfig);
  }

  /**
   * Update token statistics for a tab
   * Delegates to TokenManagementService
   * @param {number} tabId - Tab ID
   * @param {Array} messages - Chat messages
   * @returns {Promise<boolean>} - Success status
   */
  static async updateTokenStatistics(tabId, messages, modelConfig = null) {
    return TokenManagementService.calculateAndUpdateStatistics(
      tabId,
      messages,
      modelConfig
    );
  }

  /**
   * Clear token statistics for a tab
   * Delegates to TokenManagementService
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} - Success status
   */
  static async clearTokenStatistics(tabId) {
    return TokenManagementService.clearTokenStatistics(tabId);
  }

  static async getSessionMetadata(chatSessionId) {
    if (!chatSessionId) {
      logger.sidepanel.warn('ChatHistoryService: getSessionMetadata called without chatSessionId.');
      return null;
    }
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]);
      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};
      return allSessions[chatSessionId]?.metadata || null;
    } catch (error) {
      logger.sidepanel.error(`ChatHistoryService: Error getting metadata for session ${chatSessionId}:`, error);
      return null;
    }
  }

  /**
   * Scans all chat sessions and removes any that are provisional and have no messages.
   * Also cleans up any associated token statistics for the deleted sessions.
   * This is designed to be run on extension startup.
   * @returns {Promise<boolean>} True if any sessions were cleaned up, false otherwise.
   */
  static async cleanupProvisionalSessions() {
    logger.sidepanel.info('ChatHistoryService: Starting cleanup of provisional chat sessions...');
    try {
      const storageData = await chrome.storage.local.get([
        STORAGE_KEYS.GLOBAL_CHAT_SESSIONS,
        STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS,
      ]);

      const allSessions = storageData[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};
      const allTokenStats = storageData[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] || {};

      const sessionIdsToDelete = [];
      let sessionsChanged = false;
      let tokensChanged = false;

      for (const sessionId in allSessions) {
        if (Object.hasOwn(allSessions, sessionId)) {
          const session = allSessions[sessionId];
          // A session is provisional if it has the flag AND no messages have been added.
          if (session.metadata?.isProvisional === true && (!session.messages || session.messages.length === 0)) {
            sessionIdsToDelete.push(sessionId);
          }
        }
      }

      if (sessionIdsToDelete.length > 0) {
        logger.sidepanel.info(`ChatHistoryService: Found ${sessionIdsToDelete.length} provisional sessions to delete.`, sessionIdsToDelete);

        for (const sessionId of sessionIdsToDelete) {
          // Delete from sessions object
          if (allSessions[sessionId]) {
            delete allSessions[sessionId];
            sessionsChanged = true;
          }
          // Delete from token stats object
          if (allTokenStats[sessionId]) {
            delete allTokenStats[sessionId];
            tokensChanged = true;
          }
        }

        const dataToUpdate = {};
        const keysToRemove = [];

        if (sessionsChanged) {
          if (Object.keys(allSessions).length > 0) {
            dataToUpdate[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] = allSessions;
          } else {
            keysToRemove.push(STORAGE_KEYS.GLOBAL_CHAT_SESSIONS);
          }
        }

        if (tokensChanged) {
          if (Object.keys(allTokenStats).length > 0) {
            dataToUpdate[STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS] = allTokenStats;
          } else {
            keysToRemove.push(STORAGE_KEYS.GLOBAL_CHAT_TOKEN_STATS);
          }
        }

        if (Object.keys(dataToUpdate).length > 0) {
          await chrome.storage.local.set(dataToUpdate);
        }
        if (keysToRemove.length > 0) {
          await chrome.storage.local.remove(keysToRemove);
        }

        logger.sidepanel.info('ChatHistoryService: Provisional session cleanup complete.');
        return true;
      }

      logger.sidepanel.info('ChatHistoryService: No provisional sessions found to clean up.');
          return false;
    
        } catch (error) {
          logger.sidepanel.error('ChatHistoryService: Error cleaning up provisional sessions:', error);
          throw error;
        }
      }
}

export default ChatHistoryService;

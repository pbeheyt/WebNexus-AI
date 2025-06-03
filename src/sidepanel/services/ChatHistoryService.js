// src/sidepanel/services/ChatHistoryService.js

import { logger } from '../../shared/logger';
import {
  STORAGE_KEYS,
  MAX_MESSAGES_PER_TAB_HISTORY,
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
    try {
      if (!chatSessionId) {
        logger.sidepanel.error(
          'ChatHistoryService: No chatSessionId provided for saveHistory'
        );
        return false;
      }

      // Get all global chat sessions
      const result = await chrome.storage.local.get([STORAGE_KEYS.GLOBAL_CHAT_SESSIONS]);
      const allSessions = result[STORAGE_KEYS.GLOBAL_CHAT_SESSIONS] || {};

      if (allSessions[chatSessionId] && allSessions[chatSessionId].metadata && allSessions[chatSessionId].metadata.isProvisional === true && messages.length > 0) {
        logger.sidepanel.info(`ChatHistoryService: Committing provisional session ${chatSessionId} as messages are being saved.`);
        allSessions[chatSessionId].metadata.isProvisional = false; 
      }

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

      // Update history for this session
      if (allSessions[chatSessionId]) {
        allSessions[chatSessionId].messages = storableMessages;
        allSessions[chatSessionId].metadata.lastActivityAt = new Date().toISOString();
        // Update platformId and modelId if they were part of the message or options
        if (modelConfig && modelConfig.platformId) { // Assuming modelConfig contains platformId
            allSessions[chatSessionId].metadata.platformId = modelConfig.platformId;
        }
        if (modelConfig && modelConfig.id) { // Assuming modelConfig.id is the modelId
           allSessions[chatSessionId].metadata.modelId = modelConfig.id;
        }
      } else {
        logger.sidepanel.error(`ChatHistoryService: Attempted to save history for non-existent chatSessionId: ${chatSessionId}`);
        // Potentially create it, but for now, log error. Creation should be explicit.
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
      return false;
    }
  }

  static async createNewChatSession({ platformId, modelId, initialTabUrl, initialTabTitle } = {}) {
    try {
      const chatSessionId = `${STORAGE_KEYS.CHAT_SESSION_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      const newSession = {
        metadata: {
          id: chatSessionId,
          title: initialTabTitle ? `Chat: ${initialTabTitle.substring(0, 30)}` : `Chat ${new Date(now).toLocaleString()}`,
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
    } catch (error) {
      logger.sidepanel.error('ChatHistoryService: Error creating new chat session:', error);
      return null;
    }
  }

  /**
   * Clear chat history for a specific tab
   * @param {number} tabId - The tab ID
   * @returns {Promise<boolean>} Success status
   */
  /*
  static async clearHistory(tabId) {
    try {
      if (!tabId) {
        logger.sidepanel.error(
          'TabChatHistory: No tabId provided for clearHistory'
        );
        return false;
      }

      // Get all tab chat histories
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.TAB_CHAT_HISTORIES,
      ]);
      const allTabHistories = result[STORAGE_KEYS.TAB_CHAT_HISTORIES] || {};

      // Remove history for this tab
      delete allTabHistories[tabId];

      // Save updated histories
      await chrome.storage.local.set({
        [STORAGE_KEYS.TAB_CHAT_HISTORIES]: allTabHistories,
      });

      // Clear token statistics
      await TokenManagementService.clearTokenStatistics(tabId);

      return true;
    } catch (error) {
      logger.sidepanel.error(
        'TabChatHistory: Error clearing chat history:',
        error
      );
      return false;
    }
  }
  */

  /**
   * Clean up histories for closed tabs
   * @param {Array<number>} activeTabIds - List of currently active tab IDs
   * @returns {Promise<boolean>} Success status
   */
  /*
  static async cleanupClosedTabs(activeTabIds) {
    try {
      if (!activeTabIds || !Array.isArray(activeTabIds)) {
        logger.sidepanel.error(
          'TabChatHistory: Invalid activeTabIds for cleanup'
        );
        return false;
      }

      // Create a Set for faster lookups
      const activeTabsSet = new Set(activeTabIds.map((id) => id.toString()));

      // Get all tab chat histories
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.TAB_CHAT_HISTORIES,
      ]);
      const allTabHistories = result[STORAGE_KEYS.TAB_CHAT_HISTORIES] || {};

      // Check if any cleanup is needed
      let needsCleanup = false;
      const tabIds = Object.keys(allTabHistories);

      for (const tabId of tabIds) {
        if (!activeTabsSet.has(tabId)) {
          delete allTabHistories[tabId];
          needsCleanup = true;

          // Also clear token statistics for this tab
          await TokenManagementService.clearTokenStatistics(tabId);
        }
      }

      // Only update storage if something was removed
      if (needsCleanup) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_CHAT_HISTORIES]: allTabHistories,
        });
        logger.sidepanel.info(
          'TabChatHistory: Cleaned up histories for closed tabs'
        );
      }

      return true;
    } catch (error) {
      logger.sidepanel.error(
        'TabChatHistory: Error cleaning up closed tabs:',
        error
      );
      return false;
    }
  }
  */

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
    try {
      if (!chatSessionId) {
        logger.sidepanel.error('ChatHistoryService: No chatSessionId provided for deleteChatSession');
        return false;
      }
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
      return false;
    }
  }

  static async updateSessionMetadata(chatSessionId, metadataUpdate) {
    if (!chatSessionId || !metadataUpdate || typeof metadataUpdate !== 'object') {
      logger.sidepanel.error('ChatHistoryService: updateSessionMetadata called with invalid arguments.', { chatSessionId, metadataUpdate });
      return false;
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
      return false;
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
}

export default ChatHistoryService;

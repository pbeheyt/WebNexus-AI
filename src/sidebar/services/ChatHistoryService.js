// src/sidebar/services/ChatHistoryService.js

import logger from '../../shared/logger';
import { STORAGE_KEYS } from "../../shared/constants";
import TokenManagementService from "./TokenManagementService";

/**
 * Service for managing tab-specific chat histories
 */
class ChatHistoryService {
  static STORAGE_KEY = STORAGE_KEYS.TAB_CHAT_HISTORIES;
  static MAX_MESSAGES_PER_TAB = 200;
  
  /**
   * Get chat history for a specific tab
   * @param {number} tabId - The tab ID
   * @returns {Promise<Array>} Chat history messages
   */
  static async getHistory(tabId) {
    try {
      if (!tabId) {
        logger.sidebar.error('TabChatHistory: No tabId provided for getHistory');
        return [];
      }

      // Get all tab chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allTabHistories = result[this.STORAGE_KEY] || {};

      // Return history for this tab or empty array
      return allTabHistories[tabId] || [];
    } catch (error) {
      logger.sidebar.error('TabChatHistory: Error getting chat history:', error);
      return [];
    }
  }

  /**
   * Get system prompts for a specific tab
   * @param {number} tabId - The tab ID
   * @returns {Promise<Object>} System prompt for the tab
   */
  static async getSystemPrompt(tabId) {
    try {
      if (!tabId) {
        logger.sidebar.error('TabChatHistory: No tabId provided for getSystemPrompt');
        return null;
      }

      // Get all tab system prompts
      const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_SYSTEM_PROMPTS]);
      const allTabSystemPrompts = result[STORAGE_KEYS.TAB_SYSTEM_PROMPTS] || {};

      // Return system prompts for this tab or null
      return allTabSystemPrompts[tabId] || null;
    } catch (error) {
      logger.sidebar.error('TabChatHistory: Error getting system prompt:', error);
      return null;
    }
  }

  /**
   * Save chat history for a specific tab
   * @param {number} tabId - The tab ID
   * @param {Array} messages - Chat history messages
   * @param {Object} modelConfig - Model configuration (optional, for token tracking)
   * @param {Object} [options={}] - Optional parameters like initial stats for reruns.
   * @param {number} [options.initialAccumulatedCost] - Starting cost for calculation (used in reruns).
   * @param {number} [options.initialOutputTokens] - Starting output tokens for calculation (used in reruns).
   * @returns {Promise<boolean>} Success status
   */
  static async saveHistory(tabId, messages, modelConfig = null, options = {}) {
    try {
      if (!tabId) {
        logger.sidebar.error('TabChatHistory: No tabId provided for saveHistory');
        return false;
      }

      // Get all tab chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allTabHistories = result[this.STORAGE_KEY] || {};

      // Limit number of messages to prevent storage problems
      const limitedMessages = messages.slice(-this.MAX_MESSAGES_PER_TAB);

      // Update history for this tab
      allTabHistories[tabId] = limitedMessages;

      // Save updated histories
      await chrome.storage.local.set({ [this.STORAGE_KEY]: allTabHistories });

      // Calculate and save token statistics using TokenManagementService, passing options
      await TokenManagementService.calculateAndUpdateStatistics(tabId, limitedMessages, modelConfig, options);

      return true;
    } catch (error) {
      logger.sidebar.error('TabChatHistory: Error saving chat history:', error);
      return false;
    }
  }

  /**
   * Clear chat history for a specific tab
   * @param {number} tabId - The tab ID
   * @returns {Promise<boolean>} Success status
   */
  static async clearHistory(tabId) {
    try {
      if (!tabId) {
        logger.sidebar.error('TabChatHistory: No tabId provided for clearHistory');
        return false;
      }

      // Get all tab chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allTabHistories = result[this.STORAGE_KEY] || {};

      // Remove history for this tab
      delete allTabHistories[tabId];

      // Save updated histories
      await chrome.storage.local.set({ [this.STORAGE_KEY]: allTabHistories });

      // Clear token statistics
      await TokenManagementService.clearTokenStatistics(tabId);

      return true;
    } catch (error) {
      logger.sidebar.error('TabChatHistory: Error clearing chat history:', error);
      return false;
    }
  }

  /**
   * Clean up histories for closed tabs
   * @param {Array<number>} activeTabIds - List of currently active tab IDs
   * @returns {Promise<boolean>} Success status
   */
  static async cleanupClosedTabs(activeTabIds) {
    try {
      if (!activeTabIds || !Array.isArray(activeTabIds)) {
        logger.sidebar.error('TabChatHistory: Invalid activeTabIds for cleanup');
        return false;
      }

      // Create a Set for faster lookups
      const activeTabsSet = new Set(activeTabIds.map(id => id.toString()));

      // Get all tab chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allTabHistories = result[this.STORAGE_KEY] || {};

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
        await chrome.storage.local.set({ [this.STORAGE_KEY]: allTabHistories });
        logger.sidebar.info('TabChatHistory: Cleaned up histories for closed tabs');
      }

      return true;
    } catch (error) {
      logger.sidebar.error('TabChatHistory: Error cleaning up closed tabs:', error);
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
    return TokenManagementService.calculateAndUpdateStatistics(tabId, messages, modelConfig);
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
}

export default ChatHistoryService;

import { STORAGE_KEYS } from "../../shared/constants";
import TokenManagementService from "./TokenManagementService";

/**
 * Service for managing tab-specific chat histories with token tracking
 */
class ChatHistoryService {
  static STORAGE_KEY = STORAGE_KEYS.TAB_CHAT_HISTORIES;
  static TOKEN_STATS_KEY = STORAGE_KEYS.TAB_TOKEN_STATISTICS;
  static MAX_MESSAGES_PER_TAB = 200;
  
  /**
   * Get chat history for a specific tab
   * @param {number} tabId - The tab ID
   * @returns {Promise<Array>} Chat history messages
   */
  static async getHistory(tabId) {
    try {
      if (!tabId) {
        console.error('TabChatHistory: No tabId provided for getHistory');
        return [];
      }
      
      // Get all tab chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allTabHistories = result[this.STORAGE_KEY] || {};
      
      // Return history for this tab or empty array
      return allTabHistories[tabId] || [];
    } catch (error) {
      console.error('TabChatHistory: Error getting chat history:', error);
      return [];
    }
  }
  
  /**
   * Save chat history for a specific tab
   * @param {number} tabId - The tab ID
   * @param {Array} messages - Chat history messages
   * @returns {Promise<boolean>} Success status
   */
  static async saveHistory(tabId, messages) {
    try {
      if (!tabId) {
        console.error('TabChatHistory: No tabId provided for saveHistory');
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
      
      // Calculate and save token statistics
      await this.updateTokenStatistics(tabId, limitedMessages);
      
      return true;
    } catch (error) {
      console.error('TabChatHistory: Error saving chat history:', error);
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
        console.error('TabChatHistory: No tabId provided for clearHistory');
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
      await this.clearTokenStatistics(tabId);
      
      return true;
    } catch (error) {
      console.error('TabChatHistory: Error clearing chat history:', error);
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
        console.error('TabChatHistory: Invalid activeTabIds for cleanup');
        return false;
      }
      
      // Create a Set for faster lookups
      const activeTabsSet = new Set(activeTabIds.map(id => id.toString()));
      
      // Get all tab chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allTabHistories = result[this.STORAGE_KEY] || {};
      
      // Get token statistics
      const tokenStatsResult = await chrome.storage.local.get([this.TOKEN_STATS_KEY]);
      const allTokenStats = tokenStatsResult[this.TOKEN_STATS_KEY] || {};
      
      // Check if any cleanup is needed
      let needsCleanup = false;
      const tabIds = Object.keys(allTabHistories);
      
      for (const tabId of tabIds) {
        if (!activeTabsSet.has(tabId)) {
          delete allTabHistories[tabId];
          delete allTokenStats[tabId];
          needsCleanup = true;
        }
      }
      
      // Only update storage if something was removed
      if (needsCleanup) {
        await chrome.storage.local.set({ 
          [this.STORAGE_KEY]: allTabHistories,
          [this.TOKEN_STATS_KEY]: allTokenStats
        });
        console.log('TabChatHistory: Cleaned up histories and token stats for closed tabs');
      }
      
      return true;
    } catch (error) {
      console.error('TabChatHistory: Error cleaning up closed tabs:', error);
      return false;
    }
  }
  
  /**
   * Calculate token statistics from chat history
   * @param {number} tabId - Tab identifier
   * @returns {Promise<Object>} - Token usage statistics
   */
  static async calculateTokenStatistics(tabId) {
    try {
      if (!tabId) {
        return {
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
          promptTokens: 0,
          historyTokens: 0,
          systemTokens: 0,
          isCalculated: false
        };
      }
      
      // First try to get cached statistics
      const result = await chrome.storage.local.get([this.TOKEN_STATS_KEY]);
      const allTokenStats = result[this.TOKEN_STATS_KEY] || {};
      
      if (allTokenStats[tabId]) {
        return {
          ...allTokenStats[tabId],
          isCalculated: true
        };
      }
      
      // If no cached stats, calculate from history
      const history = await this.getHistory(tabId);
      return this._computeTokenStatistics(history);
    } catch (error) {
      console.error('TabChatHistory: Error calculating token statistics:', error);
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        promptTokens: 0,
        historyTokens: 0,
        systemTokens: 0,
        isCalculated: false
      };
    }
  }
  
  /**
   * Calculate context window status for a tab
   * @param {number} tabId - Tab ID
   * @param {Object} modelConfig - Model configuration with context window size
   * @returns {Promise<Object>} - Context window status
   */
  static async calculateContextStatus(tabId, modelConfig) {
    if (!tabId || !modelConfig) {
      return { 
        warningLevel: 'none',
        percentage: 0,
        tokensRemaining: 0,
        exceeds: false
      };
    }
    
    try {
      const tokenStats = await this.calculateTokenStatistics(tabId);
      return TokenManagementService.calculateContextStatus(tokenStats, modelConfig);
    } catch (error) {
      console.error('Error calculating context status:', error);
      return { 
        warningLevel: 'none',
        percentage: 0,
        tokensRemaining: 0,
        exceeds: false
      };
    }
  }
  
  /**
   * Store a token calculation for a message
   * @param {number} tabId - Tab ID
   * @param {string} messageId - Message ID
   * @param {Object} tokenInfo - Token information
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<boolean>} - Success status
   */
  static async updateMessageTokens(tabId, messageId, tokenInfo, metadata = {}) {
    try {
      if (!tabId || !messageId) {
        console.error('No tabId or messageId provided for updateMessageTokens');
        return false;
      }
      
      // Get chat history
      const history = await this.getHistory(tabId);
      
      // Find and update the message
      let updated = false;
      const updatedHistory = history.map(msg => {
        if (msg.id === messageId) {
          updated = true;
          return {
            ...msg,
            inputTokens: tokenInfo.input || msg.inputTokens || 0,
            outputTokens: tokenInfo.output || msg.outputTokens || 0,
            platformId: metadata.platformId || msg.platformId,
            modelId: metadata.modelId || msg.modelId
          };
        }
        return msg;
      });
      
      if (!updated) {
        return false;
      }
      
      // Save updated history
      await this.saveHistory(tabId, updatedHistory);
      
      return true;
    } catch (error) {
      console.error('Error updating message tokens:', error);
      return false;
    }
  }
  
  /**
   * Update token statistics for a tab
   * @private
   * @param {number} tabId - Tab ID
   * @param {Array} messages - Chat messages
   * @returns {Promise<boolean>} - Success status
   */
  static async updateTokenStatistics(tabId, messages) {
    try {
      if (!tabId) return false;
      
      // Calculate token statistics
      const stats = this._computeTokenStatistics(messages);
      
      // Save to storage
      const result = await chrome.storage.local.get([this.TOKEN_STATS_KEY]);
      const allTokenStats = result[this.TOKEN_STATS_KEY] || {};
      
      allTokenStats[tabId] = {
        ...stats,
        lastUpdated: Date.now()
      };
      
      await chrome.storage.local.set({ [this.TOKEN_STATS_KEY]: allTokenStats });
      
      return true;
    } catch (error) {
      console.error('Error updating token statistics:', error);
      return false;
    }
  }
  
  /**
   * Clear token statistics for a tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} - Success status
   */
  static async clearTokenStatistics(tabId) {
    try {
      if (!tabId) return false;
      
      const result = await chrome.storage.local.get([this.TOKEN_STATS_KEY]);
      const allTokenStats = result[this.TOKEN_STATS_KEY] || {};
      
      delete allTokenStats[tabId];
      
      await chrome.storage.local.set({ [this.TOKEN_STATS_KEY]: allTokenStats });
      
      return true;
    } catch (error) {
      console.error('Error clearing token statistics:', error);
      return false;
    }
  }
  
  /**
   * Calculate token statistics from messages
   * @private
   * @param {Array} messages - Chat messages
   * @returns {Object} - Token statistics
   */
  static _computeTokenStatistics(messages) {
    let inputTokens = 0;
    let outputTokens = 0;
    let promptTokens = 0;
    let historyTokens = 0;
    let systemTokens = 0;
    
    // Process each message
    messages.forEach(msg => {
      if (msg.role === 'user') {
        // Use stored token count or estimate
        const msgTokens = msg.inputTokens || TokenManagementService.estimateTokens(msg.content);
        inputTokens += msgTokens;
        
        // Assume the last user message is the prompt
        if (msg === messages[messages.length - (messages.length > 1 ? 2 : 1)]) {
          promptTokens = msgTokens;
        } else {
          historyTokens += msgTokens;
        }
      } else if (msg.role === 'assistant') {
        // Use stored token count or estimate
        outputTokens += msg.outputTokens || TokenManagementService.estimateTokens(msg.content);
      } else if (msg.role === 'system') {
        // System messages contribute to input tokens
        const msgTokens = TokenManagementService.estimateTokens(msg.content);
        inputTokens += msgTokens;
        systemTokens += msgTokens;
      }
    });
    
    return {
      inputTokens,
      outputTokens,
      promptTokens,
      historyTokens,
      systemTokens
    };
  }
}

export default ChatHistoryService;
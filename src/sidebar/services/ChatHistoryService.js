import { STORAGE_KEYS } from "../../shared/constants";

/**
 * Service for managing tab-specific chat histories
 */
class ChatHistoryService {
  static STORAGE_KEY = STORAGE_KEYS.TAB_CHAT_HISTORIES;
  static MAX_MESSAGES_PER_TAB = 100;
  
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
      
      // Check if any cleanup is needed
      let needsCleanup = false;
      const tabIds = Object.keys(allTabHistories);
      
      for (const tabId of tabIds) {
        if (!activeTabsSet.has(tabId)) {
          delete allTabHistories[tabId];
          needsCleanup = true;
        }
      }
      
      // Only update storage if something was removed
      if (needsCleanup) {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: allTabHistories });
        console.log('TabChatHistory: Cleaned up histories for closed tabs');
      }
      
      return true;
    } catch (error) {
      console.error('TabChatHistory: Error cleaning up closed tabs:', error);
      return false;
    }
  }
}

export default ChatHistoryService;
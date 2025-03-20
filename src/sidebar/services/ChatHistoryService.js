import { STORAGE_KEYS } from '../constants';

class ChatHistoryService {
  constructor() {
    this.STORAGE_KEY = STORAGE_KEYS.CHAT_HISTORY;
  }
  
  /**
   * Get message history for a specific URL
   * @param {string} pageUrl - The page URL
   * @returns {Promise<Array>} Message history
   */
  async getHistory(pageUrl) {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const allHistory = result[this.STORAGE_KEY] || {};
      return allHistory[pageUrl] || [];
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }
  
  /**
   * Save message history for a specific URL
   * @param {string} pageUrl - The page URL
   * @param {Array} messages - The messages to save
   * @returns {Promise<boolean>} Success indicator
   */
  async saveHistory(pageUrl, messages) {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const allHistory = result[this.STORAGE_KEY] || {};
      
      // Store only the last 50 messages per page
      allHistory[pageUrl] = messages.slice(-50);
      
      await chrome.storage.local.set({ [this.STORAGE_KEY]: allHistory });
      return true;
    } catch (error) {
      console.error('Error saving chat history:', error);
      return false;
    }
  }
  
  /**
   * Clear message history for a specific URL
   * @param {string} pageUrl - The page URL
   * @returns {Promise<boolean>} Success indicator
   */
  async clearHistory(pageUrl) {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const allHistory = result[this.STORAGE_KEY] || {};
      
      if (allHistory[pageUrl]) {
        delete allHistory[pageUrl];
        await chrome.storage.local.set({ [this.STORAGE_KEY]: allHistory });
      }
      
      return true;
    } catch (error) {
      console.error('Error clearing chat history:', error);
      return false;
    }
  }
  
  /**
   * Clear all chat history
   * @returns {Promise<boolean>} Success indicator
   */
  async clearAllHistory() {
    try {
      await chrome.storage.local.remove(this.STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing all chat history:', error);
      return false;
    }
  }
}

// Export singleton instance
export default new ChatHistoryService();
import { STORAGE_KEYS } from "../../shared/constants";

// src/sidebar/services/ChatHistoryService.js

class ChatHistoryService {
  static STORAGE_KEY = STORAGE_KEYS.CHAT_HISTORY;
  static MAX_HISTORIES = 20;
  static MAX_MESSAGES_PER_URL = 100;
  
  /**
   * Get chat history for a specific URL
   * @param {string} url - The page URL
   * @returns {Promise<Array>} Chat history messages
   */
  static async getHistory(url) {
    try {
      if (!url) return [];
      
      // Normalize URL to handle variations
      const normalizedUrl = this._normalizeUrl(url);
      
      // Get all chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allHistories = result[this.STORAGE_KEY] || {};
      
      // Return history for this URL or empty array
      return allHistories[normalizedUrl] || [];
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }
  
  /**
   * Save chat history for a specific URL
   * @param {string} url - The page URL
   * @param {Array} messages - Chat history messages
   * @returns {Promise<boolean>} Success status
   */
  static async saveHistory(url, messages) {
    try {
      if (!url) return false;
      
      // Normalize URL to handle variations
      const normalizedUrl = this._normalizeUrl(url);
      
      // Get all chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allHistories = result[this.STORAGE_KEY] || {};
      
      // Limit number of messages to prevent storage problems
      const limitedMessages = messages.slice(-this.MAX_MESSAGES_PER_URL);
      
      // Update history for this URL
      allHistories[normalizedUrl] = limitedMessages;
      
      // If we have too many histories, remove oldest
      const urlKeys = Object.keys(allHistories);
      if (urlKeys.length > this.MAX_HISTORIES) {
        // Sort by last update timestamp
        const sortedUrls = urlKeys.sort((a, b) => {
          const aLastMsg = allHistories[a][allHistories[a].length - 1];
          const bLastMsg = allHistories[b][allHistories[b].length - 1];
          
          const aTimestamp = aLastMsg ? new Date(aLastMsg.timestamp) : new Date(0);
          const bTimestamp = bLastMsg ? new Date(bLastMsg.timestamp) : new Date(0);
          
          return aTimestamp - bTimestamp;
        });
        
        // Remove oldest histories
        const toRemove = sortedUrls.slice(0, urlKeys.length - this.MAX_HISTORIES);
        toRemove.forEach(oldUrl => {
          delete allHistories[oldUrl];
        });
      }
      
      // Save updated histories
      await chrome.storage.local.set({ [this.STORAGE_KEY]: allHistories });
      return true;
    } catch (error) {
      console.error('Error saving chat history:', error);
      return false;
    }
  }
  
  /**
   * Clear chat history for a specific URL
   * @param {string} url - The page URL
   * @returns {Promise<boolean>} Success status
   */
  static async clearHistory(url) {
    try {
      if (!url) return false;
      
      // Normalize URL to handle variations
      const normalizedUrl = this._normalizeUrl(url);
      
      // Get all chat histories
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const allHistories = result[this.STORAGE_KEY] || {};
      
      // Remove history for this URL
      delete allHistories[normalizedUrl];
      
      // Save updated histories
      await chrome.storage.local.set({ [this.STORAGE_KEY]: allHistories });
      return true;
    } catch (error) {
      console.error('Error clearing chat history:', error);
      return false;
    }
  }
  
  /**
   * Normalize URL by removing query parameters, hash, etc.
   * @param {string} url - The URL to normalize
   * @returns {string} Normalized URL
   */
  static _normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname;
    } catch (error) {
      // If URL parsing fails, return original
      return url;
    }
  }
}

export default ChatHistoryService;

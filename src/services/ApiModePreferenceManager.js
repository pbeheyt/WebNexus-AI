// src/services/ApiModePreferenceManager.js

const logger = require('../utils/logger').service;

/**
 * Service for managing API mode preferences
 */
class ApiModePreferenceManager {
  constructor() {
    this.STORAGE_KEY = 'api_mode_preferences';
  }
  
  /**
   * Get API mode preference for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<Object>} API mode preference
   */
  async getPreference(platformId) {
    try {
      logger.info(`Getting API mode preference for ${platformId}`);
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      const preferences = result[this.STORAGE_KEY] || {};
      
      // Return platform preference or default
      return preferences[platformId] || {
        enabled: false,
        model: null
      };
    } catch (error) {
      logger.error('Error getting API mode preference:', error);
      return { enabled: false, model: null };
    }
  }
  
  /**
   * Store API mode preference for a platform
   * @param {string} platformId - Platform identifier
   * @param {Object} preference - Preference object {enabled, model}
   * @returns {Promise<boolean>} Success indicator
   */
  async storePreference(platformId, preference) {
    try {
      logger.info(`Storing API mode preference for ${platformId}:`, preference);
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      const preferences = result[this.STORAGE_KEY] || {};
      
      // Update preference for this platform
      preferences[platformId] = {
        enabled: !!preference.enabled,
        model: preference.model || null
      };
      
      await chrome.storage.sync.set({ [this.STORAGE_KEY]: preferences });
      return true;
    } catch (error) {
      logger.error('Error storing API mode preference:', error);
      return false;
    }
  }
  
  /**
   * Check if API mode is enabled for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<boolean>} True if API mode is enabled
   */
  async isApiModeEnabled(platformId) {
    try {
      const preference = await this.getPreference(platformId);
      return !!preference.enabled;
    } catch (error) {
      logger.error('Error checking if API mode is enabled:', error);
      return false;
    }
  }
}

// Export singleton instance
const apiModePreferenceManager = new ApiModePreferenceManager();
module.exports = apiModePreferenceManager;
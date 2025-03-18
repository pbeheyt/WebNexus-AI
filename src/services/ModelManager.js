// src/services/ModelManager.js

const logger = require('../utils/logger').service;

/**
 * Service for managing AI model configurations
 */
class ModelManager {
  constructor() {
    this.STORAGE_KEY = 'model_preferences';
    this.cachedModels = {};
  }
  
  /**
   * Get all available models for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<Array<string>>} Available models
   */
  async getAvailableModels(platformId) {
    try {
      // Check cache first
      if (this.cachedModels[platformId]) {
        return this.cachedModels[platformId];
      }
      
      // Load from platform config
      const platformConfig = await this._loadPlatformConfig(platformId);
      if (!platformConfig || !platformConfig.api) {
        throw new Error(`Configuration not found for platform: ${platformId}`);
      }
      
      const models = platformConfig.api.models || [];
      
      // Update cache
      this.cachedModels[platformId] = models;
      
      return models;
    } catch (error) {
      logger.error(`Error getting available models for ${platformId}:`, error);
      return [];
    }
  }
  
  /**
   * Get default model for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<string|null>} Default model
   */
  async getDefaultModel(platformId) {
    try {
      const platformConfig = await this._loadPlatformConfig(platformId);
      if (!platformConfig || !platformConfig.api) {
        throw new Error(`Configuration not found for platform: ${platformId}`);
      }
      
      return platformConfig.api.defaultModel || null;
    } catch (error) {
      logger.error(`Error getting default model for ${platformId}:`, error);
      return null;
    }
  }
  
  /**
   * Get user's preferred model for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<string|null>} Preferred model or null
   */
  async getPreferredModel(platformId) {
    try {
      // First check user preferences
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      const preferences = result[this.STORAGE_KEY] || {};
      
      // If user has a preference, use it
      if (preferences[platformId]) {
        return preferences[platformId];
      }
      
      // Otherwise, fall back to default model
      return this.getDefaultModel(platformId);
    } catch (error) {
      logger.error(`Error getting preferred model for ${platformId}:`, error);
      return this.getDefaultModel(platformId);
    }
  }
  
  /**
   * Set preferred model for a platform
   * @param {string} platformId - Platform identifier
   * @param {string} modelId - Model identifier
   * @returns {Promise<boolean>} Success indicator
   */
  async setPreferredModel(platformId, modelId) {
    try {
      // Validate model exists
      const models = await this.getAvailableModels(platformId);
      if (models.length > 0 && !models.includes(modelId)) {
        logger.warn(`Model ${modelId} not found in available models for ${platformId}`);
      }
      
      // Save preference
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      const preferences = result[this.STORAGE_KEY] || {};
      
      preferences[platformId] = modelId;
      
      await chrome.storage.sync.set({ [this.STORAGE_KEY]: preferences });
      return true;
    } catch (error) {
      logger.error(`Error setting preferred model for ${platformId}:`, error);
      return false;
    }
  }
  
  /**
   * Reset model preference to default
   * @param {string} platformId - Platform identifier
   * @returns {Promise<boolean>} Success indicator
   */
  async resetToDefault(platformId) {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      const preferences = result[this.STORAGE_KEY] || {};
      
      if (preferences[platformId]) {
        delete preferences[platformId];
        await chrome.storage.sync.set({ [this.STORAGE_KEY]: preferences });
      }
      
      return true;
    } catch (error) {
      logger.error(`Error resetting model preference for ${platformId}:`, error);
      return false;
    }
  }
  
  /**
   * Check if a model is valid for a platform
   * @param {string} platformId - Platform identifier
   * @param {string} modelId - Model identifier
   * @returns {Promise<boolean>} Whether model is valid
   */
  async isModelValid(platformId, modelId) {
    const models = await this.getAvailableModels(platformId);
    return models.includes(modelId);
  }
  
  /**
   * Clear model cache to force reload from config
   */
  clearCache() {
    this.cachedModels = {};
  }
  
  /**
   * Load platform configuration
   * @private
   * @param {string} platformId - Platform identifier
   * @returns {Promise<Object|null>} Platform configuration
   */
  async _loadPlatformConfig(platformId) {
    try {
      const response = await fetch(chrome.runtime.getURL('platform-config.json'));
      const config = await response.json();
      return config.aiPlatforms[platformId] || null;
    } catch (error) {
      logger.error(`Error loading platform config for ${platformId}:`, error);
      return null;
    }
  }
}

// Export singleton instance
const modelManager = new ModelManager();
module.exports = modelManager;
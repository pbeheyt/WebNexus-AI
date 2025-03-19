// src/services/ApiServiceManager.js

const ApiFactory = require('../api/api-factory');
const CredentialManager = require('./CredentialManager');
const logger = require('../utils/logger').service;

/**
 * Centralized manager for API service operations
 */
class ApiServiceManager {
  constructor() {
    this.credentialManager = CredentialManager;
  }

  /**
   * Process content through API
   * @param {string} platformId - Platform identifier
   * @param {Object} contentData - Extracted content data
   * @param {string} prompt - Formatted prompt
   * @returns {Promise<Object>} API response
   */
  async processContent(platformId, contentData, prompt, modelId = null) {
    try {
      logger.info(`Processing content through ${platformId} API`);
      
      // Get credentials
      const credentials = await this.credentialManager.getCredentials(platformId);
      if (!credentials) {
        throw new Error(`No API credentials found for ${platformId}`);
      }

      // Add model to credentials if provided
      if (modelId) {
        credentials.model = modelId;
      }
      
      // Create API service
      const apiService = ApiFactory.createApiService(platformId);
      if (!apiService) {
        throw new Error(`API service not available for ${platformId}`);
      }
      
      // Initialize and process
      await apiService.initialize(credentials);
      return await apiService.process(contentData, prompt);
    } catch (error) {
      logger.error(`Error processing content through ${platformId} API:`, error);
      return {
        success: false,
        error: error.message,
        platformId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get API settings for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<Object|null>} API settings
   */
  async getApiSettings(platformId) {
    try {
      // Load platform config
      const response = await fetch(chrome.runtime.getURL('platform-config.json'));
      const config = await response.json();
      
      // Get API settings
      return config.aiPlatforms[platformId]?.api || null;
    } catch (error) {
      logger.error(`Error getting API settings for ${platformId}:`, error);
      return null;
    }
  }

  /**
   * Check if API mode is available for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<boolean>} True if API mode is available
   */
  async isApiModeAvailable(platformId) {
    try {
      const settings = await this.getApiSettings(platformId);
      const hasCredentials = await this.credentialManager.hasCredentials(platformId);
      
      return !!(settings && hasCredentials);
    } catch (error) {
      logger.error(`Error checking API mode availability for ${platformId}:`, error);
      return false;
    }
  }

  /**
   * Get available models for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<Array<string>|null>} Available models
   */
  async getAvailableModels(platformId) {
    try {
      const settings = await this.getApiSettings(platformId);
      return settings?.models || null;
    } catch (error) {
      logger.error(`Error getting available models for ${platformId}:`, error);
      return null;
    }
  }
}

// Export singleton instance
const apiServiceManager = new ApiServiceManager();
module.exports = apiServiceManager;
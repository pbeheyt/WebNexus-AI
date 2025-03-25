// src/services/ApiServiceManager.js

const ApiFactory = require('../api/api-factory');
const CredentialManager = require('./CredentialManager');
const ModelParameterService = require('./ModelParameterService');
const logger = require('../utils/logger').service;

/**
 * Centralized manager for API service operations
 */
class ApiServiceManager {
  constructor() {
    this.credentialManager = CredentialManager;
    this.modelParameterService = ModelParameterService;
  }

  /**
   * Process content through API with unified request configuration
   * @param {string} platformId - Platform identifier
   * @param {Object} requestConfig - Unified request configuration object
   * @param {Object} requestConfig.contentData - Extracted content data
   * @param {string} requestConfig.prompt - Formatted prompt
   * @param {string} [requestConfig.model] - Optional model override
   * @param {Array} [requestConfig.conversationHistory] - Optional conversation history
   * @param {boolean} [requestConfig.streaming] - Whether to use streaming
   * @param {Function} [requestConfig.onChunk] - Callback for streaming chunks
   * @returns {Promise<Object>} API response
   */
  async processWithUnifiedConfig(platformId, requestConfig, tabId) {
    try {
      logger.info(`Processing content through ${platformId} API with unified config:`, {
        hasStreaming: !!requestConfig.streaming,
        hasHistory: Array.isArray(requestConfig.conversationHistory) && requestConfig.conversationHistory.length > 0,
        hasModel: !!requestConfig.model,
        tabId: tabId
      });

      // Ensure we have the necessary configuration
      if (!requestConfig) {
        throw new Error('Request configuration is required');
      }

      // Add tab ID to request config
      requestConfig.tabId = tabId;

      // Get credentials
      const credentials = await this.credentialManager.getCredentials(platformId);
      if (!credentials) {
        throw new Error(`No API credentials found for ${platformId}`);
      }

      // Create API service
      const apiService = ApiFactory.createApiService(platformId);
      if (!apiService) {
        throw new Error(`API service not available for ${platformId}`);
      }

      // Initialize API service
      await apiService.initialize(credentials);

      // Process the request using the unified interface
      return await apiService.processRequest(requestConfig);
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
   * Verify API credentials with lightweight validation
   * @param {string} platformId - Platform identifier
   * @param {Object} [credentials] - Optional credentials (if not provided, stored credentials will be used)
   * @returns {Promise<boolean>} Validation result
   */
  async validateCredentials(platformId, credentials = null) {
    try {
      // Get credentials if not provided
      const credentialsToUse = credentials || await this.credentialManager.getCredentials(platformId);

      if (!credentialsToUse) {
        logger.warn(`No credentials available for ${platformId}`);
        return false;
      }

      // Create API service
      const apiService = ApiFactory.createApiService(platformId);
      if (!apiService) {
        throw new Error(`API service not available for ${platformId}`);
      }

      // Initialize with credentials
      await apiService.initialize(credentialsToUse);

      // Use lightweight validation method
      return await apiService.validateCredentials();
    } catch (error) {
      logger.error(`Error validating credentials for ${platformId}:`, error);
      return false;
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
   * @returns {Promise<Array<Object>|null>} Available models
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

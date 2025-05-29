// src/services/ApiServiceManager.js

import ApiFactory from '../api/api-factory.js';
import { logger } from '../shared/logger.js';

import CredentialManager from './CredentialManager.js';
import ModelParameterService from './ModelParameterService.js';
import ConfigService from './ConfigService.js';

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
   * @param {string} requestConfig.prompt - User prompt
   * @param {Object} requestConfig.resolvedParams - Resolved model parameters (model, temp, etc.)
   * @param {string|null} requestConfig.formattedContent - Formatted content string or null
   * @param {Array} [requestConfig.conversationHistory] - Optional conversation history
   * @param {boolean} requestConfig.streaming - Whether to use streaming (should always be true here)
   * @param {Function} requestConfig.onChunk - Callback for streaming chunks
   * @returns {Promise<Object>} API response
   */
  async processWithUnifiedConfig(platformId, requestConfig) {
    try {
      logger.service.info(
        `Processing content through ${platformId} API with unified config:`,
        {
          hasStreaming: !!requestConfig.streaming,
          hasHistory:
            Array.isArray(requestConfig.resolvedParams?.conversationHistory) &&
            requestConfig.resolvedParams?.conversationHistory.length > 0,
          model: requestConfig.resolvedParams?.model || 'N/A',
          tabId: requestConfig.resolvedParams?.tabId || 'N/A',
          hasFormattedContent:
            requestConfig.formattedContent !== null &&
            requestConfig.formattedContent !== undefined,
        }
      );

      // Ensure we have the necessary configuration
      if (!requestConfig || !requestConfig.resolvedParams) {
        throw new Error(
          'Request configuration with resolvedParams is required'
        );
      }

      // Get credentials
      const credentials =
        await this.credentialManager.getCredentials(platformId);
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
      logger.service.error(
        `Error processing content through ${platformId} API:`,
        error
      );
      return {
        success: false,
        error: error.message,
        platformId,
        timestamp: new Date().toISOString(),
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
      const credentialsToUse =
        credentials ||
        (await this.credentialManager.getCredentials(platformId));

      if (!credentialsToUse) {
        logger.service.warn(`No credentials available for ${platformId}`);
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
      logger.service.error(
        `Error validating credentials for ${platformId}:`,
        error
      );
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
      const settings = await ConfigService.getPlatformApiConfig(platformId);
      return settings?.models || null;
    } catch (error) {
      logger.service.error(
        `Error getting available models for ${platformId}:`,
        error
      );
      return null;
    }
  }
}

// Export singleton instance
const apiServiceManager = new ApiServiceManager();
export default apiServiceManager;

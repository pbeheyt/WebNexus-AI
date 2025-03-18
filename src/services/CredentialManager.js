// src/services/CredentialManager.js

/**
 * Service for secure API credential management
 */
class CredentialManager {
  constructor() {
    this.STORAGE_KEY = 'api_credentials';
    this.logger = this._createLogger();
  }
  
  /**
   * Get stored credentials for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<Object|null>} Credentials or null if not found
   */
  async getCredentials(platformId) {
    try {
      this.logger.info(`Getting credentials for ${platformId}`);
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      const credentials = result[this.STORAGE_KEY] || {};
      return credentials[platformId] || null;
    } catch (error) {
      this.logger.error('Error retrieving credentials:', error);
      return null;
    }
  }
  
  /**
   * Store credentials for a platform
   * @param {string} platformId - Platform identifier
   * @param {Object} credentials - Platform credentials (apiKey, etc.)
   * @returns {Promise<boolean>} Success indicator
   */
  async storeCredentials(platformId, credentials) {
    try {
      this.logger.info(`Storing credentials for ${platformId}`);
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      const allCredentials = result[this.STORAGE_KEY] || {};
      
      // Update credentials for this platform
      allCredentials[platformId] = credentials;
      
      await chrome.storage.sync.set({ [this.STORAGE_KEY]: allCredentials });
      return true;
    } catch (error) {
      this.logger.error('Error storing credentials:', error);
      return false;
    }
  }
  
  /**
   * Remove credentials for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<boolean>} Success indicator
   */
  async removeCredentials(platformId) {
    try {
      this.logger.info(`Removing credentials for ${platformId}`);
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      const allCredentials = result[this.STORAGE_KEY] || {};
      
      if (allCredentials[platformId]) {
        delete allCredentials[platformId];
        await chrome.storage.sync.set({ [this.STORAGE_KEY]: allCredentials });
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error removing credentials:', error);
      return false;
    }
  }
  
  /**
   * Check if credentials exist for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<boolean>} True if credentials exist
   */
  async hasCredentials(platformId) {
    const credentials = await this.getCredentials(platformId);
    return !!credentials;
  }
  
  /**
   * Validate credentials for a platform by making a test API call
   * @param {string} platformId - Platform identifier
   * @param {Object} credentials - Credentials to validate
   * @returns {Promise<{isValid: boolean, message: string}>} Validation result
   */
  async validateCredentials(platformId, credentials) {
    try {
      this.logger.info(`Validating credentials for ${platformId}`);
      
      const ApiFactory = require('../api/api-factory');
      const apiService = ApiFactory.createApiService(platformId);
      
      if (!apiService) {
        throw new Error(`No API service available for ${platformId}`);
      }
      
      await apiService.initialize(credentials);
      const isValid = await apiService.validateCredentials();
      
      return {
        isValid,
        message: isValid ? 'Credentials validated successfully' : 'Invalid credentials'
      };
    } catch (error) {
      this.logger.error('Validation error:', error);
      return {
        isValid: false,
        message: `Validation error: ${error.message}`
      };
    }
  }
  
  /**
   * Create a logger instance
   * @returns {Object} Logger object
   */
  _createLogger() {
    return {
      info: (message, data = null) => console.log(`[CredentialManager] INFO: ${message}`, data || ''),
      warn: (message, data = null) => console.warn(`[CredentialManager] WARN: ${message}`, data || ''),
      error: (message, data = null) => console.error(`[CredentialManager] ERROR: ${message}`, data || '')
    };
  }
}

// Export singleton instance
const credentialManager = new CredentialManager();
module.exports = credentialManager;
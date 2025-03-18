// src/api/api-interface.js

/**
 * Interface defining contract for all API implementations
 */
class ApiInterface {
  /**
   * Initialize the API client with credentials
   * @param {Object} credentials - API credentials
   * @returns {Promise<void>}
   */
  async initialize(credentials) {
    throw new Error('initialize must be implemented by subclasses');
  }
  
  /**
   * Process content through the API service
   * @param {Object} contentData - Extracted content data
   * @param {string} prompt - Formatted prompt
   * @returns {Promise<Object>} Standardized response object
   */
  async process(contentData, prompt) {
    throw new Error('process must be implemented by subclasses');
  }
  
  /**
   * Verify API credentials are valid
   * @returns {Promise<boolean>} Validation result
   */
  async validateCredentials() {
    throw new Error('validateCredentials must be implemented by subclasses');
  }
}

module.exports = ApiInterface;
/**
 * Interface defining contract for all API implementations
 */
class ApiInterface {
  /**
   * Initialize the API client with credentials
   * @param {Object} credentials - API credentials
   * @returns {Promise<void>}
   */
  async initialize(_credentials) {
    throw new Error('initialize must be implemented by subclasses');
  }

  /**
   * Process unified API request with complete configuration
   * @param {Object} requestConfig - Unified request configuration
   * @param {Object} requestConfig.contentData - Extracted content data
   * @param {string} requestConfig.prompt - Formatted prompt
   * @param {string} [requestConfig.model] - Optional model override
   * @param {Array} [requestConfig.conversationHistory] - Optional conversation history
   * @param {boolean} [requestConfig.streaming] - Whether to use streaming mode
   * @param {Function} [requestConfig.onChunk] - Callback for streaming chunks
   * @param {number} [requestConfig.tabId] - Tab ID for token accounting
   * @returns {Promise<Object>} Standardized response object
   */
  async processRequest(_requestConfig) {
    throw new Error('processRequest must be implemented by subclasses');
  }

  /**
   * Lightweight method to verify API credentials
   * @returns {Promise<boolean>} Validation result
   */
  async validateCredentials() {
    throw new Error('validateCredentials must be implemented by subclasses');
  }
}

export default ApiInterface;

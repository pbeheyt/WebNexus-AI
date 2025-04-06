const ApiInterface = require('./api-interface');
const ModelParameterService = require('../services/ModelParameterService');
const { STORAGE_KEYS } = require('../shared/constants');

/**
 * Base class with shared API functionality
 */
class BaseApiService extends ApiInterface {
  constructor(platformId) {
    super();
    this.platformId = platformId;
    this.logger = this._createLogger();
    this.credentials = null;
    this.config = null;
  }

  /**
   * Initialize the API client with credentials
   * @param {Object} credentials - API credentials
   * @returns {Promise<void>}
   */
  async initialize(credentials) {
    this.credentials = credentials;
    this.config = await this._loadPlatformConfig();
    this.logger.info('API service initialized');
  }

  /**
   * Process unified API request using the new centralized structure.
   * @param {Object} requestConfig - Unified request configuration object
   * @param {string} requestConfig.prompt - User prompt
   * @param {Object} requestConfig.resolvedParams - Resolved model parameters (model, temp, etc.)
   * @param {string|null} requestConfig.formattedContent - Formatted content string or null
   * @param {Array} [requestConfig.conversationHistory] - Optional conversation history
   * @param {boolean} requestConfig.streaming - Whether to use streaming (should always be true here)
   * @param {Function} requestConfig.onChunk - Callback for streaming chunks
   * @returns {Promise<Object>} Standardized response object or result from _processWithModelStreaming
   */
  async processRequest(requestConfig) {
    try {
      // Validate essential parts of the config
      if (!requestConfig || !requestConfig.resolvedParams || !requestConfig.prompt || !requestConfig.onChunk) {
        throw new Error('Invalid requestConfig provided to BaseApiService.processRequest');
      }

      // Extract abortSignal along with other properties
      const { prompt, resolvedParams, formattedContent, onChunk, abortSignal } = requestConfig;
      const { apiKey } = this.credentials;

      if (!apiKey) {
        throw new Error('API key not available in BaseApiService');
      }

      // Create the final prompt including formatted content if available
      const structuredPrompt = this._createStructuredPrompt(prompt, formattedContent);

      this.logger.info(`Processing request for model ${resolvedParams.model} with${formattedContent ? ' included' : 'out'} content.`);

      // Directly call the implementation's streaming method
      // Pass the full resolvedParams object
      return await this._processWithModelStreaming(
        structuredPrompt,
        resolvedParams, // Pass the whole object
        apiKey,
        onChunk, // Pass the callback directly
        abortSignal // Pass the signal as the last argument
      );

    } catch (error) {
      this.logger.error('Error in BaseApiService.processRequest:', error);
      // Return a standardized error object if possible
      return {
        success: false,
        error: `API Processing Error: ${error.message}`,
        platformId: this.platformId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Create a structured prompt combining the base prompt and formatted content.
   * @param {string} prompt - The base user prompt.
   * @param {string|null} formattedContent - The formatted content string, or null/undefined.
   * @returns {string} The full structured prompt.
   */
  _createStructuredPrompt(prompt, formattedContent) {
    // Only include content if it's a non-empty string
    if (typeof formattedContent === 'string' && formattedContent.trim().length > 0) {
      // Combine prompt and content
      // Consider adding clear separators if needed, e.g., "\n\n--- Content ---\n"
      return `${prompt}\n\n${formattedContent}`;
    } else {
      // Return only the prompt if no valid content is provided
      return prompt;
    }
  }

  /**
   * Lightweight validation method that doesn't use the full conversation processing pipeline.
   * Relies on _validateApiKey which should be implemented by subclasses.
   * @returns {Promise<boolean>} Whether credentials are valid
   */
  async validateCredentials() {
    try {
      const { apiKey } = this.credentials;
      if (!apiKey) {
        this.logger.warn('No API key provided for validation');
        return false;
      }
      
      // Platform-specific validation should be implemented in subclasses
      // This lightweight validation doesn't use the full content processing pipeline
      const isValid = await this._validateApiKey(apiKey);
      return isValid;
    } catch (error) {
      this.logger.error('Error validating credentials:', error);
      return false;
    }
  }
  
  /**
   * Validate an API key with a minimal request
   * This method should be implemented by subclasses
   * @protected
   * @param {string} apiKey - The API key to validate
   * @returns {Promise<boolean>} Whether the API key is valid
   */
  async _validateApiKey(apiKey) {
    try {
      // Get the default model from config
      if (!this.config) {
        this.config = await this._loadPlatformConfig();
      }
      
      // Get default model from platform config
      const defaultModel = this.config?.defaultModel;
      if (!defaultModel) {
        this.logger.warn('No default model found in configuration');
        return false;
      }
      
      // Each platform must implement its own validation logic
      return await this._validateWithModel(apiKey, defaultModel);
    } catch (error) {
      this.logger.error('Error validating API key:', error);
      return false;
    }
  }
  
  /**
   * Platform-specific validation implementation
   * @protected
   * @param {string} apiKey - The API key to validate
   * @param {string} model - The model to use for validation
   * @returns {Promise<boolean>} Whether the API key is valid
   */
  async _validateWithModel(apiKey, model) {
    throw new Error('_validateWithModel must be implemented by subclasses');
  }

  /**
   * Process with model-specific parameters with streaming support
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters with conversation history
   * @param {function} onChunk - Callback function for receiving text chunks
   * @param {AbortSignal} [abortSignal] - Optional AbortSignal for cancellation
   * @returns {Promise<Object>} API response metadata
   */
  async _processWithModelStreaming(text, params, apiKey, onChunk, abortSignal) {
    throw new Error('_processWithModelStreaming must be implemented by subclasses');
  }

  /**
   * Create a logger instance
   * @returns {Object} Logger object
   */
  _createLogger() {
    return {
      info: (message, data = null) => console.log(`[${this.platformId}-api] INFO: ${message}`, data || ''),
      warn: (message, data = null) => console.warn(`[${this.platformId}-api] WARN: ${message}`, data || ''),
      error: (message, data = null) => console.error(`[${this.platformId}-api] ERROR: ${message}`, data || '')
    };
  }

  /**
   * Load platform API configuration
   * @returns {Promise<Object>} Platform API configuration
   */
  async _loadPlatformConfig() {
    try {
      const response = await fetch(chrome.runtime.getURL('platform-config.json'));
      const config = await response.json();
      return config.aiPlatforms[this.platformId].api;
    } catch (error) {
      this.logger.error('Error loading platform config:', error);
      return null;
    }
  }
}

module.exports = BaseApiService;

const ApiInterface = require('./api-interface');
const { extractApiErrorMessage } = require('../shared/utils/error-utils');

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
   * @param {AbortSignal} [requestConfig.abortSignal] - Optional AbortSignal for cancellation
   * @returns {Promise<Object>} Object indicating success or failure, including the model used.
   */
  async processRequest(requestConfig) {
    const { prompt, resolvedParams, formattedContent, onChunk, abortSignal } = requestConfig;
    const { apiKey } = this.credentials;
    const model = resolvedParams?.model; // Get model early for error reporting

    try {
      // Validate essential parts of the config
      if (!requestConfig || !resolvedParams || !prompt || !onChunk) {
        throw new Error('Invalid requestConfig provided to BaseApiService.processRequest');
      }
      if (!apiKey) {
        throw new Error('API key not available in BaseApiService');
      }

      // Create the final prompt including formatted content if available
      const structuredPrompt = this._createStructuredPrompt(prompt, formattedContent);

      this.logger.info(`Processing request for model ${model} with${formattedContent ? ' included' : 'out'} content.`);

      // 1. Build the platform-specific request options
      const fetchOptions = await this._buildApiRequest(structuredPrompt, resolvedParams, apiKey);

      // 2. Execute the streaming request using the common logic
      await this._executeStreamingRequest(fetchOptions, onChunk, abortSignal, model);

      // If _executeStreamingRequest completes without throwing, it means the stream finished successfully (or handled its own errors via onChunk)
      this.logger.info(`Streaming request for model ${model} completed.`);
      return { success: true, model: model };

    } catch (error) {
      this.logger.error(`Error in BaseApiService.processRequest for model ${model}:`, error);
      // Ensure onChunk is called with the error if it hasn't been already
      // (e.g., if _buildApiRequest fails)
      if (onChunk && typeof onChunk === 'function') {
        onChunk({
          done: true,
          error: `API Request Setup Error: ${error.message}`,
          model: model || 'unknown' // Use model if available
        });
      }
      // Return a failure object
      return {
        success: false,
        error: `API Request Setup Error: ${error.message}`,
        model: model || 'unknown'
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
      return `# INSTRUCTION
      ${prompt}
      # EXTRACTED CONTENT
      ${formattedContent}
      # END CONTENT`
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

  // --- Abstract Methods for Subclasses ---

  /**
   * Build the platform-specific API request options.
   * Must be implemented by subclasses.
   * @protected
   * @abstract
   * @param {string} prompt - The final structured prompt.
   * @param {Object} params - Resolved model parameters (model, temp, history, etc.).
   * @param {string} apiKey - The API key.
   * @returns {Promise<Object>} An object like { url: string, method: string, headers: Object, body: string }.
   */
  async _buildApiRequest(prompt, params, apiKey) {
    throw new Error('_buildApiRequest must be implemented by subclasses');
  }

  /**
   * Parse a single line/chunk from the API stream.
   * Must be implemented by subclasses.
   * @protected
   * @abstract
   * @param {string} line - A single line string from the stream.
   * @returns {Object} An object like { type: 'content' | 'error' | 'done' | 'ignore', chunk?: string, error?: string }.
   */
  _parseStreamChunk(line) {
    throw new Error('_parseStreamChunk must be implemented by subclasses');
  }

  // --- Core Streaming Logic ---

  /**
   * Executes the streaming fetch request and processes the response stream.
   * @protected
   * @param {Object} fetchOptions - The options returned by _buildApiRequest { url, method, headers, body }.
   * @param {Function} onChunk - The callback function to send data/status updates.
   * @param {AbortSignal} abortSignal - The signal to abort the fetch request.
   * @param {string} model - The model being used (for logging and onChunk).
   * @returns {Promise<boolean>} Resolves true on successful stream completion, throws or rejects on critical errors.
   */
  async _executeStreamingRequest(fetchOptions, onChunk, abortSignal, model) {
    let reader;
    let accumulatedContent = ""; // Keep track of content for final successful chunk
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      this.logger.info(`Executing streaming request to ${fetchOptions.url} for model ${model}`);

      const response = await fetch(fetchOptions.url, {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body,
        signal: abortSignal
      });

      // Handle non-OK initial responses
      if (!response.ok) {
        const errorMessage = await extractApiErrorMessage(response);
        this.logger.error(`API Error (${response.status}) for model ${model}: ${errorMessage}`, response);
        onChunk({ done: true, error: errorMessage, model });
        // Throw an error to signal failure in processRequest
        throw new Error(`API request failed with status ${response.status}: ${errorMessage}`);
      }

      if (!response.body) {
        throw new Error('Response body is null or undefined.');
      }

      reader = response.body.getReader();

      // Stream reading loop
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.logger.info(`Stream finished for model ${model}.`);
          // Process any remaining buffer content if necessary (though usually handled by line splitting)
          if (buffer.trim()) {
             this.logger.warn(`Processing remaining buffer content after stream end for model ${model}: "${buffer}"`);
             // Attempt to parse the final bit if it seems relevant
             try {
                const parsedResult = this._parseStreamChunk(buffer.trim());
                if (parsedResult.type === 'content' && parsedResult.chunk) {
                    accumulatedContent += parsedResult.chunk;
                    onChunk({ chunk: parsedResult.chunk, done: false, model });
                } else if (parsedResult.type === 'error' && parsedResult.error) {
                    onChunk({ done: true, error: parsedResult.error, model });
                    // Don't signal final success below if an error occurred here
                    return false; // Indicate handled error
                }
             } catch (parseError) {
                 this.logger.error(`Error parsing final buffer chunk for model ${model}:`, parseError, 'Buffer:', buffer);
                 // Decide if this constitutes a stream failure
                 onChunk({ done: true, error: `Error parsing final stream data: ${parseError.message}`, model });
                 return false; // Indicate handled error
             }
          }
          // Signal successful completion
          onChunk({ chunk: '', done: true, model, fullContent: accumulatedContent });
          break; // Exit the loop
        }

        buffer += decoder.decode(value, { stream: true });
        let lineEnd;

        // Process lines separated by newline characters
        while ((lineEnd = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, lineEnd).trim();
          buffer = buffer.substring(lineEnd + 1);

          if (!line) continue; // Skip empty lines

          try {
            const parsedResult = this._parseStreamChunk(line);

            switch (parsedResult.type) {
              case 'content':
                if (parsedResult.chunk) {
                  accumulatedContent += parsedResult.chunk;
                  onChunk({ chunk: parsedResult.chunk, done: false, model });
                }
                break;
              case 'error':
                this.logger.error(`Parsed stream error for model ${model}: ${parsedResult.error}`);
                onChunk({ done: true, error: parsedResult.error, model });
                // Critical error from the stream, stop processing.
                // Release lock in finally block.
                return false; // Indicate handled error, stop processing loop
              case 'done':
                // Platform indicated done, but we wait for the reader to confirm.
                this.logger.info(`Platform signaled stream end for model ${model}. Line: "${line}"`);
                // Do not break here; let the reader.read() loop determine final 'done'.
                break;
              case 'ignore':
                // Ignore pings, comments, or irrelevant lines
                break;
              default:
                this.logger.warn(`Unknown parsed chunk type: ${parsedResult.type} for model ${model}. Line: "${line}"`);
            }
          } catch (parseError) {
            this.logger.error(`Error parsing stream chunk for model ${model}:`, parseError, 'Line:', line);
            // Decide if this is fatal. For now, send error and stop.
            onChunk({ done: true, error: `Error parsing stream data: ${parseError.message}`, model });
            return false; // Indicate handled error, stop processing loop
          }
        } // end while(lineEnd)
      } // end while(true)

      return true; // Signal successful completion of the stream

    } catch (error) {
      if (error.name === 'AbortError') {
        this.logger.info(`API request cancelled by user for model ${model}.`);
        onChunk({ done: true, error: 'Cancelled by user', model });
      } else {
        this.logger.error(`Unhandled streaming error for model ${model}:`, error);
        onChunk({ done: true, error: error.message || 'An unknown streaming error occurred', model });
      }
      // Re-throw the error so processRequest catches it and returns a failure object
      // unless it was an AbortError or an error already handled via onChunk and returning false.
      if (error.name !== 'AbortError') {
          throw error; // Propagate unexpected errors
      }
      return false; // Indicate handled error (AbortError)
    } finally {
      if (reader) {
        try {
          // Ensure the reader lock is always released
          reader.releaseLock();
        } catch (releaseError) {
          this.logger.error(`Error releasing stream reader lock for model ${model}:`, releaseError);
        }
      }
    }
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

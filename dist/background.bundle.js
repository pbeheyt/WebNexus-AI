/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/api/api-base.js":
/*!*****************************!*\
  !*** ./src/api/api-base.js ***!
  \*****************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/api/api-base.js
const ApiInterface = __webpack_require__(/*! ./api-interface */ "./src/api/api-interface.js");
const {
  extractApiErrorMessage
} = __webpack_require__(/*! ../shared/utils/error-utils */ "./src/shared/utils/error-utils.js");
const ConfigService = __webpack_require__(/*! ../services/ConfigService */ "./src/services/ConfigService.js");
const logger = (__webpack_require__(/*! ../shared/logger */ "./src/shared/logger.js").api);

/**
 * Base class with shared API functionality
 */
class BaseApiService extends ApiInterface {
  constructor(platformId) {
    super();
    this.platformId = platformId;
    // Assign the shared logger directly
    this.logger = logger;
    this.credentials = null;
    this.config = null;
  }
  async initialize(credentials) {
    this.credentials = credentials;
    this.config = await ConfigService.getPlatformApiConfig(this.platformId);
    // Update log call to include platformId
    this.logger.info(`[${this.platformId}] API service initialized`);
  }
  async processRequest(requestConfig) {
    const {
      prompt,
      resolvedParams,
      formattedContent,
      onChunk,
      abortSignal
    } = requestConfig;
    const {
      apiKey
    } = this.credentials;
    const model = resolvedParams?.model;
    try {
      if (!requestConfig || !resolvedParams || !prompt || !onChunk) {
        throw new Error(`[${this.platformId}] Invalid requestConfig provided to BaseApiService.processRequest`);
      }
      if (!apiKey) {
        throw new Error(`[${this.platformId}] API key not available in BaseApiService`);
      }
      const structuredPrompt = this._createStructuredPrompt(prompt, formattedContent);
      // Update log call
      this.logger.info(`[${this.platformId}] Processing request for model ${model} with${formattedContent ? ' included' : 'out'} content.`);
      const fetchOptions = await this._buildApiRequest(structuredPrompt, resolvedParams, apiKey);
      await this._executeStreamingRequest(fetchOptions, onChunk, abortSignal, model);

      // Update log call
      this.logger.info(`[${this.platformId}] Streaming request for model ${model} completed.`);
      return {
        success: true,
        model: model
      };
    } catch (error) {
      // Update log call
      this.logger.error(`[${this.platformId}] Error in BaseApiService.processRequest for model ${model}:`, error);
      if (onChunk && typeof onChunk === 'function') {
        onChunk({
          done: true,
          error: `API Request Setup Error: ${error.message}`,
          model: model || 'unknown'
        });
      }
      return {
        success: false,
        error: `API Request Setup Error: ${error.message}`,
        model: model || 'unknown'
      };
    }
  }
  _createStructuredPrompt(prompt, formattedContent) {
    if (typeof formattedContent === 'string' && formattedContent.trim().length > 0) {
      return `# INSTRUCTION\n${prompt}\n# EXTRACTED CONTENT\n${formattedContent}`;
    } else {
      return prompt;
    }
  }
  async validateCredentials() {
    try {
      const {
        apiKey
      } = this.credentials;
      if (!apiKey) {
        this.logger.warn(`[${this.platformId}] No API key provided for validation`);
        return false;
      }
      const isValid = await this._validateApiKey(apiKey);
      return isValid;
    } catch (error) {
      this.logger.error(`[${this.platformId}] Error validating credentials:`, error);
      return false;
    }
  }
  async _validateApiKey(apiKey) {
    try {
      const defaultModel = this.config?.defaultModel;
      if (!defaultModel) {
        this.logger.warn(`[${this.platformId}] No default model found in configuration`);
        return false;
      }
      return await this._validateWithModel(apiKey, defaultModel);
    } catch (error) {
      this.logger.error(`[${this.platformId}] Error validating API key:`, error);
      return false;
    }
  }
  async _validateWithModel(apiKey, model) {
    try {
      this.logger.info(`[${this.platformId}] Attempting API key validation for model ${model}...`);
      const fetchOptions = await this._buildValidationRequest(apiKey, model);
      const response = await fetch(fetchOptions.url, {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body
      });
      if (response.ok) {
        this.logger.info(`[${this.platformId}] API key validation successful for model ${model} (Status: ${response.status})`);
        return true;
      } else {
        const errorMessage = await extractApiErrorMessage(response);
        this.logger.warn(`[${this.platformId}] API key validation failed for model ${model} (Status: ${response.status}): ${errorMessage}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`[${this.platformId}] API key validation error for model ${model}:`, error);
      return false;
    }
  }
  async _buildValidationRequest(apiKey, model) {
    throw new Error('_buildValidationRequest must be implemented by subclasses');
  }
  async _buildApiRequest(prompt, params, apiKey) {
    throw new Error('_buildApiRequest must be implemented by subclasses');
  }
  _parseStreamChunk(line) {
    throw new Error('_parseStreamChunk must be implemented by subclasses');
  }
  _resetStreamState() {
    // Base implementation does nothing. Subclasses can override.
  }

  /**
   * Processes a parsed result from _parseStreamChunk, handling single or multiple chunks.
   * @param {Object} parsedResult - The result from _parseStreamChunk.
   * @param {Function} onChunk - The callback to send data to.
   * @param {string} model - The model being used.
   * @param {string} accumulatedContent - The current accumulated content string (will be updated).
   * @returns {string} The updated accumulatedContent.
   * @private
   */
  _handleParsedChunk(parsedResult, onChunk, model, accumulatedContent) {
    if (parsedResult.type === 'content') {
      if (Array.isArray(parsedResult.chunks)) {
        for (const subChunk of parsedResult.chunks) {
          if (subChunk && subChunk.length > 0) {
            accumulatedContent += subChunk;
            onChunk({
              chunk: subChunk,
              done: false,
              model
            });
          }
        }
      } else if (parsedResult.chunk) {
        // Handle single chunk (standard case for other APIs)
        accumulatedContent += parsedResult.chunk;
        onChunk({
          chunk: parsedResult.chunk,
          done: false,
          model
        });
      }
    }
    return accumulatedContent;
  }
  async _executeStreamingRequest(fetchOptions, onChunk, abortSignal, model) {
    let reader;
    let accumulatedContent = "";
    const decoder = new TextDecoder("utf-8");
    let buffer = ""; // Buffer for non-Gemini platforms

    if (typeof this._resetStreamState === 'function') {
      // Update log call
      this.logger.info(`[${this.platformId}] Resetting stream state`);
      this._resetStreamState();
    }
    try {
      // Update log call
      this.logger.info(`[${this.platformId}] Executing streaming request to ${fetchOptions.url} for model ${model}`);
      const response = await fetch(fetchOptions.url, {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body,
        signal: abortSignal
      });
      if (!response.ok) {
        const errorMessage = await extractApiErrorMessage(response);
        // Update log call
        this.logger.error(`[${this.platformId}] API Error (${response.status}) for model ${model}: ${errorMessage}`, response);
        onChunk({
          done: true,
          error: errorMessage,
          model
        });
        throw new Error(`API request failed with status ${response.status}: ${errorMessage}`);
      }
      if (!response.body) throw new Error('Response body is null or undefined.');
      reader = response.body.getReader();
      while (true) {
        const {
          done,
          value
        } = await reader.read();
        if (done) {
          // Update log call
          this.logger.info(`[${this.platformId}] Stream finished naturally for model ${model}.`);
          // Final buffer processing for all platforms
          if (buffer.trim()) {
            // Update log call
            this.logger.warn(`[${this.platformId}] Processing remaining buffer content after stream end for model ${model}: "${buffer}"`);
            try {
              const parsedResult = this._parseStreamChunk(buffer.trim());
              accumulatedContent = this._handleParsedChunk(parsedResult, onChunk, model, accumulatedContent);
              if (parsedResult.type === 'error') {
                onChunk({
                  done: true,
                  error: parsedResult.error,
                  model
                });
                return false;
              }
            } catch (parseError) {
              // Update log call
              this.logger.error(`[${this.platformId}] Error parsing final buffer chunk for model ${model}:`, parseError, 'Buffer:', buffer);
              onChunk({
                done: true,
                error: `Error parsing final stream data: ${parseError.message}`,
                model
              });
              return false;
            }
          }
          onChunk({
            chunk: '',
            done: true,
            model,
            fullContent: accumulatedContent
          });
          break; // Exit the loop
        }
        const decodedChunk = decoder.decode(value, {
          stream: true
        });

        // Standard SSE handling for all platforms
        buffer += decodedChunk;
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, lineEnd).trim();
          buffer = buffer.substring(lineEnd + 1);
          if (!line) continue;
          try {
            const parsedResult = this._parseStreamChunk(line);
            accumulatedContent = this._handleParsedChunk(parsedResult, onChunk, model, accumulatedContent);
            if (parsedResult.type === 'error') {
              // Update log call
              this.logger.error(`[${this.platformId}] Parsed stream error for model ${model}: ${parsedResult.error}`);
              onChunk({
                done: true,
                error: parsedResult.error,
                model
              });
              return false; // Stop processing loop
            }
            // Ignore 'done' and 'ignore' types here
          } catch (parseError) {
            // Update log call
            this.logger.error(`[${this.platformId}] Error parsing stream chunk for model ${model}:`, parseError, 'Line:', line);
            onChunk({
              done: true,
              error: `Error parsing stream data: ${parseError.message}`,
              model
            });
            return false; // Stop processing loop
          }
        }
      }
      return true; // Signal successful completion
    } catch (error) {
      // Handle AbortError specifically
      if (error.name === 'AbortError') {
        this.logger.info(`[${this.platformId}] API request cancelled by user (AbortError) for model ${model}.`);
        // Send a specific 'Cancelled by user' message via onChunk
        onChunk({
          done: true,
          error: 'Cancelled by user',
          model
        });
        // No need to re-throw AbortError, it's handled.
      } else {
        // Handle other errors during fetch or reading
        this.logger.error(`[${this.platformId}] Unhandled streaming error for model ${model}:`, error);
        onChunk({
          done: true,
          error: error.message || 'An unknown streaming error occurred',
          model
        });
        // Re-throw other errors to be caught by the outer try/catch in processRequest
        throw error;
      }
      return false; // Indicate handled error (AbortError) or that an error occurred
    } finally {
      // Cleanup: Attempt to cancel the reader if it exists.
      if (reader) {
        try {
          // Attempt to cancel the reader. This also releases the lock.
          await reader.cancel();
          this.logger.info(`[${this.platformId}] Stream reader cancelled successfully for model ${model}.`);
        } catch (cancelError) {
          this.logger.warn(`[${this.platformId}] Error cancelling stream reader for model ${model} (potentially expected after abort):`, cancelError);
        }
        // No need for releaseLock() as cancel() handles it.
      } else {
        // Update log call
        this.logger.info(`[${this.platformId}] No active reader found in finally block for model ${model}.`);
      }
    }
  }
}
module.exports = BaseApiService;

/***/ }),

/***/ "./src/api/api-factory.js":
/*!********************************!*\
  !*** ./src/api/api-factory.js ***!
  \********************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/api/api-factory.js

const BaseApiService = __webpack_require__(/*! ./api-base */ "./src/api/api-base.js");
const ChatGptApiService = __webpack_require__(/*! ./implementations/chatgpt-api */ "./src/api/implementations/chatgpt-api.js");
const ClaudeApiService = __webpack_require__(/*! ./implementations/claude-api */ "./src/api/implementations/claude-api.js");
const GeminiApiService = __webpack_require__(/*! ./implementations/gemini-api */ "./src/api/implementations/gemini-api.js");
const MistralApiService = __webpack_require__(/*! ./implementations/mistral-api */ "./src/api/implementations/mistral-api.js");
const DeepSeekApiService = __webpack_require__(/*! ./implementations/deepseek-api */ "./src/api/implementations/deepseek-api.js");
const GrokApiService = __webpack_require__(/*! ./implementations/grok-api */ "./src/api/implementations/grok-api.js");

/**
 * Factory class for creating API service instances
 */
class ApiFactory {
  /**
   * Create an API service instance for the specified platform
   * @param {string} platformId - Platform identifier (e.g., 'chatgpt', 'claude')
   * @returns {BaseApiService} API service instance
   * @throws {Error} If platform is not supported
   */
  static createApiService(platformId) {
    switch (platformId.toLowerCase()) {
      case 'chatgpt':
        return new ChatGptApiService();
      case 'claude':
        return new ClaudeApiService();
      case 'gemini':
        return new GeminiApiService();
      case 'mistral':
        return new MistralApiService();
      case 'deepseek':
        return new DeepSeekApiService();
      case 'grok':
        return new GrokApiService();
      default:
        throw new Error(`Unsupported API platform: ${platformId}`);
    }
  }
}
module.exports = ApiFactory;

/***/ }),

/***/ "./src/api/api-interface.js":
/*!**********************************!*\
  !*** ./src/api/api-interface.js ***!
  \**********************************/
/***/ ((module) => {

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
  async processRequest(requestConfig) {
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
module.exports = ApiInterface;

/***/ }),

/***/ "./src/api/implementations/chatgpt-api.js":
/*!************************************************!*\
  !*** ./src/api/implementations/chatgpt-api.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const BaseApiService = __webpack_require__(/*! ../api-base */ "./src/api/api-base.js");

/**
 * ChatGPT API implementation
 */
class ChatGptApiService extends BaseApiService {
  constructor() {
    super('chatgpt');
  }

  /**
   * Build the platform-specific API request options for ChatGPT.
   * @override
   * @protected
   * @param {string} prompt - The final structured prompt.
   * @param {Object} params - Resolved model parameters (model, temp, history, etc.).
   * @param {string} apiKey - The API key.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildApiRequest(prompt, params, apiKey) {
    const endpoint = this.config?.endpoint || 'https://api.openai.com/v1/chat/completions';
    this.logger.info(`[${this.platformId}] Building API request for model: ${params.model}`);
    const requestPayload = {
      model: params.model,
      stream: true
    };
    const messages = [];
    if (params.systemPrompt) {
      messages.push({
        role: 'system',
        content: params.systemPrompt
      });
    }
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      messages.push(...this._formatOpenAIMessages(params.conversationHistory));
    }
    messages.push({
      role: 'user',
      content: prompt
    }); // Use the structured prompt
    requestPayload.messages = messages;

    // Apply model parameters
    if (params.parameterStyle === 'reasoning') {
      requestPayload[params.tokenParameter || 'max_completion_tokens'] = params.maxTokens;
    } else {
      requestPayload[params.tokenParameter || 'max_tokens'] = params.maxTokens;
      if ('temperature' in params) {
        requestPayload.temperature = params.temperature;
      }
      if ('topP' in params) {
        requestPayload.top_p = params.topP;
      }
    }
    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestPayload)
    };
  }

  /**
   * Parse a single line/chunk from the ChatGPT API stream.
   * @override
   * @protected
   * @param {string} line - A single line string from the stream.
   * @returns {Object} Parsed result: { type: 'content' | 'done' | 'ignore', chunk?: string }.
   */
  _parseStreamChunk(line) {
    if (!line) {
      return {
        type: 'ignore'
      };
    }

    // OpenAI uses 'data: [DONE]' to signal the end of the stream content
    if (line === 'data: [DONE]') {
      return {
        type: 'done'
      }; // Signal done, but let the reader confirm stream end
    }
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.substring(6));
        const content = data.choices?.[0]?.delta?.content;
        if (content) {
          return {
            type: 'content',
            chunk: content
          };
        } else {
          // Ignore chunks without content (e.g., role markers, finish_reason)
          return {
            type: 'ignore'
          };
        }
      } catch (e) {
        this.logger.error(`[${this.platformId}] Error parsing stream chunk:`, e, 'Line:', line);
        // Treat parsing errors as stream errors - return error type
        return {
          type: 'error',
          error: `Error parsing stream data: ${e.message}`
        };
      }
    }

    // Ignore lines that don't start with 'data: ' (e.g., potential comments or empty lines already handled)
    return {
      type: 'ignore'
    };
  }

  /**
   * Format conversation history for OpenAI API
   * @param {Array} history - Conversation history array
   * @returns {Array} Formatted messages for OpenAI API
   */
  _formatOpenAIMessages(history) {
    return history.map(msg => {
      // Map internal role names to OpenAI roles
      let role = 'user';
      if (msg.role === 'assistant') role = 'assistant';else if (msg.role === 'system') role = 'system';
      return {
        role,
        content: msg.content
      };
    });
  }

  /**
   * Build the platform-specific API request options for validation.
   * @override
   * @protected
   * @param {string} apiKey - The API key to validate.
   * @param {string} model - The model to use for validation.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildValidationRequest(apiKey, model) {
    const endpoint = this.config?.endpoint || 'https://api.openai.com/v1/chat/completions';
    const validationPayload = {
      model: model,
      messages: [{
        role: 'user',
        content: 'API validation check'
      }],
      max_tokens: 1 // Minimum tokens
    };
    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(validationPayload)
    };
  }
}
module.exports = ChatGptApiService;

/***/ }),

/***/ "./src/api/implementations/claude-api.js":
/*!***********************************************!*\
  !*** ./src/api/implementations/claude-api.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const BaseApiService = __webpack_require__(/*! ../api-base */ "./src/api/api-base.js");

/**
 * Claude API implementation
 */
class ClaudeApiService extends BaseApiService {
  constructor() {
    super('claude');
  }

  /**
   * Build the platform-specific API request options for Claude.
   * @override
   * @protected
   * @param {string} prompt - The final structured prompt.
   * @param {Object} params - Resolved model parameters (model, temp, history, etc.).
   * @param {string} apiKey - The API key.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildApiRequest(prompt, params, apiKey) {
    const endpoint = this.config?.endpoint || 'https://api.anthropic.com/v1/messages';
    this.logger.info(`[${this.platformId}] Building API request for model: ${params.model}`);
    const requestPayload = {
      model: params.model,
      max_tokens: params.maxTokens,
      messages: [{
        role: 'user',
        content: [{
          type: "text",
          text: prompt
        }]
      }],
      // Start with current prompt
      stream: true
    };

    // Apply optional parameters
    if ('temperature' in params) {
      requestPayload.temperature = params.temperature;
    }
    if ('topP' in params) {
      requestPayload.top_p = params.topP;
    }
    if (params.systemPrompt) {
      requestPayload.system = params.systemPrompt;
    }

    // Prepend conversation history if available
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      // Use the helper to format history and add the current prompt correctly
      requestPayload.messages = this._formatClaudeMessages(params.conversationHistory, prompt);
    }
    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true' // Required for direct browser calls
      },
      body: JSON.stringify(requestPayload)
    };
  }

  /**
   * Parse a single line/chunk from the Claude API stream.
   * Handles Server-Sent Events (SSE) format used by Claude.
   * @override
   * @protected
   * @param {string} line - A single line string from the stream.
   * @returns {Object} Parsed result: { type: 'content' | 'error' | 'done' | 'ignore', chunk?: string, error?: string }.
   */
  _parseStreamChunk(line) {
    if (!line) {
      return {
        type: 'ignore'
      };
    }

    // Claude uses event types
    if (line.startsWith('event: ')) {
      const eventType = line.substring(7).trim();
      // We only care about the data associated with specific events.
      // 'message_stop' signals completion, but we let the reader handle the actual stream end.
      // 'ping' can be ignored.
      if (eventType === 'message_stop') {
        return {
          type: 'done'
        }; // Signal potential end, base class waits for reader
      }
      // Other events like 'message_start', 'content_block_start/stop' are ignored for now.
      return {
        type: 'ignore'
      };
    }
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.substring(6));

        // Check for content delta
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
          const content = data.delta.text;
          return content ? {
            type: 'content',
            chunk: content
          } : {
            type: 'ignore'
          };
        }

        // Check for errors reported within the stream
        if (data.type === 'error') {
          const streamErrorMessage = `Stream error: ${data.error?.type} - ${data.error?.message || 'Unknown stream error'}`;
          this.logger.error(`[${this.platformId}] ${streamErrorMessage}`, data.error);
          return {
            type: 'error',
            error: streamErrorMessage
          };
        }

        // Ignore other data types like 'message_delta' (stop_reason is handled by 'message_stop' event or reader end)
        return {
          type: 'ignore'
        };
      } catch (e) {
        // Update log call
        this.logger.error(`[${this.platformId}] Error parsing stream chunk:`, e, 'Line:', line);
        return {
          type: 'error',
          error: `Error parsing stream data: ${e.message}`
        };
      }
    }

    // Ignore lines that are not 'event:' or 'data:'
    return {
      type: 'ignore'
    };
  }

  /**
   * Format conversation history for Claude API
   * @param {Array} history - Conversation history array
   * @param {string} currentPrompt - Current user prompt
   * @returns {Array} Formatted messages for Claude API
   */
  _formatClaudeMessages(history, currentPrompt) {
    const formattedMessages = [];

    // Process conversation history
    for (const message of history) {
      // Map internal role to Claude role
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      formattedMessages.push({
        role: role,
        content: [{
          type: "text",
          text: message.content
        }]
      });
    }

    // Add current prompt as the final user message
    formattedMessages.push({
      role: 'user',
      content: [{
        type: "text",
        text: currentPrompt
      }]
    });
    return formattedMessages;
  }

  /**
   * Build the platform-specific API request options for validation.
   * @override
   * @protected
   * @param {string} apiKey - The API key to validate.
   * @param {string} model - The model to use for validation.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildValidationRequest(apiKey, model) {
    const endpoint = this.config?.endpoint || 'https://api.anthropic.com/v1/messages';
    const validationPayload = {
      model: model,
      max_tokens: 1,
      // Minimum tokens needed
      messages: [{
        role: 'user',
        content: [{
          type: "text",
          text: "API validation check"
        }]
      }]
    };
    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true' // Required for direct browser calls
      },
      body: JSON.stringify(validationPayload)
    };
  }
}
module.exports = ClaudeApiService;

/***/ }),

/***/ "./src/api/implementations/deepseek-api.js":
/*!*************************************************!*\
  !*** ./src/api/implementations/deepseek-api.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const BaseApiService = __webpack_require__(/*! ../api-base */ "./src/api/api-base.js");

/**
 * DeepSeek API implementation
 */
class DeepSeekApiService extends BaseApiService {
  constructor() {
    super('deepseek');
  }

  /**
   * Build the platform-specific API request options for DeepSeek.
   * Handles merging consecutive user messages as required by the API.
   * @override
   * @protected
   * @param {string} prompt - The final structured prompt (current user input).
   * @param {Object} params - Resolved model parameters (model, temp, history, etc.).
   * @param {string} apiKey - The API key.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildApiRequest(prompt, params, apiKey) {
    const endpoint = this.config?.endpoint || 'https://api.deepseek.com/v1/chat/completions';
    this.logger.info(`[${this.platformId}] Building API request for model: ${params.model}`);
    const requestPayload = {
      model: params.model,
      stream: true
    };
    let messages = [];
    // Add system prompt first if it exists
    if (params.systemPrompt) {
      messages.push({
        role: 'system',
        content: params.systemPrompt
      });
    }

    // Format history, merging consecutive roles (excluding system)
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      messages.push(...this._formatDeepSeekMessages(params.conversationHistory));
    }

    // Now, handle the current user prompt, merging if necessary
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    if (lastMessage && lastMessage.role === 'user') {
      // Merge the current prompt into the last user message
      this.logger.info(`[${this.platformId}] Merging current user prompt with previous user message for DeepSeek compatibility.`);
      lastMessage.content += `\n\n${prompt}`; // Append the new prompt text
    } else {
      // Add the current prompt as a new user message
      messages.push({
        role: 'user',
        content: prompt
      });
    }

    // Assign the final message list to the payload
    requestPayload.messages = messages;

    // Apply other parameters
    requestPayload[params.tokenParameter || 'max_tokens'] = params.maxTokens;
    if ('temperature' in params) {
      requestPayload.temperature = params.temperature;
    }
    if ('topP' in params) {
      requestPayload.top_p = params.topP;
    }
    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestPayload)
    };
  }

  /**
   * Parse a single line/chunk from the DeepSeek API stream.
   * Similar format to OpenAI.
   * @override
   * @protected
   * @param {string} line - A single line string from the stream.
   * @returns {Object} Parsed result: { type: 'content' | 'done' | 'ignore' | 'error', chunk?: string, error?: string }.
   */
  _parseStreamChunk(line) {
    if (!line) {
      return {
        type: 'ignore'
      };
    }

    // DeepSeek also uses 'data: [DONE]'
    if (line === 'data: [DONE]') {
      return {
        type: 'done'
      };
    }
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.substring(6));
        const content = data.choices?.[0]?.delta?.content;
        if (content) {
          return {
            type: 'content',
            chunk: content
          };
        } else {
          // Ignore chunks without content (like finish_reason markers)
          if (data.choices?.[0]?.finish_reason) {
            this.logger.info(`[${this.platformId}] Stream finished with reason: ${data.choices[0].finish_reason}`);
          }
          return {
            type: 'ignore'
          };
        }
      } catch (e) {
        this.logger.error(`[${this.platformId}] Error parsing stream chunk:`, e, 'Line:', line);
        return {
          type: 'error',
          error: `Error parsing stream data: ${e.message}`
        };
      }
    }
    return {
      type: 'ignore'
    };
  }

  /**
   * Format conversation history for DeepSeek API, merging consecutive messages of the same role.
   * Skips system messages or unknown roles found within the history.
   * @param {Array} history - Conversation history array
   * @returns {Array} Formatted messages for DeepSeek API
   */
  _formatDeepSeekMessages(history) {
    const formattedMessages = [];
    // Update log call
    this.logger.info(`[${this.platformId}] Formatting ${history.length} history messages, merging consecutive roles.`);
    for (const msg of history) {
      let apiRole;
      // Map internal roles to API roles, skipping system/unknown messages within history
      if (msg.role === 'user') {
        apiRole = 'user';
      } else if (msg.role === 'assistant') {
        apiRole = 'assistant';
      } else {
        this.logger.warn(`[${this.platformId}] Skipping message with role '${msg.role || 'unknown'}' found within conversation history for API call.`);
        continue; // Skip system or unknown roles
      }
      const lastMessage = formattedMessages.length > 0 ? formattedMessages[formattedMessages.length - 1] : null;

      // Check if the last message exists and has the same role as the current message
      if (lastMessage && lastMessage.role === apiRole) {
        // Merge content with the last message
        this.logger.info(`[${this.platformId}] Merging consecutive '${apiRole}' message content for compatibility.`);
        lastMessage.content += `\n\n${msg.content}`; // Append content
      } else {
        // Add as a new message if roles differ or it's the first message
        formattedMessages.push({
          role: apiRole,
          content: msg.content
        });
      }
    }

    // Final check for alternation (optional, but good for debugging)
    for (let i = 0; i < formattedMessages.length - 1; i++) {
      if (formattedMessages[i].role === formattedMessages[i + 1].role) {
        // Update log call
        this.logger.error(`[${this.platformId}] Formatting failed: Consecutive roles found after merge at index ${i}. Role: ${formattedMessages[i].role}`);
        // Handle error case if needed, e.g., return only valid prefix
      }
    }
    this.logger.info(`[${this.platformId}] Formatted history contains ${formattedMessages.length} messages after merging.`);
    return formattedMessages;
  }

  /**
   * Build the platform-specific API request options for validation.
   * @override
   * @protected
   * @param {string} apiKey - The API key to validate.
   * @param {string} model - The model to use for validation.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildValidationRequest(apiKey, model) {
    const endpoint = this.config?.endpoint || 'https://api.deepseek.com/v1/chat/completions';
    const validationPayload = {
      model: model,
      messages: [{
        role: 'user',
        content: 'API validation check'
      }],
      max_tokens: 1 // Minimum tokens needed
    };
    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(validationPayload)
    };
  }
}
module.exports = DeepSeekApiService;

/***/ }),

/***/ "./src/api/implementations/gemini-api.js":
/*!***********************************************!*\
  !*** ./src/api/implementations/gemini-api.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/api/implementations/gemini-api.js
const BaseApiService = __webpack_require__(/*! ../api-base */ "./src/api/api-base.js");

/**
 * Gemini API implementation
 */
class GeminiApiService extends BaseApiService {
  constructor() {
    super('gemini');
  }
  _getGeminiEndpoint(model, method) {
    const baseTemplate = "https://generativelanguage.googleapis.com/{version}/models/{model}{method}";
    if (!model || !method) {
      throw new Error("Model and method are required to build Gemini endpoint.");
    }
    const isExperimental = model.includes('-exp-');
    const apiVersion = isExperimental ? 'v1beta' : 'v1';
    this.logger.info(`[${this.platformId}] Using API version '${apiVersion}' for model '${model}'`);
    return baseTemplate.replace('{version}', apiVersion).replace('{model}', model).replace('{method}', method);
  }
  async _buildApiRequest(prompt, params, apiKey) {
    const endpoint = this._getGeminiEndpoint(params.model, ':streamGenerateContent');
    this.logger.info(`[${this.platformId}] Building API request to: ${endpoint}`);
    const url = new URL(endpoint);
    url.searchParams.append('alt', 'sse');
    url.searchParams.append('key', apiKey);
    let formattedRequest;
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      formattedRequest = this._formatGeminiRequestWithHistory(params.conversationHistory, prompt);
    } else {
      formattedRequest = {
        contents: [{
          role: 'user',
          parts: [{
            text: prompt
          }]
        }]
      };
    }
    if (params.systemPrompt) {
      if (params.modelSupportsSystemPrompt === true) {
        this.logger.info(`[${this.platformId}] Adding system prompt using systemInstruction for model: ${params.model}.`);
        formattedRequest.systemInstruction = {
          parts: [{
            text: params.systemPrompt
          }]
        };
      } else {
        this.logger.warn(`[${this.platformId}] System prompts via systemInstruction are not supported by the selected model: ${params.model}. The provided system prompt will be IGNORED.`);
      }
    }
    formattedRequest.generationConfig = {};
    if (params.tokenParameter) {
      formattedRequest.generationConfig[params.tokenParameter] = params.maxTokens;
    } else {
      formattedRequest.generationConfig.maxOutputTokens = params.maxTokens;
    }
    if ('temperature' in params) {
      formattedRequest.generationConfig.temperature = params.temperature;
    }
    if ('topP' in params) {
      formattedRequest.generationConfig.topP = params.topP;
    }
    return {
      url: url.toString(),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formattedRequest)
    };
  }

  /**
   * Parse a single line/chunk from the Gemini API stream.
   * Handles potentially fragmented JSON objects/arrays within the stream.
   * If a complete JSON structure is an array, iterates through its elements.
   * Extracts the text from each part as an individual chunk.
   * @override
   * @protected
   * @param {string} line - A single line string chunk received from the base class stream loop, OR an empty string to process the internal buffer.
   * @returns {Object} Parsed result: { type: 'content', chunks: string[] } | { type: 'error', error: string } | { type: 'ignore' }.
   *                   Returns 'ignore' if the buffer doesn't contain a complete JSON object yet.
   */
  _parseStreamChunk(line) {
    if (!line || !line.startsWith('data: ')) {
      // Ignore empty lines or lines not starting with 'data: '
      // Also handles potential 'event:' lines if Gemini SSE uses them.
      // Check for potential [DONE] signal if Gemini SSE uses it.
      if (line === 'data: [DONE]') {
        // Update log call
        this.logger.info(`[${this.platformId}] SSE stream signal [DONE] received.`);
        return {
          type: 'done'
        };
      }
      return {
        type: 'ignore'
      };
    }

    // Extract the JSON string part after 'data: '
    const jsonString = line.substring(5).trim(); // Get content after 'data: '

    if (!jsonString) {
      return {
        type: 'ignore'
      }; // Ignore if data part is empty
    }
    try {
      const data = JSON.parse(jsonString);

      // Extract text content - assuming the same structure as the previous JSON stream
      // Check candidates -> content -> parts -> text
      const textChunk = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textChunk && typeof textChunk === 'string') {
        // Return the extracted text chunk
        return {
          type: 'content',
          chunk: textChunk
        };
      } else {
        // If structure is valid but no text found, or if error field exists
        if (data?.error) {
          const errorMessage = data.error.message || JSON.stringify(data.error);
          this.logger.error(`[${this.platformId}] SSE stream returned an error: ${errorMessage}`, data.error);
          return {
            type: 'error',
            error: `API Error in stream: ${errorMessage}`
          };
        }
        // Log other valid structures without text for debugging
        if (data?.candidates?.[0]?.finishReason) {
          this.logger.info(`[${this.platformId}] SSE stream finished with reason: ${data.candidates[0].finishReason}`);
          // We might treat specific finish reasons differently later if needed.
          // For now, ignore finish reason markers unless they contain an error.
        } else {
          this.logger.warn(`[${this.platformId}] Parsed SSE data, but no text chunk found or structure mismatch.`, data);
        }
        return {
          type: 'ignore'
        }; // Ignore chunks without usable text content
      }
    } catch (parseError) {
      this.logger.error(`[${this.platformId}] Error parsing SSE JSON chunk:`, parseError, 'Raw JSON String:', jsonString);
      // Return error type on JSON parsing failure
      return {
        type: 'error',
        error: `Error parsing stream data: ${parseError.message}`
      };
    }
  }
  _formatGeminiRequestWithHistory(history, currentPrompt) {
    const contents = [];
    for (const message of history) {
      const messageRole = message.role === 'assistant' ? 'model' : 'user';
      contents.push({
        role: messageRole,
        parts: [{
          text: message.content
        }]
      });
    }
    contents.push({
      role: 'user',
      parts: [{
        text: currentPrompt
      }]
    });
    return {
      contents
    };
  }
  async _buildValidationRequest(apiKey, model) {
    const endpoint = this._getGeminiEndpoint(model, ':generateContent');
    this.logger.info(`[${this.platformId}] Building validation request to: ${endpoint}`);
    const url = new URL(endpoint);
    url.searchParams.append('key', apiKey);
    const validationPayload = {
      contents: [{
        role: 'user',
        parts: [{
          text: "API validation check"
        }]
      }],
      generationConfig: {
        maxOutputTokens: 1
      }
    };
    return {
      url: url.toString(),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validationPayload)
    };
  }
}
module.exports = GeminiApiService;

/***/ }),

/***/ "./src/api/implementations/grok-api.js":
/*!*********************************************!*\
  !*** ./src/api/implementations/grok-api.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const BaseApiService = __webpack_require__(/*! ../api-base */ "./src/api/api-base.js");

/**
 * Grok API implementation
 */
class GrokApiService extends BaseApiService {
  constructor() {
    super('grok');
  }

  /**
   * Build the platform-specific API request options for Grok.
   * @override
   * @protected
   * @param {string} prompt - The final structured prompt.
   * @param {Object} params - Resolved model parameters (model, temp, history, etc.).
   * @param {string} apiKey - The API key.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildApiRequest(prompt, params, apiKey) {
    const endpoint = this.config?.endpoint || 'https://api.x.ai/v1/chat/completions';
    this.logger.info(`[${this.platformId}] Building API request for model: ${params.model}`);
    const requestPayload = {
      model: params.model,
      stream: true
    };
    const messages = [];
    if (params.systemPrompt) {
      messages.push({
        role: 'system',
        content: params.systemPrompt
      });
    }
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      messages.push(...this._formatGrokMessages(params.conversationHistory));
    }
    messages.push({
      role: 'user',
      content: prompt
    }); // Use the structured prompt
    requestPayload.messages = messages;

    // Apply model parameters
    requestPayload[params.tokenParameter || 'max_tokens'] = params.maxTokens;
    if ('temperature' in params) {
      requestPayload.temperature = params.temperature;
    }
    if ('topP' in params) {
      requestPayload.top_p = params.topP;
    }
    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestPayload)
    };
  }

  /**
   * Parse a single line/chunk from the Grok API stream.
   * Assumes OpenAI-compatible SSE format.
   * @override
   * @protected
   * @param {string} line - A single line string from the stream.
   * @returns {Object} Parsed result: { type: 'content' | 'done' | 'ignore' | 'error', chunk?: string, error?: string }.
   */
  _parseStreamChunk(line) {
    if (!line) {
      return {
        type: 'ignore'
      };
    }

    // Grok uses 'data: [DONE]' like OpenAI
    if (line === 'data: [DONE]') {
      return {
        type: 'done'
      };
    }
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.substring(6));
        const content = data.choices?.[0]?.delta?.content;
        if (content) {
          return {
            type: 'content',
            chunk: content
          };
        } else {
          // Ignore chunks without content (like finish_reason markers)
          if (data.choices?.[0]?.finish_reason) {
            this.logger.info(`[${this.platformId}] Stream finished with reason: ${data.choices[0].finish_reason}`);
          }
          return {
            type: 'ignore'
          };
        }
      } catch (e) {
        this.logger.error(`[${this.platformId}] Error parsing stream chunk:`, e, 'Line:', line);
        return {
          type: 'error',
          error: `Error parsing stream data: ${e.message}`
        };
      }
    }
    return {
      type: 'ignore'
    };
  }

  /**
   * Format conversation history for Grok API
   * @param {Array} history - Conversation history array
   * @returns {Array} Formatted messages for Grok API
   */
  _formatGrokMessages(history) {
    return history.map(msg => {
      // Map internal role names to Grok roles (same as OpenAI format)
      let role = 'user';
      if (msg.role === 'assistant') role = 'assistant';else if (msg.role === 'system') role = 'system';
      return {
        role,
        content: msg.content
      };
    });
  }

  /**
   * Build the platform-specific API request options for validation.
   * @override
   * @protected
   * @param {string} apiKey - The API key to validate.
   * @param {string} model - The model to use for validation.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildValidationRequest(apiKey, model) {
    const endpoint = this.config?.endpoint || 'https://api.x.ai/v1/chat/completions';
    const validationPayload = {
      model: model,
      messages: [{
        role: 'user',
        content: 'API validation check'
      }],
      max_tokens: 1 // Minimum tokens needed
    };
    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(validationPayload)
    };
  }
}
module.exports = GrokApiService;

/***/ }),

/***/ "./src/api/implementations/mistral-api.js":
/*!************************************************!*\
  !*** ./src/api/implementations/mistral-api.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const BaseApiService = __webpack_require__(/*! ../api-base */ "./src/api/api-base.js");

/**
 * Mistral API implementation
 */
class MistralApiService extends BaseApiService {
  constructor() {
    super('mistral');
  }

  /**
   * Build the platform-specific API request options for Mistral.
   * @override
   * @protected
   * @param {string} prompt - The final structured prompt.
   * @param {Object} params - Resolved model parameters (model, temp, history, etc.).
   * @param {string} apiKey - The API key.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildApiRequest(prompt, params, apiKey) {
    const endpoint = this.config?.endpoint || 'https://api.mistral.ai/v1/chat/completions';
    this.logger.info(`[${this.platformId}] Building API request for model: ${params.model}`);
    const requestPayload = {
      model: params.model,
      stream: true
    };
    const messages = [];
    // Mistral API generally prefers alternating user/assistant roles.
    // System prompt is handled differently or sometimes prepended to the first user message.
    // For simplicity and compatibility with OpenAI format, we'll include it if provided.
    if (params.systemPrompt) {
      messages.push({
        role: 'system',
        content: params.systemPrompt
      });
    }
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      messages.push(...this._formatMistralMessages(params.conversationHistory));
    }
    messages.push({
      role: 'user',
      content: prompt
    }); // Use the structured prompt
    requestPayload.messages = messages;

    // Apply model parameters
    requestPayload[params.tokenParameter || 'max_tokens'] = params.maxTokens;
    if ('temperature' in params) {
      requestPayload.temperature = params.temperature;
    }
    if ('topP' in params) {
      requestPayload.top_p = params.topP;
    }
    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestPayload)
    };
  }

  /**
   * Parse a single line/chunk from the Mistral API stream.
   * Assumes OpenAI-compatible SSE format.
   * @override
   * @protected
   * @param {string} line - A single line string from the stream.
   * @returns {Object} Parsed result: { type: 'content' | 'done' | 'ignore' | 'error', chunk?: string, error?: string }.
   */
  _parseStreamChunk(line) {
    if (!line) {
      return {
        type: 'ignore'
      };
    }

    // Mistral uses 'data: [DONE]' like OpenAI
    if (line === 'data: [DONE]') {
      return {
        type: 'done'
      };
    }
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.substring(6));
        const content = data.choices?.[0]?.delta?.content;
        if (content) {
          return {
            type: 'content',
            chunk: content
          };
        } else {
          // Ignore chunks without content (like finish_reason markers)
          if (data.choices?.[0]?.finish_reason) {
            this.logger.info(`[${this.platformId}] Stream finished with reason: ${data.choices[0].finish_reason}`);
          }
          return {
            type: 'ignore'
          };
        }
      } catch (e) {
        this.logger.error(`[${this.platformId}] Error parsing stream chunk:`, e, 'Line:', line);
        return {
          type: 'error',
          error: `Error parsing stream data: ${e.message}`
        };
      }
    }
    return {
      type: 'ignore'
    };
  }

  /**
   * Format conversation history for Mistral API
   * @param {Array} history - Conversation history array
   * @returns {Array} Formatted messages for Mistral API
   */
  _formatMistralMessages(history) {
    return history.map(msg => {
      // Map internal role names to Mistral roles (same as OpenAI format)
      let role = 'user';
      if (msg.role === 'assistant') role = 'assistant';else if (msg.role === 'system') role = 'system';
      return {
        role,
        content: msg.content
      };
    });
  }

  /**
   * Build the platform-specific API request options for validation.
   * @override
   * @protected
   * @param {string} apiKey - The API key to validate.
   * @param {string} model - The model to use for validation.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildValidationRequest(apiKey, model) {
    const endpoint = this.config?.endpoint || 'https://api.mistral.ai/v1/chat/completions';
    const validationPayload = {
      model: model,
      messages: [{
        role: 'user',
        content: 'API validation check'
      }],
      max_tokens: 1 // Minimum tokens needed
    };
    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(validationPayload)
    };
  }
}
module.exports = MistralApiService;

/***/ }),

/***/ "./src/background/api/api-coordinator.js":
/*!***********************************************!*\
  !*** ./src/background/api/api-coordinator.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleApiModelRequest: () => (/* binding */ handleApiModelRequest),
/* harmony export */   processContentViaApi: () => (/* binding */ processContentViaApi)
/* harmony export */ });
/* harmony import */ var _services_ApiServiceManager_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../services/ApiServiceManager.js */ "./src/services/ApiServiceManager.js");
/* harmony import */ var _services_ApiServiceManager_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_services_ApiServiceManager_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _services_ModelParameterService_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../services/ModelParameterService.js */ "./src/services/ModelParameterService.js");
/* harmony import */ var _services_ModelParameterService_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_services_ModelParameterService_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _services_ContentFormatter_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../services/ContentFormatter.js */ "./src/services/ContentFormatter.js");
/* harmony import */ var _services_ContentFormatter_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_services_ContentFormatter_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _services_content_extraction_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../services/content-extraction.js */ "./src/background/services/content-extraction.js");
/* harmony import */ var _shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../shared/utils/content-utils.js */ "./src/shared/utils/content-utils.js");
/* harmony import */ var _shared_constants_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../shared/constants.js */ "./src/shared/constants.js");
/* harmony import */ var _core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../core/state-manager.js */ "./src/background/core/state-manager.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_7__);
// src/background/api/api-coordinator.js - API model request handling









const activeAbortControllers = new Map();

/**
 * Handle API model requests
 * @param {string} requestType - Type of request
 * @param {Object} message - Message object
 * @param {Function} sendResponse - Response function
 */
async function handleApiModelRequest(requestType, message, sendResponse) {
  try {
    switch (requestType) {
      case 'checkApiModeAvailable':
        {
          const platformId = message.platformId || (await getPreferredAiPlatform());
          const isAvailable = await _services_ApiServiceManager_js__WEBPACK_IMPORTED_MODULE_0___default().isApiModeAvailable(platformId);
          sendResponse({
            success: true,
            isAvailable,
            platformId
          });
          break;
        }
      case 'getApiModels':
        {
          const platformId = message.platformId;
          if (!platformId) {
            sendResponse({
              success: false,
              error: 'Platform ID is required to get models'
            });
            return true; // Important: return true to indicate async response handled
          }
          const models = await _services_ApiServiceManager_js__WEBPACK_IMPORTED_MODULE_0___default().getAvailableModels(platformId);
          sendResponse({
            success: true,
            models,
            platformId
          });
          break;
        }
      case 'getApiResponse':
        {
          const result = await chrome.storage.local.get([_shared_constants_js__WEBPACK_IMPORTED_MODULE_5__.STORAGE_KEYS.API_RESPONSE, _shared_constants_js__WEBPACK_IMPORTED_MODULE_5__.STORAGE_KEYS.API_PROCESSING_STATUS, _shared_constants_js__WEBPACK_IMPORTED_MODULE_5__.STORAGE_KEYS.API_RESPONSE_TIMESTAMP]);
          sendResponse({
            success: true,
            response: result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_5__.STORAGE_KEYS.API_RESPONSE] || null,
            status: result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_5__.STORAGE_KEYS.API_PROCESSING_STATUS] || 'unknown',
            timestamp: result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_5__.STORAGE_KEYS.API_RESPONSE_TIMESTAMP] || null
          });
          break;
        }
      case 'cancelStream':
        {
          const {
            streamId
          } = message; // Ensure streamId is received
          if (!streamId) {
            _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.warn('cancelStream message received without streamId.');
            sendResponse({
              success: false,
              error: 'Missing streamId'
            });
            break; // Exit case if no streamId
          }
          const controller = activeAbortControllers.get(streamId);
          if (controller) {
            try {
              controller.abort();
              activeAbortControllers.delete(streamId); // Remove immediately after aborting
              _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Abort signal sent for stream: ${streamId}`);
              sendResponse({
                success: true
              });
            } catch (abortError) {
              _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.error(`Error aborting controller for stream ${streamId}:`, abortError);
              sendResponse({
                success: false,
                error: 'Failed to abort stream'
              });
            }
          } else {
            _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.warn(`No active AbortController found for stream: ${streamId}`);
            sendResponse({
              success: false,
              error: 'Stream not found or already completed/cancelled'
            });
          }
          break; // Ensure case exits
        }
      default:
        throw new Error(`Unknown API model request type: ${requestType}`);
    }
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.error(`Error handling API model request (${requestType}):`, error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Process content via API with streaming support
 * @param {Object} params - Parameters for content processing
 * @returns {Promise<Object>} Result information
 */
async function processContentViaApi(params) {
  const {
    tabId,
    url,
    promptId = null,
    platformId,
    modelId,
    source = _shared_constants_js__WEBPACK_IMPORTED_MODULE_5__.INTERFACE_SOURCES.POPUP,
    customPrompt = null,
    streaming = false,
    // Note: streaming is forced to true later
    conversationHistory = []
  } = params;
  if (!platformId || !modelId) {
    const missing = [];
    if (!platformId) missing.push('Platform ID');
    if (!modelId) missing.push('Model ID');
    throw new Error(`${missing.join(' and ')} are required for API processing`);
  }
  try {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Starting API-based content processing from ${source}`, {
      tabId,
      url,
      promptId,
      platformId,
      modelId,
      streaming
    });
    let extractedContent = null;
    let newlyFormattedContent = null; // To hold content formatted in this run
    const contentType = (0,_shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_4__.determineContentType)(url);
    const skipExtractionRequested = params.skipInitialExtraction === true;
    const isFirstUserMessage = conversationHistory.length === 0;
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Is this the first user message (history empty)? ${isFirstUserMessage}`);

    // 1. Decide whether to extract content based on existence, user request, and message history
    const initialFormattedContentExists = await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.hasFormattedContentForTab)(tabId);
    // Extraction only happens on the first message, if not skipped, if content doesn't already exist, and if page is injectable.
    const canInject = (0,_shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_4__.isInjectablePage)(url); // Check if page allows injection
    const shouldExtract = isFirstUserMessage && !initialFormattedContentExists && !skipExtractionRequested && canInject;

    // Log if extraction is skipped specifically due to non-injectable URL on first message
    if (isFirstUserMessage && !initialFormattedContentExists && !skipExtractionRequested && !canInject) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`First message: Skipping extraction for tab ${tabId} because URL (${url}) is not injectable.`);
      // Return immediately indicating context was skipped, preventing further processing for this message
      return {
        success: true,
        // The operation itself didn't fail, it just skipped context
        skippedContext: true,
        reason: 'Content extraction not supported on this page type.',
        contentType: contentType // Pass content type back if needed by UI
      };
    }
    if (shouldExtract) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`First message: Extraction will proceed for tab ${tabId} (no existing content, not skipped).`);
      // Reset previous extraction state (ensure this happens ONLY if extracting)
      await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.resetExtractionState)();

      // Extract content
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Content type determined: ${contentType}`);
      await (0,_services_content_extraction_js__WEBPACK_IMPORTED_MODULE_3__.extractContent)(tabId, url); // url should be available here
      extractedContent = await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.getExtractedContent)(); // Assign to the outer scope variable

      if (!extractedContent) {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.warn(`Failed to extract content for tab ${tabId}, proceeding without it.`);
        newlyFormattedContent = null; // Ensure null if extraction failed
      } else {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info('Content extraction completed.');
        // Format and Store Content
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Formatting extracted content (type: ${contentType})...`);
        newlyFormattedContent = _services_ContentFormatter_js__WEBPACK_IMPORTED_MODULE_2___default().formatContent(extractedContent, contentType);
        await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.storeFormattedContentForTab)(tabId, newlyFormattedContent);
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Formatted and stored content for tab ${tabId}.`);
      }
      // Ensure these are null if extraction happened but failed
      if (!newlyFormattedContent) {
        extractedContent = null;
      }
    } else {
      // Log the reason why extraction was skipped
      if (!isFirstUserMessage) {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Not first message: Skipping extraction for tab ${tabId}.`);
      } else if (skipExtractionRequested) {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`First message: Extraction skipped for tab ${tabId} by user request.`);
      } else if (initialFormattedContentExists) {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`First message: Formatted content already exists for tab ${tabId}, skipping extraction.`);
      } else if (isFirstUserMessage && !canInject) {} else {
        // Should not happen based on shouldExtract logic, but log just in case
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.warn(`Extraction skipped for unknown reason for tab ${tabId}. Conditions: isFirst=${isFirstUserMessage}, skipped=${skipExtractionRequested}, exists=${initialFormattedContentExists}, canInject=${canInject}`);
      }
      // Ensure these are null if extraction didn't happen
      extractedContent = null;
      newlyFormattedContent = null;
    }

    // 4. Get the prompt
    let promptContent;
    if (customPrompt) {
      promptContent = customPrompt;
    } else {
      throw new Error('No prompt content provided');
    }

    // 5. Parameter Resolution (Centralized) - Use platformId and modelId from params
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Resolving parameters for platform: ${platformId}, model: ${modelId}`);
    let resolvedParams = await _services_ModelParameterService_js__WEBPACK_IMPORTED_MODULE_1___default().resolveParameters(platformId, modelId, {
      tabId,
      source,
      conversationHistory
    });
    resolvedParams.conversationHistory = conversationHistory;
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Resolved parameters:`, resolvedParams);

    // 6. Generate a unique stream ID for this request
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 7. Initialize streaming response (using platformId from params)
    await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.initializeStreamResponse)(streamId, platformId, resolvedParams.model); // Include model

    // 8. Determine the formatted content to include in the request (only for the first message under specific conditions)
    let formattedContentForRequest = null;
    if (isFirstUserMessage) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Processing first user message for content inclusion.`);
      if (!skipExtractionRequested) {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Extraction was allowed for this first message.`);
        if (shouldExtract && newlyFormattedContent) {
          // Extraction was triggered now and succeeded
          formattedContentForRequest = newlyFormattedContent;
          _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Using newly extracted/formatted content for tab ${tabId}.`);
        } else if (initialFormattedContentExists) {
          // Extraction wasn't triggered now (because content existed), but it was allowed and content exists
          formattedContentForRequest = await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.getFormattedContentForTab)(tabId);
          _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Using pre-existing formatted content for tab ${tabId}.`);
        } else {
          // Extraction was allowed, but either failed or wasn't triggered (and no pre-existing content)
          _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`No content available (extraction allowed but failed, or content didn't exist) for tab ${tabId}.`);
          formattedContentForRequest = null;
        }
      } else {
        // Extraction was explicitly skipped by the user for the first message
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Extraction was skipped by user request for this first message. No content included.`);
        formattedContentForRequest = null;
      }
    } else {
      // Not the first message, never include content
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Not the first user message: Skipping content inclusion.`);
      formattedContentForRequest = null;
    }
    if (tabId) {
      try {
        const promptToStoreOrClear = resolvedParams.systemPrompt;
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Updating system prompt state for tab ${tabId}. Prompt is ${promptToStoreOrClear ? 'present' : 'absent/empty'}.`);
        await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.storeSystemPromptForTab)(tabId, promptToStoreOrClear);
      } catch (storeError) {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.error(`Failed to update system prompt state for tab ${tabId}:`, storeError);
      }
    }

    // 9. Notify the content script about streaming start ONLY if possible and from sidebar
    if (source === _shared_constants_js__WEBPACK_IMPORTED_MODULE_5__.INTERFACE_SOURCES.SIDEBAR && tabId) {
      if ((0,_shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_4__.isInjectablePage)(url)) {
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'streamStart',
            streamId,
            platformId: platformId,
            model: resolvedParams.model
          });
          _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Sent streamStart notification to content script in tab ${tabId}.`);
        } catch (err) {
          if (err.message && (err.message.includes('Could not establish connection') || err.message.includes('Receiving end does not exist'))) {
            // Log the warning, but don't treat it as a fatal error for the API call itself.
            _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.warn(`Failed to send streamStart to tab ${tabId}: Content script likely not running or injected.`);
          } else {
            _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.error('Error notifying content script about stream start:', err);
          }
        }
      } else {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Skipped sending streamStart notification to tab ${tabId} (URL: ${url}) as it's not an injectable page.`);
      }
    }

    // 10. Create unified request configuration
    const requestConfig = {
      prompt: promptContent,
      resolvedParams: resolvedParams,
      // Pass the whole resolved params object ( includes history)
      formattedContent: formattedContentForRequest,
      // Pass the formatted content string or null
      streaming: true,
      // Always true for this function
      onChunk: createStreamHandler(streamId, source, tabId, platformId, resolvedParams)
    };

    // 11. Process with API (using platformId from params)
    const controller = new AbortController();
    activeAbortControllers.set(streamId, controller);
    requestConfig.abortSignal = controller.signal; // Add signal to request config

    try {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info('Calling ApiServiceManager.processWithUnifiedConfig with config:', requestConfig);
      // Pass platformId from params directly
      const apiResponse = await _services_ApiServiceManager_js__WEBPACK_IMPORTED_MODULE_0___default().processWithUnifiedConfig(platformId, requestConfig);

      // If we get here without an error, streaming completed successfully
      return {
        success: true,
        streamId,
        response: apiResponse,
        contentType: contentType // Use the variable determined earlier
      };
    } catch (processingError) {
      // Handle API processing errors
      await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.setApiProcessingError)(processingError.message);
      throw processingError; // Re-throw to be caught by the outer catch
    } finally {
      activeAbortControllers.delete(streamId);
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Removed AbortController for stream: ${streamId}`);
    }
  } catch (error) {
    // This outer catch handles errors from setup (extraction, param resolution) AND re-thrown processing errors
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.error('API content processing error:', error);
    await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.setApiProcessingError)(error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a stream handler function
 * @param {string} streamId - Stream identifier
 * @param {string} source - Interface source
 * @param {number} tabId - Tab ID for sidebar integration
 * @param {string} platformId - Platform identifier
 * @param {Object} resolvedParams - Resolved parameters including the model
 * @returns {Function} Chunk handler function
 */
function createStreamHandler(streamId, source, tabId, platformId, resolvedParams) {
  let fullContent = '';
  // Use the resolved model from the start
  const modelToUse = resolvedParams.model;
  return async function handleChunk(chunkData) {
    if (!chunkData) return;
    const chunk = typeof chunkData.chunk === 'string' ? chunkData.chunk : '';
    const done = !!chunkData.done;

    // Model should be consistent, but log if chunkData provides a different one
    if (chunkData.model && chunkData.model !== modelToUse) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.warn(`Stream chunk reported model ${chunkData.model}, but expected ${modelToUse}`);
    }
    if (chunk) {
      fullContent += chunk;

      // Send to content script for sidebar
      if (source === _shared_constants_js__WEBPACK_IMPORTED_MODULE_5__.INTERFACE_SOURCES.SIDEBAR && tabId) {
        try {
          // Use runtime API for sidebar communication
          chrome.runtime.sendMessage({
            action: 'streamChunk',
            streamId,
            chunkData: {
              chunk,
              done: false,
              model: modelToUse
            }
          });
        } catch (err) {
          _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.warn('Error sending stream chunk:', err);
        }
      }
    }

    // Handle stream completion or error
    if (done) {
      const finalChunkData = {
        chunk: '',
        done: true,
        model: modelToUse,
        fullContent: chunkData.fullContent || fullContent
      };

      // Check for user cancellation first
      if (chunkData.error === 'Cancelled by user' || chunkData.error instanceof Error && chunkData.error.name === 'AbortError') {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Stream ${streamId} cancelled by user. Processing partial content.`);
        // Complete successfully to save partial state, but mark as cancelled for UI
        await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.completeStreamResponse)(fullContent, modelToUse, platformId); // No error passed
        finalChunkData.cancelled = true; // Add cancellation flag
        // Do NOT add finalChunkData.error
      } else if (chunkData.error) {
        // Handle other errors
        // chunkData.error should now be the pre-formatted string from extractApiErrorMessage
        const errorMessage = chunkData.error;
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.error(`Stream ended with error: ${errorMessage}`);
        await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.setApiProcessingError)(errorMessage);
        // Pass modelToUse and error to completeStreamResponse
        await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.completeStreamResponse)(fullContent, modelToUse, platformId, errorMessage);
        finalChunkData.error = errorMessage;
      } else {
        // Handle successful completion
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.info(`Stream ${streamId} completed successfully.`);
        // Pass modelToUse to completeStreamResponse
        await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_6__.completeStreamResponse)(fullContent, modelToUse, platformId);
      }

      // Ensure the final message (success, error, or cancelled) is sent for sidebar
      if (source === _shared_constants_js__WEBPACK_IMPORTED_MODULE_5__.INTERFACE_SOURCES.SIDEBAR && tabId) {
        try {
          // Use runtime API for sidebar communication
          chrome.runtime.sendMessage({
            action: 'streamChunk',
            streamId,
            chunkData: finalChunkData
          });
        } catch (err) {
          _shared_logger_js__WEBPACK_IMPORTED_MODULE_7___default().background.warn('Error sending stream completion/error message:', err);
        }
      }
    }
  };
}

/***/ }),

/***/ "./src/background/core/message-router.js":
/*!***********************************************!*\
  !*** ./src/background/core/message-router.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   setupMessageRouter: () => (/* binding */ setupMessageRouter)
/* harmony export */ });
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../shared/utils/content-utils.js */ "./src/shared/utils/content-utils.js");
/* harmony import */ var _services_credential_manager_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../services/credential-manager.js */ "./src/background/services/credential-manager.js");
/* harmony import */ var _api_api_coordinator_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../api/api-coordinator.js */ "./src/background/api/api-coordinator.js");
/* harmony import */ var _services_content_processing_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../services/content-processing.js */ "./src/background/services/content-processing.js");
/* harmony import */ var _services_sidebar_manager_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../services/sidebar-manager.js */ "./src/background/services/sidebar-manager.js");
/* harmony import */ var _services_theme_service_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../services/theme-service.js */ "./src/background/services/theme-service.js");
/* harmony import */ var _listeners_tab_state_listener_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../listeners/tab-state-listener.js */ "./src/background/listeners/tab-state-listener.js");
// src/background/core/message-router.js - Centralized message handling










// Store for message handlers
const messageHandlers = new Map();

/**
 * Sets up message routing system
 */
function setupMessageRouter() {
  // Register all message handlers
  registerCoreHandlers();
  registerApiHandlers();
  registerServiceHandlers();

  // Set up the message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Log the message for debugging
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_0___default().background.info('Message received in background', {
      message,
      sender: sender.tab ? `Tab ${sender.tab.id}` : 'Extension'
    });

    // Handle the message based on its action
    const handler = messageHandlers.get(message.action);
    if (handler) {
      // Call the handler and inform if it's async
      const result = handler(message, sender, sendResponse);
      return result === true; // Keep channel open for async response if needed
    }

    // Default simple responses
    if (message.action === 'checkStatus') {
      sendResponse({
        status: 'ok'
      });
      return false;
    }

    // Handle getCurrentTabId for tab-specific sidebar functionality
    if (message.action === 'getCurrentTabId') {
      sendResponse({
        tabId: sender.tab ? sender.tab.id : null
      });
      return false;
    }
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_0___default().background.warn(`No handler registered for message action: ${message.action}`);
    return false;
  });
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_0___default().background.info('Message router initialized');
}

/**
 * Register core message handlers
 */
function registerCoreHandlers() {
  // Content type detection handler
  messageHandlers.set('getContentType', (message, sender, sendResponse) => {
    const contentType = (0,_shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_1__.determineContentType)(message.url, message.hasSelection);
    sendResponse({
      contentType
    });
    return false;
  });

  // Status check handler
  messageHandlers.set('checkStatus', (message, sender, sendResponse) => {
    sendResponse({
      status: 'ok'
    });
    return false;
  });

  // Error notification handler
  messageHandlers.set('notifyError', (message, sender, sendResponse) => {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_0___default().background.error('Error from content script:', message.error);
    return false;
  });

  // Tab ID provider for content scripts
  messageHandlers.set('getCurrentTabId', (message, sender, sendResponse) => {
    if (sender.tab) {
      sendResponse({
        tabId: sender.tab.id
      });
    } else {
      sendResponse({
        tabId: null,
        error: 'Not in a tab context'
      });
    }
    return false;
  });
}

/**
 * Register API-related message handlers
 */
function registerApiHandlers() {
  // API mode availability check
  messageHandlers.set('checkApiModeAvailable', (message, sender, sendResponse) => {
    (0,_api_api_coordinator_js__WEBPACK_IMPORTED_MODULE_3__.handleApiModelRequest)('checkApiModeAvailable', message, sendResponse);
    return true; // Keep channel open for async response
  });

  // Get API models
  messageHandlers.set('getApiModels', (message, sender, sendResponse) => {
    (0,_api_api_coordinator_js__WEBPACK_IMPORTED_MODULE_3__.handleApiModelRequest)('getApiModels', message, sendResponse);
    return true; // Keep channel open for async response
  });

  // API credential operations
  messageHandlers.set('credentialOperation', (message, sender, sendResponse) => {
    (0,_services_credential_manager_js__WEBPACK_IMPORTED_MODULE_2__.handleCredentialOperation)(message, sendResponse);
    return true; // Keep channel open for async response
  });

  // API content processing
  messageHandlers.set('processContentViaApi', (message, sender, sendResponse) => {
    (0,_services_content_processing_js__WEBPACK_IMPORTED_MODULE_4__.handleProcessContentViaApiRequest)(message, sendResponse);
    return true; // Keep channel open for async response
  });
  messageHandlers.set('cancelStream', (message, sender, sendResponse) => {
    (0,_api_api_coordinator_js__WEBPACK_IMPORTED_MODULE_3__.handleApiModelRequest)('cancelStream', message, sendResponse);
    return true; // Keep channel open for async response
  });
}

/**
 * Register service-related message handlers
 */
function registerServiceHandlers() {
  // Process content
  messageHandlers.set('processContent', (message, sender, sendResponse) => {
    (0,_services_content_processing_js__WEBPACK_IMPORTED_MODULE_4__.handleProcessContentRequest)(message, sendResponse);
    return true; // Keep channel open for async response
  });

  // Get theme
  messageHandlers.set('getTheme', (message, sender, sendResponse) => {
    (0,_services_theme_service_js__WEBPACK_IMPORTED_MODULE_6__.handleThemeOperation)(message, sendResponse);
    return true; // Keep channel open for async response
  });

  // Set theme
  messageHandlers.set('setTheme', (message, sender, sendResponse) => {
    (0,_services_theme_service_js__WEBPACK_IMPORTED_MODULE_6__.handleThemeOperation)(message, sendResponse);
    return true; // Keep channel open for async response
  });

  // Clear specific tab data (for sidebar refresh)
  messageHandlers.set('clearTabData', _listeners_tab_state_listener_js__WEBPACK_IMPORTED_MODULE_7__.handleClearTabDataRequest);

  // Handle requests to toggle the native side panel
  messageHandlers.set('toggleNativeSidePanelAction', _services_sidebar_manager_js__WEBPACK_IMPORTED_MODULE_5__.handleToggleNativeSidePanelAction);
}

/***/ }),

/***/ "./src/background/core/state-manager.js":
/*!**********************************************!*\
  !*** ./src/background/core/state-manager.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   completeStreamResponse: () => (/* binding */ completeStreamResponse),
/* harmony export */   getExtractedContent: () => (/* binding */ getExtractedContent),
/* harmony export */   getFormattedContentForTab: () => (/* binding */ getFormattedContentForTab),
/* harmony export */   getPlatformTabInfo: () => (/* binding */ getPlatformTabInfo),
/* harmony export */   hasFormattedContentForTab: () => (/* binding */ hasFormattedContentForTab),
/* harmony export */   initializeStreamResponse: () => (/* binding */ initializeStreamResponse),
/* harmony export */   resetExtractionState: () => (/* binding */ resetExtractionState),
/* harmony export */   resetState: () => (/* binding */ resetState),
/* harmony export */   saveExtractedContent: () => (/* binding */ saveExtractedContent),
/* harmony export */   savePlatformTabInfo: () => (/* binding */ savePlatformTabInfo),
/* harmony export */   setApiProcessingError: () => (/* binding */ setApiProcessingError),
/* harmony export */   storeFormattedContentForTab: () => (/* binding */ storeFormattedContentForTab),
/* harmony export */   storeSystemPromptForTab: () => (/* binding */ storeSystemPromptForTab),
/* harmony export */   updateScriptInjectionStatus: () => (/* binding */ updateScriptInjectionStatus)
/* harmony export */ });
/* harmony import */ var _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../shared/constants.js */ "./src/shared/constants.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_1__);
// src/background/core/state-manager.js - Background state management




/**
 * Reset state to initial values
 * @returns {Promise<void>}
 */
async function resetState() {
  try {
    await chrome.storage.local.set({
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.SCRIPT_INJECTED]: false,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID]: null,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.CONTENT_READY]: false,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.EXTRACTED_CONTENT]: null,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_PROCESSING_STATUS]: null,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_RESPONSE]: null
    });
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error resetting state:', error);
    throw error;
  }
}

/**
 * Store or remove the system prompt for a specific tab.
 * If systemPrompt is a non-empty string, it's stored.
 * If systemPrompt is null, undefined, or empty, the entry for the tab is removed.
 * @param {number} tabId - Tab ID to use as key.
 * @param {string | null | undefined} systemPrompt - The system prompt string to store, or null/undefined/empty to remove.
 * @returns {Promise<void>}
 */
async function storeSystemPromptForTab(tabId, systemPrompt) {
  if (typeof tabId !== 'number') {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.warn('storeSystemPromptForTab called with invalid tabId:', tabId);
    return;
  }
  const key = String(tabId);
  try {
    const result = await chrome.storage.local.get(_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SYSTEM_PROMPTS);
    // Ensure we always work with an object, even if storage is empty/corrupt
    const allTabSystemPrompts = result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SYSTEM_PROMPTS] && typeof result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SYSTEM_PROMPTS] === 'object' ? {
      ...result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SYSTEM_PROMPTS]
    } // Create a mutable copy
    : {};

    // Check if the provided prompt is a valid, non-empty string
    if (typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
      // Store the valid prompt
      if (allTabSystemPrompts[key] !== systemPrompt) {
        // Only update if changed
        allTabSystemPrompts[key] = systemPrompt;
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Stored/Updated system prompt for tab ${tabId}.`);
        await chrome.storage.local.set({
          [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SYSTEM_PROMPTS]: allTabSystemPrompts
        });
      } else {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`System prompt for tab ${tabId} is unchanged. No storage update needed.`);
      }
    } else {
      // If prompt is invalid (null, undefined, empty), remove the key if it exists
      if (allTabSystemPrompts.hasOwnProperty(key)) {
        delete allTabSystemPrompts[key];
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Removed system prompt entry for tab ${tabId} as new prompt is absent/empty.`);
        // Save the modified object back (only if a key was actually deleted)
        await chrome.storage.local.set({
          [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SYSTEM_PROMPTS]: allTabSystemPrompts
        });
      } else {
        // Key doesn't exist, nothing to remove, no storage update needed.
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`No system prompt entry to remove for tab ${tabId}.`);
      }
    }
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error(`Error updating system prompt state for tab ${tabId}:`, error);
  }
}

/**
 * Reset extraction state
 * @returns {Promise<void>}
 */
async function resetExtractionState() {
  try {
    await chrome.storage.local.set({
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.CONTENT_READY]: false,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.EXTRACTED_CONTENT]: null
    });
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Extraction state reset');
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error resetting extraction state:', error);
    throw error;
  }
}

/**
 * Save platform tab information
 * @param {number} tabId - Tab ID of the AI platform tab
 * @param {string} platformId - Platform identifier
 * @param {string} promptContent - Prompt content to use
 * @param {string} formattedContentString - The formatted content string to save for injection.
 * @returns {Promise<boolean>} Success flag
 */
async function savePlatformTabInfo(tabId, platformId, promptContent, formattedContentString) {
  try {
    await chrome.storage.local.set({
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID]: tabId,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.INJECTION_PLATFORM]: platformId,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.SCRIPT_INJECTED]: false,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.PRE_PROMPT]: promptContent,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.FORMATTED_CONTENT_FOR_INJECTION]: formattedContentString
    });

    // Verify the data was stored correctly
    const verifyData = await chrome.storage.local.get([_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.INJECTION_PLATFORM, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.SCRIPT_INJECTED]);
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Storage verification: aiPlatformTabId=${verifyData[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID]}, aiPlatform=${verifyData[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.INJECTION_PLATFORM]}, scriptInjected=${verifyData[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.SCRIPT_INJECTED]}`);
    return true;
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error saving platform tab info:', error);
    return false;
  }
}

/**
 * Update script injection status
 * @param {boolean} injected - Whether script was injected
 * @returns {Promise<void>}
 */
async function updateScriptInjectionStatus(injected) {
  try {
    await chrome.storage.local.set({
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.SCRIPT_INJECTED]: injected
    });
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Updated script injection status: ${injected}`);
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error updating script injection status:', error);
  }
}

/**
 * Save extracted content
 * @param {Object} content - Extracted content object
 * @returns {Promise<void>}
 */
async function saveExtractedContent(content) {
  try {
    await chrome.storage.local.set({
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.EXTRACTED_CONTENT]: content,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.CONTENT_READY]: true
    });
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Extracted content saved');
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error saving extracted content:', error);
  }
}

/**
 * Save API streaming response
 * @param {string} streamId - Stream identifier
 * @param {string} platformId - Platform identifier
 * @returns {Promise<void>}
 */
async function initializeStreamResponse(streamId, platformId) {
  try {
    const initialResponse = {
      success: true,
      streamId,
      status: 'streaming',
      platformId,
      timestamp: Date.now(),
      content: '' // Will be populated as streaming progresses
    };
    await chrome.storage.local.set({
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_PROCESSING_STATUS]: 'streaming',
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_RESPONSE]: initialResponse,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.STREAM_ID]: streamId
    });
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Stream response initialized: ${streamId}`);
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error initializing stream response:', error);
  }
}

/**
 * Complete stream response
 * @param {string} fullContent - Complete final content
 * @param {string} model - Model used
 * @param {string} platformId - Platform identifier
 * @param {string|null} [error=null] - Optional error message if the stream failed
 * @returns {Promise<void>}
 */
async function completeStreamResponse(fullContent, model, platformId, error = null) {
  try {
    let finalResponse;
    let storageUpdate = {};
    if (error) {
      // Handle error case
      finalResponse = {
        success: false,
        status: 'error',
        content: fullContent,
        // Include content received before error
        model,
        platformId,
        error: error,
        // Include the error message
        timestamp: Date.now()
      };
      storageUpdate = {
        [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_PROCESSING_STATUS]: 'error',
        [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_PROCESSING_ERROR]: error,
        [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_RESPONSE]: finalResponse,
        [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_RESPONSE_TIMESTAMP]: Date.now()
      };
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error(`Stream response completed with error: ${error}`);
    } else {
      // Handle success case
      finalResponse = {
        success: true,
        status: 'completed',
        content: fullContent,
        model,
        platformId,
        timestamp: Date.now()
      };
      storageUpdate = {
        [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_PROCESSING_STATUS]: 'completed',
        [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_RESPONSE]: finalResponse,
        [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_RESPONSE_TIMESTAMP]: Date.now(),
        [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_PROCESSING_ERROR]: null
      };
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Stream response completed successfully');
    }

    // Update storage
    await chrome.storage.local.set(storageUpdate);

    // Notify the popup and potentially other listeners
    try {
      // Send the final response object
      chrome.runtime.sendMessage({
        action: 'apiResponseReady',
        response: finalResponse
      });
    } catch (msgError) {
      // Ignore if popup isn't open or other listeners fail
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Could not notify listeners of API response completion/error:', msgError.message);
    }
  } catch (catchError) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error in completeStreamResponse function:', catchError);
    // Attempt to set a generic error state if something goes wrong here
    try {
      await chrome.storage.local.set({
        [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_PROCESSING_STATUS]: 'error',
        [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_PROCESSING_ERROR]: 'Internal error completing stream response'
      });
    } catch (fallbackError) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Failed to set fallback error state:', fallbackError);
    }
  }
}

/**
 * Set API processing error
 * @param {string} error - Error message
 * @returns {Promise<void>}
 */
async function setApiProcessingError(error) {
  try {
    await chrome.storage.local.set({
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_PROCESSING_STATUS]: 'error',
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.API_PROCESSING_ERROR]: error
    });
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('API processing error set:', error);

    // Notify popup if open
    try {
      chrome.runtime.sendMessage({
        action: 'apiProcessingError',
        error
      });
    } catch (msgError) {
      // Ignore if popup isn't open
    }
  } catch (err) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error setting API processing error:', err);
  }
}

/**
 * Check if formatted content exists for a specific tab.
 * Assumes content is stored under STORAGE_KEYS.TAB_FORMATTED_CONTENT
 * with tab IDs as keys.
 * @param {number} tabId - The ID of the tab to check.
 * @returns {Promise<boolean>} True if formatted content exists, false otherwise.
 */
async function hasFormattedContentForTab(tabId) {
  if (typeof tabId !== 'number') {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.warn('hasFormattedContentForTab called with invalid tabId:', tabId);
    return false;
  }
  const key = String(tabId); // Ensure key is a string if needed
  try {
    // Note: The original request mentioned STORAGE_KEYS.TAB_FORMATTED_CONTENT
    // Adjust this key if the actual storage key is different.
    const result = await chrome.storage.local.get(_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_FORMATTED_CONTENT);
    const allFormattedContent = result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_FORMATTED_CONTENT];
    if (allFormattedContent && typeof allFormattedContent === 'object' && allFormattedContent.hasOwnProperty(key)) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Formatted content found for tab ${tabId}.`);
      return true;
    } else {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`No formatted content found for tab ${tabId}.`);
      return false;
    }
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error(`Error checking formatted content for tab ${tabId}:`, error);
    return false; // Assume no content on error
  }
}

/**
 * Store formatted content in local storage by tab ID.
 * Assumes content is stored under STORAGE_KEYS.TAB_FORMATTED_CONTENT
 * with tab IDs as keys.
 * @param {number} tabId - Tab ID to use as key.
 * @param {string} formattedContent - The formatted content string to store.
 * @returns {Promise<void>}
 */
async function storeFormattedContentForTab(tabId, formattedContent) {
  if (typeof tabId !== 'number') {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.warn('storeFormattedContentForTab called with invalid tabId:', tabId);
    return;
  }
  if (typeof formattedContent !== 'string') {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.warn('storeFormattedContentForTab called with non-string content for tabId:', tabId);
    return;
  }
  const key = String(tabId);
  try {
    const result = await chrome.storage.local.get(_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_FORMATTED_CONTENT);
    const allFormattedContent = result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_FORMATTED_CONTENT] || {};
    allFormattedContent[key] = formattedContent;
    await chrome.storage.local.set({
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_FORMATTED_CONTENT]: allFormattedContent
    });
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Stored formatted content for tab ${tabId}.`);
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error(`Error storing formatted content for tab ${tabId}:`, error);
    throw error; // Re-throw error for the caller to handle
  }
}

/**
 * Get formatted content for a specific tab.
 * Assumes content is stored under STORAGE_KEYS.TAB_FORMATTED_CONTENT
 * with tab IDs as keys.
 * @param {number} tabId - The ID of the tab to retrieve content for.
 * @returns {Promise<string|null>} The formatted content string, or null if not found or on error.
 */
async function getFormattedContentForTab(tabId) {
  if (typeof tabId !== 'number') {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.warn('getFormattedContentForTab called with invalid tabId:', tabId);
    return null;
  }
  const key = String(tabId);
  try {
    const result = await chrome.storage.local.get(_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_FORMATTED_CONTENT);
    const allFormattedContent = result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_FORMATTED_CONTENT];
    if (allFormattedContent && typeof allFormattedContent === 'object' && allFormattedContent.hasOwnProperty(key)) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Retrieved formatted content for tab ${tabId}.`);
      return allFormattedContent[key]; // Return the stored string
    } else {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`No formatted content found for tab ${tabId} during retrieval.`);
      return null;
    }
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error(`Error retrieving formatted content for tab ${tabId}:`, error);
    return null; // Return null on error
  }
}

/**
 * Get stored content extraction
 * @returns {Promise<Object>} Extracted content
 */
async function getExtractedContent() {
  try {
    const {
      extractedContent
    } = await chrome.storage.local.get(_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.EXTRACTED_CONTENT);
    return extractedContent;
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error getting extracted content:', error);
    return null;
  }
}

/**
 * Get current AI platform tab information
 * @returns {Promise<Object>} Platform tab info
 */
async function getPlatformTabInfo() {
  try {
    const result = await chrome.storage.local.get([_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.INJECTION_PLATFORM, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.SCRIPT_INJECTED]);
    return {
      tabId: result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID],
      platformId: result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.INJECTION_PLATFORM],
      scriptInjected: result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.SCRIPT_INJECTED]
    };
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error getting platform tab info:', error);
    return {
      tabId: null,
      platformId: null,
      scriptInjected: false
    };
  }
}

/***/ }),

/***/ "./src/background/initialization.js":
/*!******************************************!*\
  !*** ./src/background/initialization.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleInstallation: () => (/* binding */ handleInstallation),
/* harmony export */   initializeExtension: () => (/* binding */ initializeExtension)
/* harmony export */ });
/* harmony import */ var _core_state_manager_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./core/state-manager.js */ "./src/background/core/state-manager.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _shared_constants_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../shared/constants.js */ "./src/shared/constants.js");
// src/background/initialization.js - Handles extension initialization





/**
 * Initializes default prompts from prompt-config.json into sync storage
 * if they haven't been initialized before. This should only run once.
 */
async function initializeDefaultPrompts() {
  // This log should now appear if the function is called correctly
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Attempting to initialize default prompts...');
  try {
    // Fetch default prompts from config file
    const response = await fetch(chrome.runtime.getURL('prompt-config.json'));
    if (!response.ok) {
      throw new Error(`Failed to fetch prompt-config.json: ${response.statusText}`);
    }
    const defaultPromptsConfig = await response.json();

    // Fetch existing custom prompts from sync storage
    const syncResult = await chrome.storage.sync.get(_shared_constants_js__WEBPACK_IMPORTED_MODULE_2__.STORAGE_KEYS.CUSTOM_PROMPTS);
    const promptsByType = typeof syncResult[_shared_constants_js__WEBPACK_IMPORTED_MODULE_2__.STORAGE_KEYS.CUSTOM_PROMPTS] === 'object' && syncResult[_shared_constants_js__WEBPACK_IMPORTED_MODULE_2__.STORAGE_KEYS.CUSTOM_PROMPTS] !== null ? syncResult[_shared_constants_js__WEBPACK_IMPORTED_MODULE_2__.STORAGE_KEYS.CUSTOM_PROMPTS] : {};
    let promptsAdded = false;

    // Iterate through content types in the default config
    for (const contentType in defaultPromptsConfig) {
      if (Object.hasOwnProperty.call(defaultPromptsConfig, contentType)) {
        // Ensure the content type exists in the sync storage structure
        if (!promptsByType[contentType]) {
          promptsByType[contentType] = {
            prompts: {}
          };
        } else if (typeof promptsByType[contentType].prompts !== 'object' || promptsByType[contentType].prompts === null) {
          promptsByType[contentType].prompts = {};
        }
        const defaultPromptsForType = defaultPromptsConfig[contentType];

        // Iterate through prompts defined for this content type in the default config
        for (const defaultPromptName in defaultPromptsForType) {
          if (Object.hasOwnProperty.call(defaultPromptsForType, defaultPromptName)) {
            const defaultPromptContent = defaultPromptsForType[defaultPromptName];

            // Check if a prompt with the same name already exists in sync storage for this type
            const existingPrompts = promptsByType[contentType].prompts;
            const nameExists = Object.values(existingPrompts).some(prompt => prompt && typeof prompt === 'object' && prompt.name === defaultPromptName);
            if (!nameExists) {
              // Prompt doesn't exist, create and add it
              const newPromptId = `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
              const now = new Date().toISOString();
              const newPrompt = {
                id: newPromptId,
                name: defaultPromptName,
                content: defaultPromptContent,
                contentType: contentType,
                // Use the key from the config
                createdAt: now,
                updatedAt: now
              };
              promptsByType[contentType].prompts[newPromptId] = newPrompt;
              promptsAdded = true;
              _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Added default prompt: "${defaultPromptName}" for type "${contentType}"`);
            } else {
              _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Default prompt "${defaultPromptName}" for type "${contentType}" already exists. Skipping.`);
            }
          }
        }
      }
    }

    // Save back to sync storage if any prompts were added
    if (promptsAdded) {
      await chrome.storage.sync.set({
        [_shared_constants_js__WEBPACK_IMPORTED_MODULE_2__.STORAGE_KEYS.CUSTOM_PROMPTS]: promptsByType
      });
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Successfully added default prompts to sync storage.');
    } else {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('No new default prompts needed to be added.');
    }

    // Return true indicating success (or at least completion without error)
    return true;
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error initializing default prompts:', error);
    // Return false indicating failure
    return false;
  }
}

/**
 * Initialize the extension's core configuration and state.
 * Should run on install and update.
 */
async function initializeExtension() {
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Running core extension initialization...');
  try {
    await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_0__.resetState)();
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Volatile state reset complete');

    // Reset all tab sidebar visibility states to false
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Resetting all tab sidebar visibility states to false...');
    const tabs = await chrome.tabs.query({});
    const initialSidebarStates = {};
    for (const tab of tabs) {
      if (tab.id) {
        initialSidebarStates[tab.id.toString()] = false;
      }
    }
    await chrome.storage.local.set({
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_2__.STORAGE_KEYS.TAB_SIDEBAR_STATES]: initialSidebarStates
    });
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('All tab sidebar visibility states reset.');
    return true;
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Core initialization error:', error);
    throw error;
  }
}

/**
 * Handle extension installation or update event.
 * @param {Object} details - Installation details (reason: "install", "update", "chrome_update")
 */
async function handleInstallation(details) {
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Extension event: ${details.reason}`, details);

  // --- Default Prompt Initialization Logic ---
  if (details.reason === 'install') {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Reason is "install", checking default prompt initialization flag...');
    const flagKey = _shared_constants_js__WEBPACK_IMPORTED_MODULE_2__.STORAGE_KEYS.DEFAULT_PROMPTS_INIT_FLAG;
    try {
      const flagResult = await chrome.storage.local.get(flagKey);
      if (!flagResult[flagKey]) {
        // Only run if flag is not true
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Initialization flag not set. Proceeding with default prompt initialization.');
        const promptInitSuccess = await initializeDefaultPrompts();
        if (promptInitSuccess) {
          // Set the flag only if initialization completed successfully
          await chrome.storage.local.set({
            [flagKey]: true
          });
          _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Set default prompts initialization flag.');
        } else {
          _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.warn('Default prompt initialization failed. Flag not set.');
        }
      } else {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Default prompts initialization flag is already set. Skipping.');
      }
    } catch (error) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error during default prompt initialization check:', error);
    }
  } else {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Reason is "${details.reason}", skipping default prompt initialization.`);
  }

  // --- Core Initialization ---
  // Run general initialization on both install and update.
  // It's generally safe to run this multiple times.
  try {
    await initializeExtension();
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Core extension initialization completed.');
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Failed to complete core extension initialization after install/update event.');
  }
}

// Setup installation handler
chrome.runtime.onInstalled.addListener(handleInstallation);

/***/ }),

/***/ "./src/background/listeners/tab-listener.js":
/*!**************************************************!*\
  !*** ./src/background/listeners/tab-listener.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   setupTabListener: () => (/* binding */ setupTabListener)
/* harmony export */ });
/* harmony import */ var _services_platform_integration_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../services/platform-integration.js */ "./src/background/services/platform-integration.js");
/* harmony import */ var _services_content_extraction_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../services/content-extraction.js */ "./src/background/services/content-extraction.js");
/* harmony import */ var _core_state_manager_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../core/state-manager.js */ "./src/background/core/state-manager.js");
/* harmony import */ var _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../services/SidebarStateManager.js */ "./src/services/SidebarStateManager.js");
/* harmony import */ var _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _shared_constants_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../shared/constants.js */ "./src/shared/constants.js");
/* harmony import */ var _shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../shared/utils/content-utils.js */ "./src/shared/utils/content-utils.js");
// src/background/listeners/tab-listener.js - Tab update monitoring









/**
 * Set up tab update and activation listeners
 */
function setupTabListener() {
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  chrome.tabs.onActivated.addListener(handleTabActivation); // Add activation listener
  chrome.tabs.onCreated.addListener(handleTabCreation); // Add creation listener
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.info('Tab update, activation, and creation listeners initialized'); // Update log message
}

/**
 * Handle tab update events
 * @param {number} tabId - Tab ID that was updated
 * @param {Object} changeInfo - Information about the change
 * @param {Object} tab - Tab information
 */
async function handleTabUpdate(tabId, changeInfo, tab) {
  // --- Platform Tab Injection Logic ---
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Get the current AI platform tab information
      const {
        tabId: aiPlatformTabId,
        platformId,
        scriptInjected
      } = await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_2__.getPlatformTabInfo)();

      // Check if this is our AI platform tab
      if (tabId !== aiPlatformTabId || scriptInjected) {
        return;
      }

      // Check if this is a platform tab based on URL
      const isPlatform = (0,_services_platform_integration_js__WEBPACK_IMPORTED_MODULE_0__.isPlatformTab)(tabId, tab.url, platformId);
      if (!isPlatform) {
        return;
      }
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.info(`${platformId} tab detected and loaded: ${tabId}`, {
        url: tab.url
      });

      // Get the appropriate content script
      const contentScript = (0,_services_platform_integration_js__WEBPACK_IMPORTED_MODULE_0__.getPlatformContentScript)(platformId);

      // Inject content script
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.info(`Injecting ${platformId} content script into tab: ${tabId}`);
      const injectionSuccess = await (0,_services_content_extraction_js__WEBPACK_IMPORTED_MODULE_1__.injectContentScript)(tabId, contentScript);
      if (!injectionSuccess) {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.error(`Failed to inject platform content script for ${platformId}`);
        return;
      }
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.info(`Setting scriptInjected flag to true for tab: ${tabId}`);
      await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_2__.updateScriptInjectionStatus)(true);

      // Verify extracted content is available
      const {
        extractedContent
      } = await chrome.storage.local.get(_shared_constants_js__WEBPACK_IMPORTED_MODULE_5__.STORAGE_KEYS.EXTRACTED_CONTENT);
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.info('Content available for AI platform:', {
        hasContent: !!extractedContent,
        contentType: extractedContent?.contentType
      });
    } catch (error) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.error(`Error handling platform tab injection for tab ${tabId}:`, error);
    }
  }

  // --- Side Panel Navigation Detection Logic ---
  // Check if the URL changed or the tab finished loading (status === 'complete')
  if ((changeInfo.status === 'complete' || changeInfo.url) && tab.url) {
    try {
      // Check if the side panel is *intended* to be visible for this tab
      const isVisible = await _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_3___default().getSidebarVisibilityForTab(tabId);
      if (isVisible) {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.info(`Tab ${tabId} navigated to ${tab.url}. Side panel is relevant. Checking content type.`);
        const newContentType = (0,_shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_6__.determineContentType)(tab.url);

        // Send message to the runtime (listened to by SidebarApp)
        chrome.runtime.sendMessage({
          action: 'pageNavigated',
          tabId: tabId,
          newUrl: tab.url,
          newContentType: newContentType
        });
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.info(`Sent 'pageNavigated' message for tab ${tabId} with new URL and type: ${newContentType}`);
      }
      // No need for an else block, if not visible, we do nothing.
    } catch (error) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.error(`Error handling side panel navigation detection for tab ${tabId}:`, error);
    }
  }
}

/**
 * Handle tab activation events to set the side panel state
 * @param {Object} activeInfo - Information about the activated tab
 * @param {number} activeInfo.tabId - The ID of the activated tab
 */
async function handleTabActivation(activeInfo) {
  const {
    tabId
  } = activeInfo;
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.info(`Tab activation handler running for tabId: ${tabId}`);
  try {
    // Retrieve the intended visibility state for the activated tab
    const isVisible = await _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_3___default().getSidebarVisibilityForTab(tabId);
    // Removed log printing retrieved visibility state

    // Conditionally set side panel options based on stored visibility
    if (isVisible) {
      // Enable and set the path ONLY if it should be visible
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: `sidepanel.html?tabId=${tabId}`,
        enabled: true
      });
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.info(`Side panel enabled for activated tab ${tabId}`); // Simplified log
    } else {
      // Disable the panel if it shouldn't be visible
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        enabled: false
      });
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.info(`Side panel disabled for activated tab ${tabId}`);
    }
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.error(`Error setting side panel options for activated tab ${tabId}:`, error);
  }
}

/**
 * Handle tab creation events to initialize side panel state
 * @param {Object} newTab - Information about the newly created tab
 */
async function handleTabCreation(newTab) {
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.info(`Tab creation handler running for new tabId: ${newTab.id}`);
  try {
    // Store the initial visibility state (false) without enabling/disabling the panel itself
    await _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_3___default().setSidebarVisibilityForTab(newTab.id, false);
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.info(`Initial sidebar state (visible: false) stored for new tab ${newTab.id}`);
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_4___default().background.error(`Error storing initial side panel state for new tab ${newTab.id}:`, error);
  }
}

/***/ }),

/***/ "./src/background/listeners/tab-state-listener.js":
/*!********************************************************!*\
  !*** ./src/background/listeners/tab-state-listener.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   clearSingleTabData: () => (/* binding */ clearSingleTabData),
/* harmony export */   handleClearTabDataRequest: () => (/* binding */ handleClearTabDataRequest),
/* harmony export */   performStaleTabCleanup: () => (/* binding */ performStaleTabCleanup),
/* harmony export */   setupTabStateListener: () => (/* binding */ setupTabStateListener)
/* harmony export */ });
/* harmony import */ var _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../shared/constants.js */ "./src/shared/constants.js");
/* harmony import */ var _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../services/SidebarStateManager.js */ "./src/services/SidebarStateManager.js");
/* harmony import */ var _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_2__);
// src/background/listeners/tab-state-listener.js





// List of tab-specific storage keys to clear on manual refresh (excluding sidebar visibility)
const TAB_SPECIFIC_DATA_KEYS_TO_CLEAR = [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_CHAT_HISTORIES, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_TOKEN_STATISTICS, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SYSTEM_PROMPTS, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_MODEL_PREFERENCES, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_PLATFORM_PREFERENCES, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_FORMATTED_CONTENT
// Note: TAB_SIDEBAR_STATES is intentionally excluded to preserve visibility state during manual refresh.
];

// List of all storage keys that are tab-specific and need automatic cleanup (used for onRemoved/periodic cleanup)
// This includes TAB_SIDEBAR_STATES which is handled by SidebarStateManager.cleanupTabStates
const ALL_TAB_SPECIFIC_KEYS_FOR_CLEANUP = [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_FORMATTED_CONTENT, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_PLATFORM_PREFERENCES, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_MODEL_PREFERENCES, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SIDEBAR_STATES,
// Included for the loop, but handled separately
_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_CHAT_HISTORIES, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_TOKEN_STATISTICS, _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SYSTEM_PROMPTS];

/**
 * Clears specified storage data for a single tab.
 * Used for the manual refresh action initiated from the UI.
 * @param {number} tabId - The ID of the tab to clear data for.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
async function clearSingleTabData(tabId) {
  if (typeof tabId !== 'number') {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.error('clearSingleTabData called with invalid tabId:', tabId);
    return false;
  }
  const tabIdStr = tabId.toString();
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Clearing specific data for tab ${tabIdStr}...`);
  try {
    for (const storageKey of TAB_SPECIFIC_DATA_KEYS_TO_CLEAR) {
      // Use the manual refresh list
      const result = await chrome.storage.local.get(storageKey);
      const data = result[storageKey];
      if (data && typeof data === 'object' && data[tabIdStr] !== undefined) {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Found data for key ${storageKey} for tab ${tabIdStr}. Deleting...`);
        delete data[tabIdStr];
        await chrome.storage.local.set({
          [storageKey]: data
        });
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Cleared ${storageKey} for tab ${tabIdStr}.`);
      } else {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`No data found for key ${storageKey} for tab ${tabIdStr}. Skipping.`);
      }
    }
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Successfully cleared specified data for tab ${tabIdStr}.`);
    return true;
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.error(`Error clearing data for tab ${tabIdStr}:`, error);
    return false;
  }
}

/**
 * Handles the 'clearTabData' message request from the UI (e.g., sidebar refresh button).
 * @param {object} message - The message object containing the tabId.
 * @param {chrome.runtime.MessageSender} sender - The sender of the message.
 * @param {function} sendResponse - Function to call to send the response.
 * @returns {boolean} - True to indicate an asynchronous response.
 */
function handleClearTabDataRequest(message, sender, sendResponse) {
  if (!message.tabId) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.error('handleClearTabDataRequest called without tabId');
    sendResponse({
      success: false,
      error: 'Missing tabId'
    });
    return false; // Return false as sendResponse is called synchronously here
  }

  // Call the async function and handle the promise explicitly
  clearSingleTabData(message.tabId).then(success => {
    if (success) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`handleClearTabDataRequest successful for tab ${message.tabId}, sending success response.`);
      sendResponse({
        success: true
      });
    } else {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.warn(`handleClearTabDataRequest failed for tab ${message.tabId}, sending failure response.`);
      sendResponse({
        success: false,
        error: 'Failed to clear tab data in background'
      });
    }
  }).catch(error => {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.error('Error during clearSingleTabData execution in handler:', error);
    sendResponse({
      success: false,
      error: 'Internal error during tab data clearing'
    });
  });
  return true; // Keep channel open for async response
}

/**
 * Clean up a specific tab-based storage item. Used internally by automatic cleanup processes.
 * @param {string} storageKey - The storage key to clean up (e.g., STORAGE_KEYS.TAB_CHAT_HISTORIES).
 * @param {number|null} tabId - Tab ID to remove (for single tab cleanup on close). If null, uses validTabIds.
 * @param {Set<number>|null} [validTabIds=null] - Set of currently open tab IDs (for periodic cleanup). If null, uses tabId.
 * @returns {Promise<boolean>} - True if changes were made, false otherwise.
 */
async function cleanupTabStorage(storageKey, tabId, validTabIds = null) {
  try {
    // Get the current storage data for the specified key
    const storageData = await chrome.storage.local.get(storageKey);
    if (!storageData[storageKey] || typeof storageData[storageKey] !== 'object') {
      return false; // No data or invalid data structure for this key, no changes needed
    }
    const currentData = storageData[storageKey];
    let updatedData = {
      ...currentData
    }; // Create a mutable copy to modify
    let hasChanges = false;
    if (validTabIds instanceof Set) {
      // Periodic Cleanup Mode (onStartup / Service Worker Wake-up) ---
      // Remove entries for tabs that are NOT in the validTabIds set.
      for (const storedTabIdStr of Object.keys(updatedData)) {
        const storedTabId = parseInt(storedTabIdStr, 10);
        // Check if the stored ID is valid number AND if it's NOT present in the set of currently open tabs
        if (isNaN(storedTabId) || !validTabIds.has(storedTabId)) {
          delete updatedData[storedTabIdStr]; // Delete data for the closed/invalid tab
          hasChanges = true;
          _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Periodic cleanup: Removed stale ${storageKey} data for tab ID ${storedTabIdStr}`);
        }
        // If the storedTabId *is* in validTabIds, it's kept.
      }
    } else if (typeof tabId === 'number') {
      // Single Tab Cleanup Mode (onRemoved) ---
      // Remove the entry specifically for the closed tab ID.
      const tabIdStr = tabId.toString();
      if (updatedData.hasOwnProperty(tabIdStr)) {
        delete updatedData[tabIdStr];
        hasChanges = true;
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`onRemoved cleanup: Removed ${storageKey} data for tab ${tabIdStr}.`);
      }
    } else {
      // Invalid parameters for cleanup mode
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.warn(`cleanupTabStorage called with invalid parameters for ${storageKey}. Mode ambiguity.`);
      return false;
    }

    // Save changes back to storage only if modifications were made
    if (hasChanges) {
      await chrome.storage.local.set({
        [storageKey]: updatedData
      });
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Successfully saved updated data for ${storageKey} after cleanup.`);
    }
    return hasChanges;
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.error(`Error cleaning up ${storageKey}:`, error);
    return false; // Indicate failure on error
  }
}

/**
 * Set up tab state cleanup listeners (Handles tab removal).
 */
function setupTabStateListener() {
  // Clean up tab states when tabs are closed
  chrome.tabs.onRemoved.addListener(async (tabId /* removedTabId */, removeInfo) => {
    // Check if the browser window is closing; if so, onStartup cleanup will handle it later.
    if (removeInfo.isWindowClosing) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Window closing, skipping onRemoved cleanup for tab ${tabId}. Startup cleanup will handle.`);
      return;
    }
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Tab ${tabId} closed, cleaning up tab-specific state via onRemoved.`);
    try {
      // Clean up all general tab-specific storage keys
      for (const storageKey of ALL_TAB_SPECIFIC_KEYS_FOR_CLEANUP) {
        // Skip sidebar state in this loop; handled separately below.
        if (storageKey !== _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SIDEBAR_STATES) {
          await cleanupTabStorage(storageKey, tabId, null); // Pass tabId for single removal, validTabIds=null
        }
      }
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`General tab data cleanup completed for closed tab ${tabId}.`);

      // Use SidebarStateManager to specifically clean its state for the removed tab
      await _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_1___default().cleanupTabStates([tabId], null); // Pass removed tabId for targeted cleanup
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Sidebar state cleanup completed for closed tab ${tabId}.`);
    } catch (error) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.error(`Error cleaning up tab-specific data on tab removal (tabId: ${tabId}):`, error);
    }

    // Also attempt to disable the side panel for the closed tab, if it was enabled.
    // This might fail if the tab is truly gone, so catch errors gracefully.
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Attempting to disable side panel for closed tab ${tabId}`);
    try {
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        enabled: false
      });
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Successfully requested side panel disable for closed tab ${tabId}.`);
    } catch (err) {
      // Log warning, but don't throw - tab might already be gone or panel wasn't open/relevant
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.warn(`Could not disable side panel for closed tab ${tabId} (likely expected):`, err.message);
    }
  });
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info('Tab state listener initialized (cleanup onRemoved).');
}

/**
 * Performs cleanup of stale tab-specific data from storage based on currently open tabs.
 * Iterates through known tab-specific keys and removes entries for tabs that no longer exist.
 * This function is called on browser startup and service worker initialization.
 */
async function performStaleTabCleanup() {
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info('Running stale tab data cleanup...');
  try {
    // Get all currently open tabs
    const tabs = await chrome.tabs.query({});
    const validTabIds = new Set(tabs.map(tab => tab.id)); // Set of IDs for open tabs
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Found ${validTabIds.size} currently open tabs.`);

    // Clean up all general tab-specific storage keys based on the valid IDs
    for (const storageKey of ALL_TAB_SPECIFIC_KEYS_FOR_CLEANUP) {
      // Skip sidebar state in this loop; handled separately below.
      if (storageKey !== _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SIDEBAR_STATES) {
        await cleanupTabStorage(storageKey, null, validTabIds); // Pass validTabIds for periodic removal, tabId=null
      }
    }
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`General stale tab data cleanup processing completed.`);

    // Use SidebarStateManager to clean its state based on valid IDs
    await _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_1___default().cleanupTabStates(null, validTabIds); // Pass validTabIds for periodic cleanup
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Sidebar stale state cleanup completed.`);
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info('Stale tab data cleanup finished successfully.');
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.error('Error during stale tab data cleanup execution:', error);
  }
}

/***/ }),

/***/ "./src/background/services/content-extraction.js":
/*!*******************************************************!*\
  !*** ./src/background/services/content-extraction.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   extractContent: () => (/* binding */ extractContent),
/* harmony export */   injectContentScript: () => (/* binding */ injectContentScript)
/* harmony export */ });
/* harmony import */ var _shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../shared/utils/content-utils.js */ "./src/shared/utils/content-utils.js");
/* harmony import */ var _shared_constants_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../shared/constants.js */ "./src/shared/constants.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_2__);
// src/background/services/content-extraction.js - Content extraction coordination

 // Import isInjectablePage



/**
 * Extract content from a tab
 * @param {number} tabId - Tab ID to extract content from
 * @param {string} url - URL of the page
 * @returns {Promise<boolean>} Success indicator
 */
async function extractContent(tabId, url) {
  // Check if the page is injectable before proceeding
  if (!(0,_shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_0__.isInjectablePage)(url)) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.warn(`Cannot extract content from non-injectable URL: ${url}`);
    await chrome.storage.local.set({
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_1__.STORAGE_KEYS.CONTENT_READY]: false,
      [_shared_constants_js__WEBPACK_IMPORTED_MODULE_1__.STORAGE_KEYS.EXTRACTED_CONTENT]: null
    });
    return false;
  }
  const contentType = (0,_shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_0__.determineContentType)(url);
  // Use a single content script for all types
  const scriptFile = 'dist/content-script.bundle.js';
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Extracting content from tab ${tabId}, type: ${contentType}`);

  // Always inject the content script
  const result = await injectContentScript(tabId, scriptFile);
  if (!result) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.error(`Failed to inject content script into tab ${tabId}`);
    return false; // Stop if injection fails
  }

  // Always reset previous extraction state after successful injection
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'resetExtractor'
    });
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info('Reset command sent to extractor');
  } catch (error) {
    // Log error but potentially continue if reset fails, as extraction might still work
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.error('Error sending reset command:', error);
  }

  // Return promise that resolves when content extraction completes
  return new Promise(resolve => {
    const storageListener = (changes, area) => {
      if (area === 'local' && changes[_shared_constants_js__WEBPACK_IMPORTED_MODULE_1__.STORAGE_KEYS.CONTENT_READY]?.newValue === true) {
        clearTimeout(timeoutId); // Ensure timeout is cleared on success
        chrome.storage.onChanged.removeListener(storageListener);
        resolve(true);
      }
    };
    chrome.storage.onChanged.addListener(storageListener);

    // Send extraction command
    chrome.tabs.sendMessage(tabId, {
      action: 'extractContent',
      contentType: contentType
    });

    // Failsafe timeout
    const timeoutId = setTimeout(() => {
      chrome.storage.onChanged.removeListener(storageListener);
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.warn(`Extraction timeout for ${contentType}, proceeding anyway`);
      resolve(false);
    }, 15000);
  });
}

/**
 * Inject content script into tab
 * @param {number} tabId - Tab ID to inject into
 * @param {string} scriptFile - Script file to inject
 * @returns {Promise<boolean>} Success flag
 */
async function injectContentScript(tabId, scriptFile) {
  try {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Injecting script: ${scriptFile} into tab: ${tabId}`);
    await chrome.scripting.executeScript({
      target: {
        tabId
      },
      files: [scriptFile]
    });
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.info(`Successfully injected script: ${scriptFile} into tab: ${tabId}`);
    return true;
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_2___default().background.error(`Script injection error for tab ${tabId}:`, error);
    return false;
  }
}

/***/ }),

/***/ "./src/background/services/content-processing.js":
/*!*******************************************************!*\
  !*** ./src/background/services/content-processing.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleProcessContentRequest: () => (/* binding */ handleProcessContentRequest),
/* harmony export */   handleProcessContentViaApiRequest: () => (/* binding */ handleProcessContentViaApiRequest),
/* harmony export */   processContent: () => (/* binding */ processContent)
/* harmony export */ });
/* harmony import */ var _shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../shared/utils/content-utils.js */ "./src/shared/utils/content-utils.js");
/* harmony import */ var _content_extraction_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./content-extraction.js */ "./src/background/services/content-extraction.js");
/* harmony import */ var _platform_integration_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./platform-integration.js */ "./src/background/services/platform-integration.js");
/* harmony import */ var _core_state_manager_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../core/state-manager.js */ "./src/background/core/state-manager.js");
/* harmony import */ var _api_api_coordinator_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../api/api-coordinator.js */ "./src/background/api/api-coordinator.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _shared_constants_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../../shared/constants.js */ "./src/shared/constants.js");
/* harmony import */ var _services_ContentFormatter_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../../services/ContentFormatter.js */ "./src/services/ContentFormatter.js");
/* harmony import */ var _services_ContentFormatter_js__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(_services_ContentFormatter_js__WEBPACK_IMPORTED_MODULE_7__);
// src/background/services/content-processing.js - Content processing










/**
 * Process content using web AI interface (non-API path)
 * Used by popup to extract content and send to web UI
 * @param {Object} params - Processing parameters
 * @returns {Promise<Object>} Result information
 */
async function processContent(params) {
  const {
    tabId,
    url,
    platformId = null,
    promptContent = null,
    useApi = false
  } = params;
  try {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info('Starting web UI content processing', {
      tabId,
      url,
      platformId
    });

    // If API mode requested, use API path
    if (useApi) {
      return await (0,_api_api_coordinator_js__WEBPACK_IMPORTED_MODULE_4__.processContentViaApi)(params);
    }

    // Check if page is injectable BEFORE attempting extraction
    if (!(0,_shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_0__.isInjectablePage)(url)) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.warn(`processContent: Page is not injectable (${url}). Skipping extraction.`);
      return {
        success: false,
        error: 'Content extraction not supported on this page.',
        code: 'EXTRACTION_NOT_SUPPORTED'
      };
    }

    // Check for prompt content
    if (!promptContent) {
      return {
        success: false,
        error: 'No prompt content provided'
      };
    }

    // 1. Reset previous state
    await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_3__.resetExtractionState)();

    // 2. Extract content
    const contentType = (0,_shared_utils_content_utils_js__WEBPACK_IMPORTED_MODULE_0__.determineContentType)(url);
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info(`Content type determined: ${contentType}`);
    const extractionResult = await (0,_content_extraction_js__WEBPACK_IMPORTED_MODULE_1__.extractContent)(tabId, url);
    if (!extractionResult) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.warn('Content extraction completed with issues');
    }

    // 3. Get extracted content and check for specific errors
    const {
      extractedContent
    } = await chrome.storage.local.get(_shared_constants_js__WEBPACK_IMPORTED_MODULE_6__.STORAGE_KEYS.EXTRACTED_CONTENT);
    if (!extractedContent) {
      throw new Error('Failed to extract content');
    }

    // 4. Format content
    const formattedContentString = _services_ContentFormatter_js__WEBPACK_IMPORTED_MODULE_7___default().formatContent(extractedContent, contentType);

    // 5. Get platform and open it with content
    const effectivePlatformId = platformId;
    const aiPlatformTabId = await (0,_platform_integration_js__WEBPACK_IMPORTED_MODULE_2__.openAiPlatformWithContent)(effectivePlatformId);
    if (!aiPlatformTabId) {
      return {
        success: false,
        error: 'Failed to open AI platform tab'
      };
    }

    // Save tab information for later, including the formatted content
    await (0,_core_state_manager_js__WEBPACK_IMPORTED_MODULE_3__.savePlatformTabInfo)(aiPlatformTabId, effectivePlatformId, promptContent, formattedContentString);
    return {
      success: true,
      aiPlatformTabId,
      contentType
    };
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.error('Error in processContent:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Handle process content request from message
 * @param {Object} message - Message object
 * @param {Function} sendResponse - Response function
 */
async function handleProcessContentRequest(message, sendResponse) {
  try {
    const {
      tabId,
      platformId,
      url,
      promptContent,
      useApi
    } = message;
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info(`Process content request for tab ${tabId}`, {
      platformId,
      useApi
    });

    // Call appropriate processing function based on API flag
    const result = useApi ? await (0,_api_api_coordinator_js__WEBPACK_IMPORTED_MODULE_4__.processContentViaApi)(message) : await processContent(message);
    sendResponse(result);
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.error('Error handling process content request:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle API content processing request from message
 * @param {Object} message - Message object
 * @param {Function} sendResponse - Response function
 */
async function handleProcessContentViaApiRequest(message, sendResponse) {
  try {
    const result = await (0,_api_api_coordinator_js__WEBPACK_IMPORTED_MODULE_4__.processContentViaApi)(message);
    sendResponse(result);
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.error('Error in API content processing:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/***/ }),

/***/ "./src/background/services/credential-manager.js":
/*!*******************************************************!*\
  !*** ./src/background/services/credential-manager.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleCredentialOperation: () => (/* binding */ handleCredentialOperation),
/* harmony export */   verifyApiCredentials: () => (/* binding */ verifyApiCredentials)
/* harmony export */ });
/* harmony import */ var _services_CredentialManager_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../services/CredentialManager.js */ "./src/services/CredentialManager.js");
/* harmony import */ var _services_CredentialManager_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_services_CredentialManager_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_1__);
// src/background/services/credential-manager.js - Credential management




/**
 * Handle credential operation request
 * @param {Object} message - Message with operation details
 * @param {Function} sendResponse - Response function
 */
async function handleCredentialOperation(message, sendResponse) {
  try {
    const {
      operation,
      platformId,
      credentials
    } = message;
    switch (operation) {
      case 'get':
        const storedCredentials = await _services_CredentialManager_js__WEBPACK_IMPORTED_MODULE_0___default().getCredentials(platformId);
        sendResponse({
          success: true,
          credentials: storedCredentials
        });
        break;
      case 'store':
        const storeResult = await _services_CredentialManager_js__WEBPACK_IMPORTED_MODULE_0___default().storeCredentials(platformId, credentials);
        sendResponse({
          success: storeResult
        });
        break;
      case 'remove':
        const removeResult = await _services_CredentialManager_js__WEBPACK_IMPORTED_MODULE_0___default().removeCredentials(platformId);
        sendResponse({
          success: removeResult
        });
        break;
      case 'validate':
        const validationResult = await _services_CredentialManager_js__WEBPACK_IMPORTED_MODULE_0___default().validateCredentials(platformId, credentials);
        sendResponse({
          success: true,
          validationResult
        });
        break;
      default:
        throw new Error(`Unknown credential operation: ${operation}`);
    }
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error in credential operation:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Verify API credentials exist for a platform
 * @param {string} platformId - Platform identifier
 * @returns {Promise<boolean>} True if valid credentials exist
 */
async function verifyApiCredentials(platformId) {
  try {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Verifying API credentials for ${platformId}`);
    const hasCredentials = await _services_CredentialManager_js__WEBPACK_IMPORTED_MODULE_0___default().hasCredentials(platformId);
    if (!hasCredentials) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error(`No API credentials found for ${platformId}`);
      throw new Error(`No API credentials found for ${platformId}`);
    }
    return true;
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error(`Credential verification error: ${error.message}`);
    throw error;
  }
}

/***/ }),

/***/ "./src/background/services/platform-integration.js":
/*!*********************************************************!*\
  !*** ./src/background/services/platform-integration.js ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getPlatformContentScript: () => (/* binding */ getPlatformContentScript),
/* harmony export */   isPlatformTab: () => (/* binding */ isPlatformTab),
/* harmony export */   openAiPlatformWithContent: () => (/* binding */ openAiPlatformWithContent)
/* harmony export */ });
/* harmony import */ var _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../shared/constants.js */ "./src/shared/constants.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _services_ConfigService_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../services/ConfigService.js */ "./src/services/ConfigService.js");
/* harmony import */ var _services_ConfigService_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_services_ConfigService_js__WEBPACK_IMPORTED_MODULE_2__);
// src/background/services/platform-integration.js - AI platform interactions





/**
 * Get platform content script path
 * @param {string} platformId - Platform identifier
 * @returns {string} Path to content script
 */
function getPlatformContentScript() {
  return 'dist/platform-content.bundle.js';
}

/**
 * Open AI platform with extracted content
 * @param {string} contentType - Content type
 * @param {string} promptId - Prompt ID
 * @param {string} platformId - Platform ID
 * @returns {Promise<number|null>} Tab ID or null
 */
async function openAiPlatformWithContent(platformId) {
  try {
    // Prepare platform and prompt information
    const effectivePlatformId = platformId;
    if (!effectivePlatformId) {
      throw new Error('Platform ID must be provided to openAiPlatformWithContent');
    }

    // Get display config from ConfigService
    const platformDisplayInfo = await _services_ConfigService_js__WEBPACK_IMPORTED_MODULE_2___default().getPlatformDisplayConfig(effectivePlatformId);
    if (!platformDisplayInfo || !platformDisplayInfo.url || !platformDisplayInfo.name) {
      throw new Error(`Could not load display config (url, name) for platform: ${effectivePlatformId}`);
    }

    // Open platform in a new tab using display info
    const platformUrl = platformDisplayInfo.url;
    const platformName = platformDisplayInfo.name;
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Opening ${platformName} at URL: ${platformUrl}`);
    const newTab = await chrome.tabs.create({
      url: platformUrl
    });
    if (!newTab || !newTab.id) {
      throw new Error(`Failed to create ${platformName} tab or get tab ID`);
    }
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`${platformName} tab created with ID: ${newTab.id}`);
    return newTab.id;
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error opening AI platform:', error);
    return null;
  }
}

/**
 * Check if a tab is a platform tab
 * @param {number} tabId - Tab ID to check
 * @param {string} url - Tab URL
 * @param {string} platformId - Platform ID
 * @returns {boolean} Whether this is a platform tab
 */
function isPlatformTab(tabId, url, platformId) {
  let isPlatformTab = false;
  if (platformId === _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.AI_PLATFORMS.CLAUDE && url.includes('claude.ai')) {
    isPlatformTab = true;
  } else if (platformId === _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.AI_PLATFORMS.CHATGPT && url.includes('chatgpt.com')) {
    isPlatformTab = true;
  } else if (platformId === _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.AI_PLATFORMS.DEEPSEEK && url.includes('chat.deepseek.com')) {
    isPlatformTab = true;
  } else if (platformId === _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.AI_PLATFORMS.MISTRAL && url.includes('chat.mistral.ai')) {
    isPlatformTab = true;
  } else if (platformId === _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.AI_PLATFORMS.GEMINI && url.includes('gemini.google.com')) {
    isPlatformTab = true;
  } else if (platformId === _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.AI_PLATFORMS.GROK && url.includes('grok.com')) {
    isPlatformTab = true;
  }
  return isPlatformTab;
}

/***/ }),

/***/ "./src/background/services/sidebar-manager.js":
/*!****************************************************!*\
  !*** ./src/background/services/sidebar-manager.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getSidebarState: () => (/* binding */ getSidebarState),
/* harmony export */   handleToggleNativeSidePanelAction: () => (/* binding */ handleToggleNativeSidePanelAction),
/* harmony export */   toggleNativeSidePanel: () => (/* binding */ toggleNativeSidePanel)
/* harmony export */ });
/* harmony import */ var _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../services/SidebarStateManager.js */ "./src/services/SidebarStateManager.js");
/* harmony import */ var _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_1__);
// src/background/services/sidebar-manager.js - Tab-specific native side panel management




/**
 * Toggle native side panel visibility for a specific tab.
 * @param {Object} message - Message object containing optional `tabId` and `visible` properties.
 * @param {Object} sender - Message sender, potentially containing `sender.tab.id`.
 * @param {Function} sendResponse - Function to send the response back.
 */
async function toggleNativeSidePanel(message, sender, sendResponse) {
  let targetTabId;
  let newState; // To store the final state (true for open, false for closed)
  try {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Handling native side panel toggle request (Refactored)');

    // Determine the target tab ID
    const explicitTabId = message?.tabId || sender?.tab?.id;
    if (explicitTabId) {
      targetTabId = explicitTabId;
    } else {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });
      if (!activeTab?.id) {
        throw new Error('No active tab found to target for side panel toggle.');
      }
      targetTabId = activeTab.id;
    }
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Targeting tab ${targetTabId} for side panel operation.`);

    // Read the current *intended* state from storage
    const currentState = await _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_0___default().getSidebarVisibilityForTab(targetTabId);
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Current stored visibility for tab ${targetTabId}: ${currentState}`);

    // Determine the new state and perform actions
    if (currentState === false) {
      // Current state is closed, so we intend to open (enable) it
      newState = true;
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Action: Enable side panel for tab ${targetTabId}`);
      await _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_0___default().setSidebarVisibilityForTab(targetTabId, true);
      await chrome.sidePanel.setOptions({
        tabId: targetTabId,
        path: `sidepanel.html?tabId=${targetTabId}`,
        // Pass tabId via URL
        enabled: true
      });
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Side panel enabled and path set for tab ${targetTabId}.`);
    } else {
      // Current state is open, so we intend to close (disable) it
      newState = false;
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Action: Disable side panel for tab ${targetTabId}`);
      await _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_0___default().setSidebarVisibilityForTab(targetTabId, false);
      await chrome.sidePanel.setOptions({
        tabId: targetTabId,
        enabled: false
      });
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info(`Side panel disabled for tab ${targetTabId}.`);
    }
    sendResponse({
      success: true,
      visible: newState,
      // Send back the new intended state
      tabId: targetTabId,
      message: `Side panel state updated for tab ${targetTabId}. Intended visibility: ${newState}.`
    });
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error(`Error handling native side panel toggle for tab ${targetTabId || 'unknown'}:`, error);
    // If an error occurred, the actual panel state might not match the intended state.
    // We send back the intended newState if determined, otherwise report failure.
    sendResponse({
      success: false,
      error: error.message,
      tabId: targetTabId,
      visible: newState // Include intended state if available, even on error
    });
  }
}

/**
 * Handles the 'toggleNativeSidePanelAction' message request.
 * @param {object} message - The message object.
 * @param {chrome.runtime.MessageSender} sender - The sender of the message.
 * @param {function} sendResponse - Function to call to send the response.
 * @returns {boolean} - True to indicate an asynchronous response.
 */
function handleToggleNativeSidePanelAction(message, sender, sendResponse) {
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.info('Received toggleNativeSidePanelAction request via message router');
  // Call the actual function which handles the logic and response
  toggleNativeSidePanel(message, sender, sendResponse);
  // toggleNativeSidePanel is async and handles sendResponse itself
  return true; // Keep channel open for async response
}

/**
 * Get sidebar state for specific tab
 * @param {Object} message - Message object
 * @param {Object} sender - Message sender
 * @param {Function} sendResponse - Response function
 */
async function getSidebarState(message, sender, sendResponse) {
  try {
    // Get target tab ID (same logic as toggle)
    const tabId = message.tabId || sender.tab && sender.tab.id;
    let targetTabId;
    if (!tabId) {
      // Get active tab if no tab ID specified
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) {
        throw new Error('No active tab found');
      }
      targetTabId = activeTab.id;
    } else {
      targetTabId = tabId;
    }
    const state = await _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_0___default().getSidebarState(targetTabId);
    sendResponse({
      success: true,
      state,
      tabId: targetTabId
    });
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error handling tab-specific sidebar state query:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/***/ }),

/***/ "./src/background/services/theme-service.js":
/*!**************************************************!*\
  !*** ./src/background/services/theme-service.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleThemeOperation: () => (/* binding */ handleThemeOperation)
/* harmony export */ });
/* harmony import */ var _shared_constants_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../shared/constants.js */ "./src/shared/constants.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_1__);
// src/background/services/theme-service.js - Theme synchronization services




/**
 * Handle theme operation requests
 * @param {Object} message - Message with operation details
 * @param {Function} sendResponse - Response function
 */
async function handleThemeOperation(message, sendResponse) {
  try {
    const {
      action,
      theme
    } = message;
    switch (action) {
      case 'getTheme':
        const result = await chrome.storage.sync.get(_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.THEME_PREFERENCE);
        sendResponse({
          success: true,
          theme: result[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.THEME_PREFERENCE] || 'light'
        });
        break;
      case 'setTheme':
        if (!theme) {
          throw new Error('Theme value is required for setTheme operation');
        }
        await chrome.storage.sync.set({
          [_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.THEME_PREFERENCE]: theme
        });

        // Notify only tabs with active sidebars about theme change
        const sidebarStateResult = await chrome.storage.local.get(_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SIDEBAR_STATES);
        const sidebarStates = sidebarStateResult[_shared_constants_js__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEYS.TAB_SIDEBAR_STATES] || {};
        const targetTabIds = [];
        for (const [tabIdStr, isVisible] of Object.entries(sidebarStates)) {
          if (isVisible) {
            const tabId = parseInt(tabIdStr, 10);
            // Basic check if parsing was successful (tab IDs should always be numbers)
            if (!isNaN(tabId)) {
              targetTabIds.push(tabId);
            } else {
              _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.warn(`Invalid tab ID found in sidebar states: ${tabIdStr}`);
            }
          }
        }
        for (const tabId of targetTabIds) {
          try {
            await chrome.tabs.sendMessage(tabId, {
              action: 'themeUpdated',
              theme
            });
          } catch (error) {
            if (error.message && (error.message.includes('Could not establish connection') || error.message.includes('Receiving end does not exist'))) {
              _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.warn(`Could not send theme update to active sidebar tab ${tabId}: Receiving end does not exist.`);
            } else {
              _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error(`Failed to send theme update to active sidebar tab ${tabId}:`, error);
            }
          }
        }
        sendResponse({
          success: true,
          theme
        });
        break;
      default:
        throw new Error(`Unknown theme operation: ${action}`);
    }
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_1___default().background.error('Error in theme operation:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/***/ }),

/***/ "./src/services/ApiServiceManager.js":
/*!*******************************************!*\
  !*** ./src/services/ApiServiceManager.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/services/ApiServiceManager.js

const ApiFactory = __webpack_require__(/*! ../api/api-factory */ "./src/api/api-factory.js");
const CredentialManager = __webpack_require__(/*! ./CredentialManager */ "./src/services/CredentialManager.js");
const ModelParameterService = __webpack_require__(/*! ./ModelParameterService */ "./src/services/ModelParameterService.js");
const logger = (__webpack_require__(/*! ../shared/logger.js */ "./src/shared/logger.js").service);
const ConfigService = __webpack_require__(/*! ./ConfigService */ "./src/services/ConfigService.js");

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
      logger.info(`Processing content through ${platformId} API with unified config:`, {
        hasStreaming: !!requestConfig.streaming,
        hasHistory: Array.isArray(requestConfig.resolvedParams?.conversationHistory) && requestConfig.resolvedParams?.conversationHistory.length > 0,
        model: requestConfig.resolvedParams?.model || 'N/A',
        tabId: requestConfig.resolvedParams?.tabId || 'N/A',
        hasFormattedContent: requestConfig.formattedContent !== null && requestConfig.formattedContent !== undefined
      });

      // Ensure we have the necessary configuration
      if (!requestConfig || !requestConfig.resolvedParams) {
        throw new Error('Request configuration with resolvedParams is required');
      }

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
      const credentialsToUse = credentials || (await this.credentialManager.getCredentials(platformId));
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
      const settings = await ConfigService.getPlatformApiConfig(platformId);
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

/***/ }),

/***/ "./src/services/ConfigService.js":
/*!***************************************!*\
  !*** ./src/services/ConfigService.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/services/ConfigService.js
const logger = __webpack_require__(/*! ../shared/logger.js */ "./src/shared/logger.js"); // Changed from import to require

let cachedApiConfig = null;
let cachedDisplayConfig = null;

/**
 * Internal helper to load configuration with caching.
 * @param {string} urlPath - The path relative to the extension root (e.g., 'platform-api-config.json').
 * @param {object | null} cacheRef - Reference to the module-level cache variable.
 * @returns {Promise<object>} - The loaded configuration object.
 */
async function _loadConfig(urlPath, cacheRef) {
  if (cacheRef) {
    logger.service.info(`ConfigService: Cache hit for ${urlPath}`);
    return cacheRef;
  }
  logger.service.info(`ConfigService: Loading configuration from ${urlPath}...`);
  try {
    const response = await fetch(chrome.runtime.getURL(urlPath));
    if (!response.ok) {
      throw new Error(`Failed to fetch ${urlPath}: ${response.statusText}`);
    }
    const config = await response.json();
    // Update the cache indirectly by returning the loaded config,
    // the caller will assign it to the cache variable.
    logger.service.info(`ConfigService: Successfully loaded ${urlPath}.`);
    return config;
  } catch (error) {
    logger.service.error(`ConfigService: Error loading configuration from ${urlPath}:`, error);
    throw error; // Re-throw to be handled by the caller
  }
}

/**
 * Gets the entire API configuration object, loading and caching if necessary.
 * @returns {Promise<object>} The API configuration object.
 */
async function getApiConfig() {
  if (!cachedApiConfig) {
    cachedApiConfig = await _loadConfig('platform-api-config.json', cachedApiConfig);
  }
  return cachedApiConfig;
}

/**
 * Gets the entire display configuration object, loading and caching if necessary.
 * @returns {Promise<object>} The display configuration object.
 */
async function getDisplayConfig() {
  if (!cachedDisplayConfig) {
    cachedDisplayConfig = await _loadConfig('platform-display-config.json', cachedDisplayConfig);
  }
  return cachedDisplayConfig;
}

/**
 * Gets the API configuration for a specific platform.
 * @param {string} platformId - The ID of the platform.
 * @returns {Promise<object|null>} The API configuration for the platform, or null if not found.
 */
async function getPlatformApiConfig(platformId) {
  try {
    const config = await getApiConfig();
    return config?.aiPlatforms?.[platformId] || null;
  } catch (error) {
    logger.service.error(`ConfigService: Error getting API config for platform ${platformId}:`, error);
    return null;
  }
}

/**
 * Gets the display configuration for a specific platform.
 * @param {string} platformId - The ID of the platform.
 * @returns {Promise<object|null>} The display configuration for the platform, or null if not found.
 */
async function getPlatformDisplayConfig(platformId) {
  try {
    const config = await getDisplayConfig();
    return config?.aiPlatforms?.[platformId] || null;
  } catch (error) {
    logger.service.error(`ConfigService: Error getting display config for platform ${platformId}:`, error);
    return null;
  }
}

/**
 * Gets a combined list of all platform configurations (display + API).
 * Useful for UI components needing comprehensive platform info.
 * @returns {Promise<Array<object>>} A list of combined platform configuration objects.
 */
async function getAllPlatformConfigs() {
  try {
    const [displayConfig, apiConfigData] = await Promise.all([getDisplayConfig(), getApiConfig()]);
    if (!displayConfig?.aiPlatforms || !apiConfigData?.aiPlatforms) {
      throw new Error('AI platforms configuration not found in one or both files');
    }
    const platformList = Object.keys(displayConfig.aiPlatforms).map(id => {
      const displayInfo = displayConfig.aiPlatforms[id];
      const apiInfo = apiConfigData.aiPlatforms[id];
      if (!displayInfo || !apiInfo) {
        logger.service.warn(`ConfigService: Missing config for platform ID: ${id} during getAllPlatformConfigs`);
        return null; // Skip if data is incomplete
      }
      return {
        id,
        name: displayInfo.name,
        url: displayInfo.url,
        iconUrl: chrome.runtime.getURL(displayInfo.icon),
        docApiLink: displayInfo.docApiLink || '#',
        modelApiLink: displayInfo.modelApiLink || '#',
        consoleApiLink: displayInfo.consoleApiLink || '#',
        keyApiLink: displayInfo.keyApiLink || '#',
        apiConfig: apiInfo // Attach the whole API config object
      };
    }).filter(p => p !== null); // Filter out any null entries

    return platformList;
  } catch (error) {
    logger.service.error('ConfigService: Error getting all platform configs:', error);
    return []; // Return empty array on error
  }
}

// Optional: Add a function to clear the cache if needed for hot-reloading during development
function clearConfigCache() {
  cachedApiConfig = null;
  cachedDisplayConfig = null;
  logger.service.info('ConfigService: Cache cleared.');
}

// Define the ConfigService object with all exported functions
const ConfigService = {
  getApiConfig,
  getDisplayConfig,
  getPlatformApiConfig,
  getPlatformDisplayConfig,
  getAllPlatformConfigs,
  clearConfigCache
};
module.exports = ConfigService;

/***/ }),

/***/ "./src/services/ContentFormatter.js":
/*!******************************************!*\
  !*** ./src/services/ContentFormatter.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/services/ContentFormatter.js
const logger = (__webpack_require__(/*! ../shared/logger.js */ "./src/shared/logger.js").service);
class ContentFormatter {
  /**
   * Format content based on content type
   * @param {Object} contentData - The extracted content data
   * @param {string} contentType - The type of content (e.g., 'youtube', 'reddit', 'general', 'pdf')
   * @returns {string} Formatted content
   */
  static formatContent(contentData, contentType) {
    if (!contentData) {
      logger.error('No content data available for formatting');
      return 'No content data available';
    }
    logger.info(`Formatting content of type: ${contentType}`);
    let formatted = '';
    switch (contentType) {
      case 'youtube':
        formatted = this._formatYouTubeData(contentData);
        break;
      case 'reddit':
        formatted = this._formatRedditData(contentData);
        break;
      case 'general':
        formatted = this._formatGeneralData(contentData);
        break;
      case 'pdf':
        formatted = this._formatPdfData(contentData);
        break;
      default:
        logger.warn(`Unknown content type '${contentType}', using JSON stringify`);
        try {
          formatted = `Content Type: ${contentType}\nData: ${JSON.stringify(contentData, null, 2)}`;
        } catch (e) {
          logger.error('Failed to stringify unknown content data:', e);
          formatted = `Content Type: ${contentType}\nData: [Could not stringify]`;
        }
    }
    return formatted;
  }

  /**
   * Format YouTube video data
   * @private
   * @param {Object} data - YouTube video data
   * @returns {string} Formatted YouTube data
   */
  static _formatYouTubeData(data) {
    const title = data.videoTitle || 'No title available';
    const channel = data.channelName || 'Unknown channel';
    const description = data.videoDescription || 'No description available';
    const transcript = data.transcript || 'No transcript available';

    // Format comments with likes
    let commentsText = '';
    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      commentsText = `## COMMENTS\n`;
      data.comments.forEach((comment, index) => {
        commentsText += `${index + 1}. User: ${comment.author || 'Anonymous'} (${comment.likes || '0'} likes)\n  "${comment.text || ''}"\n`;
      });
    }
    return `## VIDEO METADATA\n  - Title: ${title}\n  - Channel: ${channel}\n  - URL: https://www.youtube.com/watch?v=${data.videoId || ''}\n## DESCRIPTION\n${description}\n## TRANSCRIPT\n${transcript}\n${commentsText}`;
  }

  /**
   * Format Reddit post data
   * @private
   * @param {Object} data - Reddit post data
   * @returns {string} Formatted Reddit data
   */
  static _formatRedditData(data) {
    const title = data.postTitle || 'No title available';
    const content = data.postContent || 'No content available';
    const author = data.postAuthor || 'Unknown author';
    const postUrl = data.postUrl || '';
    const subreddit = data.subreddit || 'Unknown subreddit';
    let formattedText = `## POST METADATA\n  - Title: ${title}\n  - Author: ${author}\n  - Subreddit: ${subreddit}\n  - URL: ${postUrl}\n## POST CONTENT\n${content}\n`;

    // Format comments with links
    if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
      formattedText += `## COMMENTS\n`;
      data.comments.forEach((comment, index) => {
        formattedText += `${index + 1}. u/${comment.author || 'Anonymous'} (${comment.popularity || '0'} points) [(link)](${comment.permalink || postUrl})\n  "${comment.content || ''}"\n`;
      });
    }
    return formattedText;
  }

  /**
   * Format general web page data
   * @private
   * @param {Object} data - Web page data
   * @returns {string} Formatted web page data
   */
  static _formatGeneralData(data) {
    const title = data.pageTitle || 'No title available';
    const url = data.pageUrl || 'Unknown URL';
    const content = data.content || 'No content available';
    const author = data.pageAuthor || null;
    const description = data.pageDescription || null;
    let metadataText = `## PAGE METADATA\n  - Title: ${title}\n  - URL: ${url}`;
    if (author) {
      metadataText += `\n  - Author: ${author}`;
    }
    if (description) {
      metadataText += `\n  - Description: ${description}`;
    }
    return `${metadataText}\n## PAGE CONTENT\n${content}`;
  }

  /**
   * Format PDF document data
   * @private
   * @param {Object} data - PDF document data
   * @returns {string} Formatted PDF data
   */
  static _formatPdfData(data) {
    const title = data.pdfTitle || 'Untitled PDF';
    const url = data.pdfUrl || 'Unknown URL';
    const content = data.content || 'No content available';
    const pageCount = data.pageCount || 'Unknown';
    const metadata = data.metadata || {};

    // Format metadata section
    let metadataText = `## PDF METADATA\n  - Title: ${title}\n  - Pages: ${pageCount}\n  - URL: ${url}`;
    if (metadata.author) {
      metadataText += `\n  - Author: ${metadata.author}`;
    }
    if (metadata.creationDate) {
      metadataText += `\n  - Created: ${metadata.creationDate}`;
    }
    if (data.ocrRequired) {
      metadataText += `\n  - Note: This PDF may require OCR as text extraction was limited.`;
    }

    // Format and clean up the content
    let formattedContent = content;

    // Remove JSON artifacts if present
    if (typeof formattedContent === 'string' && formattedContent.includes('{"content":"')) {
      try {
        const contentObj = JSON.parse(formattedContent);
        formattedContent = contentObj.content || formattedContent;
      } catch (e) {
        // If parsing fails, keep the original content
        logger.warn('Failed to parse JSON in PDF content');
      }
    }

    // Clean up page markers to make them more readable
    if (typeof formattedContent === 'string') {
      formattedContent = formattedContent.replace(/--- Page (\d+) ---\n\n/g, '\n\n## PAGE $1\n') // Corrected regex
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple line breaks
      .trim();
    } else {
      logger.warn('PDF content is not a string, skipping cleanup.');
      formattedContent = String(formattedContent); // Ensure it's a string
    }
    return `${metadataText}\n\n## PDF CONTENT\n${formattedContent}`;
  }
}
module.exports = ContentFormatter;

/***/ }),

/***/ "./src/services/CredentialManager.js":
/*!*******************************************!*\
  !*** ./src/services/CredentialManager.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/services/CredentialManager.js
const {
  STORAGE_KEYS
} = __webpack_require__(/*! ../shared/constants */ "./src/shared/constants.js");
const logger = (__webpack_require__(/*! ../shared/logger.js */ "./src/shared/logger.js").service);

/**
 * Service for secure API credential management
 */
class CredentialManager {
  constructor() {
    this.STORAGE_KEY = STORAGE_KEYS.API_CREDENTIALS;
    this.logger = logger;
  }

  /**
   * Get stored credentials for a platform
   * @param {string} platformId - Platform identifier
   * @returns {Promise<Object|null>} Credentials or null if not found
   */
  async getCredentials(platformId) {
    try {
      this.logger.info(`Getting credentials for ${platformId}`);
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
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
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const allCredentials = result[this.STORAGE_KEY] || {};

      // Update credentials for this platform
      allCredentials[platformId] = credentials;
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: allCredentials
      });
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
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      const allCredentials = result[this.STORAGE_KEY] || {};
      if (allCredentials[platformId]) {
        delete allCredentials[platformId];
        await chrome.storage.local.set({
          [this.STORAGE_KEY]: allCredentials
        });
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
      const ApiFactory = __webpack_require__(/*! ../api/api-factory */ "./src/api/api-factory.js");
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
}
const credentialManager = new CredentialManager();
module.exports = credentialManager;

/***/ }),

/***/ "./src/services/ModelParameterService.js":
/*!***********************************************!*\
  !*** ./src/services/ModelParameterService.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// src/services/ModelParameterService.js
const {
  STORAGE_KEYS,
  INTERFACE_SOURCES
} = __webpack_require__(/*! ../shared/constants */ "./src/shared/constants.js");
const logger = (__webpack_require__(/*! ../shared/logger.js */ "./src/shared/logger.js").service);
const ConfigService = __webpack_require__(/*! ./ConfigService */ "./src/services/ConfigService.js");

/**
 * Service for managing model-specific parameters
 */
class ModelParameterService {
  constructor() {
    this.cachedConfig = null;
  }

  /**
   * Centralized model resolution method with clear priority hierarchy
   * @param {string} platformId - Platform ID
   * @param {Object} options - Additional options
   * @param {number} [options.tabId] - Tab ID for tab-specific preferences
   * @param {string} [options.source] - Interface source (popup or sidebar)
   * @returns {Promise<string>} Resolved model ID
   */
  async resolveModel(platformId, options = {}) {
    const {
      tabId,
      source
    } = options;
    let modelId = null;

    // 1. Try tab-specific model preference (highest priority)
    if (tabId) {
      try {
        const tabPrefs = await chrome.storage.local.get(STORAGE_KEYS.TAB_MODEL_PREFERENCES);
        const tabModels = tabPrefs[STORAGE_KEYS.TAB_MODEL_PREFERENCES] || {};
        if (tabModels[tabId] && tabModels[tabId][platformId]) {
          modelId = tabModels[tabId][platformId];
          logger.info(`Using tab-specific model for ${platformId}: ${modelId}`);
          return modelId;
        }
      } catch (error) {
        logger.error('Error getting tab-specific model:', error);
      }
    }

    // 2. Try source-specific global preference (Sidebar only)
    if (source === INTERFACE_SOURCES.SIDEBAR) {
      const storageKey = STORAGE_KEYS.SIDEBAR_MODEL;
      try {
        const sourcePrefs = await chrome.storage.sync.get(storageKey);
        const sourcePref = sourcePrefs[storageKey] || {};
        if (sourcePref[platformId]) {
          modelId = sourcePref[platformId];
          logger.info(`Using ${source} model preference for ${platformId}: ${modelId}`);
          return modelId;
        }
      } catch (error) {
        logger.error(`Error getting ${source} model preference:`, error);
      }
    }
  }

  /**
   * Get model configuration for a specific model
   * @param {string} platformId - Platform ID
   * @param {string} modelIdOrObject - Model ID or object containing model ID
   * @returns {Promise<Object|null>} Model configuration or null if not found
   */
  async getModelConfig(platformId, modelIdOrObject) {
    const config = await ConfigService.getApiConfig();

    // Access models directly under the platform ID in the API config
    if (!config?.aiPlatforms?.[platformId]?.models) return null;

    // Normalize input - handle both string IDs and model objects
    const modelId = typeof modelIdOrObject === 'object' && modelIdOrObject !== null ? modelIdOrObject.id || modelIdOrObject.model || String(modelIdOrObject) : modelIdOrObject;
    logger.info(`Resolving model config for: ${platformId}/${modelId}`);
    const platformApiConfig = config.aiPlatforms[platformId];

    // Find model in array of objects within the API config
    return platformApiConfig.models.find(model => model.id === modelId) || null;
  }

  /**
   * Get user-defined model settings
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID
   * @returns {Promise<Object>} User settings for the model
   */
  async getUserModelSettings(platformId, modelId) {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.API_ADVANCED_SETTINGS);
      const advancedSettings = result[STORAGE_KEYS.API_ADVANCED_SETTINGS] || {};

      // Get platform settings
      const platformSettings = advancedSettings[platformId] || {};

      // First try model-specific settings, then fall back to default settings
      const modelSettings = platformSettings.models && platformSettings.models[modelId] || platformSettings.default || {};
      logger.info(`User settings retrieved for ${platformId}/${modelId}:`, modelSettings);
      return modelSettings;
    } catch (error) {
      logger.error('Error getting user model settings:', error);
      return {};
    }
  }

  /**
   * Save model preference for a specific tab
   * @param {number} tabId - Tab ID
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID to save
   * @returns {Promise<boolean>} Success indicator
   */
  async saveTabModelPreference(tabId, platformId, modelId) {
    try {
      // Get current tab preferences
      const tabPrefs = await chrome.storage.local.get(STORAGE_KEYS.TAB_MODEL_PREFERENCES);
      const tabModels = tabPrefs[STORAGE_KEYS.TAB_MODEL_PREFERENCES] || {};

      // Initialize tab entry if needed
      if (!tabModels[tabId]) {
        tabModels[tabId] = {};
      }

      // Save model preference
      tabModels[tabId][platformId] = modelId;

      // Store updated preferences
      await chrome.storage.local.set({
        [STORAGE_KEYS.TAB_MODEL_PREFERENCES]: tabModels
      });
      logger.info(`Saved tab model preference: Tab ${tabId}, Platform ${platformId}, Model ${modelId}`);
      return true;
    } catch (error) {
      logger.error('Error saving tab model preference:', error);
      return false;
    }
  }

  /**
   * Save global model preference for a source
   * @param {string} source - Interface source (popup or sidebar)
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID to save
   * @returns {Promise<boolean>} Success indicator
   */
  async saveSourceModelPreference(source, platformId, modelId) {
    // Only save for sidebar, popup uses last selected via settings or default
    if (source !== INTERFACE_SOURCES.SIDEBAR) {
      logger.warn(`Not saving model preference for non-sidebar source: ${source}`);
      return false;
    }
    try {
      const storageKey = STORAGE_KEYS.SIDEBAR_MODEL;

      // Get current preferences
      const prefs = await chrome.storage.sync.get(storageKey);
      const modelPrefs = prefs[storageKey] || {};

      // Update preference
      modelPrefs[platformId] = modelId;

      // Save updated preferences
      await chrome.storage.sync.set({
        [storageKey]: modelPrefs
      });
      logger.info(`Saved ${source} model preference: Platform ${platformId}, Model ${modelId}`);
      return true;
    } catch (error) {
      logger.error(`Error saving ${source} model preference:`, error);
      return false;
    }
  }

  /**
   * Resolve parameters for a specific model, combining defaults and user settings
   * @param {string} platformId - Platform ID
   * @param {string} modelId - The specific model ID to use.
   * @param {Object} options - Additional options
   * @param {number} [options.tabId] - Tab ID for context (e.g., token tracking)
   * @param {string} [options.source] - Interface source (popup or sidebar)
   * @param {Array} [options.conversationHistory] - Optional conversation history for context
   * @returns {Promise<Object>} Resolved parameters object for API calls
   */
  async resolveParameters(platformId, modelId, options = {}) {
    // Add immediate check for modelId
    if (!modelId) {
      throw new Error('Model ID must be provided to resolveParameters');
    }
    try {
      const {
        tabId,
        source,
        conversationHistory
      } = options;
      logger.info(`Resolving parameters for ${platformId}/${modelId}, Source: ${source || 'N/A'}, Tab: ${tabId || 'N/A'}`);

      // Get the full platform config first
      const config = await ConfigService.getApiConfig();
      const platformApiConfig = config?.aiPlatforms?.[platformId];
      if (!platformApiConfig) {
        throw new Error(`Platform API configuration not found for ${platformId}`);
      }

      // Get model config directly from the platform's API config
      const modelConfig = platformApiConfig?.models?.find(model => model.id === modelId);
      if (!modelConfig) {
        throw new Error(`Model configuration not found for ${modelId}`);
      }

      // Get user settings for this model using the provided modelId
      const userSettings = await this.getUserModelSettings(platformId, modelId);

      // Determine effective toggle values, defaulting to true if not set
      const effectiveIncludeTemperature = userSettings.includeTemperature ?? true;
      const effectiveIncludeTopP = userSettings.includeTopP ?? false; // TopP default to false

      // Start with base parameters
      const params = {
        model: modelId,
        parameterStyle: modelConfig.parameterStyle,
        tokenParameter: modelConfig.tokenParameter,
        maxTokens: userSettings.maxTokens !== undefined ? userSettings.maxTokens : modelConfig.maxTokens,
        contextWindow: modelConfig.contextWindow,
        modelSupportsSystemPrompt: modelConfig?.supportsSystemPrompt ?? false
      };

      // Add temperature ONLY if model supports it AND user included it
      const modelSupportsTemperature = modelConfig?.supportsTemperature !== false;
      if (modelSupportsTemperature && effectiveIncludeTemperature) {
        params.temperature = userSettings.temperature !== undefined ? userSettings.temperature : platformApiConfig.temperature;
      }

      // Add topP ONLY if model supports it AND user included it
      const modelSupportsTopP = modelConfig?.supportsTopP === true;
      if (modelSupportsTopP && effectiveIncludeTopP) {
        params.topP = userSettings.topP !== undefined ? userSettings.topP : platformApiConfig.topP;
      }

      // Calculate effective system prompt support
      const platformSupportsSystemPrompt = platformApiConfig?.hasSystemPrompt !== false;
      const modelExplicitlyForbidsSystemPrompt = modelConfig?.supportsSystemPrompt === false;
      const effectiveModelSupportsSystemPrompt = platformSupportsSystemPrompt && !modelExplicitlyForbidsSystemPrompt;

      // Update modelSupportsSystemPrompt with the calculated value
      params.modelSupportsSystemPrompt = effectiveModelSupportsSystemPrompt;

      // Add system prompt ONLY if effectively supported AND user provided one
      if (params.modelSupportsSystemPrompt && userSettings.systemPrompt) {
        params.systemPrompt = userSettings.systemPrompt;
        logger.info(`Adding system prompt for ${platformId}/${modelId}.`);
      } else if (userSettings.systemPrompt) {
        if (!platformSupportsSystemPrompt) {
          logger.warn(`System prompt provided but platform ${platformId} does not support it.`);
        } else if (modelExplicitlyForbidsSystemPrompt) {
          logger.warn(`System prompt provided but model ${modelId} explicitly forbids it.`);
        } else {
          logger.warn(`System prompt provided but effective support is false for ${platformId}/${modelId}.`);
        }
      }

      // Add conversation history if provided in options
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        params.conversationHistory = conversationHistory;
      }

      // Include tabId if provided (useful for downstream token tracking)
      if (tabId) {
        params.tabId = tabId;
      }
      logger.info(`FINAL Resolved parameters for ${platformId}/${modelId}:`, {
        ...params
      });
      return params;
    } catch (error) {
      logger.error(`Error resolving parameters for ${platformId}/${modelId}:`, error);
      throw error;
    }
  }
}
module.exports = new ModelParameterService();

/***/ }),

/***/ "./src/services/SidebarStateManager.js":
/*!*********************************************!*\
  !*** ./src/services/SidebarStateManager.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const logger = (__webpack_require__(/*! ../shared/logger.js */ "./src/shared/logger.js").service);
const {
  STORAGE_KEYS
} = __webpack_require__(/*! ../shared/constants */ "./src/shared/constants.js");

/**
 * Service for managing tab-specific sidebar state
 */
class SidebarStateManager {
  /**
   * Toggle sidebar visibility for a specific tab
   * @private
   * @param {number} tabId - Tab ID
   * @param {boolean|undefined} visible - Visibility state (undefined to toggle)
   */
  async _toggleForTab(tabId, visible) {
    // Get current tab states
    const {
      [STORAGE_KEYS.TAB_SIDEBAR_STATES]: tabStates = {}
    } = await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEBAR_STATES);

    // Convert tabId to string for use as object key
    const tabIdStr = tabId.toString();

    // Determine new visibility
    if (visible === undefined) {
      // Toggle current state
      visible = !(tabStates[tabIdStr] === true);
    }

    // Update tab state
    const updatedStates = {
      ...tabStates,
      [tabIdStr]: visible
    };

    // Save updated states
    await chrome.storage.local.set({
      [STORAGE_KEYS.TAB_SIDEBAR_STATES]: updatedStates
    });
    logger.info(`Tab ${tabId} sidebar visibility set to ${visible}`);
  }

  /**
  /**
   * Get sidebar state for a specific tab
   * @private
   * @param {number} tabId - Tab ID
   * @returns {Promise<Object>} Tab-specific sidebar state
   */
  async _getStateForTab(tabId) {
    const result = await chrome.storage.local.get([STORAGE_KEYS.TAB_SIDEBAR_STATES, STORAGE_KEYS.SIDEBAR_PLATFORM, STORAGE_KEYS.SIDEBAR_MODEL]);
    const tabStates = result[STORAGE_KEYS.TAB_SIDEBAR_STATES] || {};
    return {
      visible: tabStates[tabId.toString()] === true,
      platform: result[STORAGE_KEYS.SIDEBAR_PLATFORM] || null,
      model: result[STORAGE_KEYS.SIDEBAR_MODEL] || null
    };
  }

  /**
   * Get current sidebar state for specific tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<Object>} Tab-specific sidebar state
   */
  async getSidebarState(tabId) {
    try {
      if (!tabId) {
        // Get active tab if no tab ID specified
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true
        });
        const activeTab = tabs[0];
        if (!activeTab || !activeTab.id) {
          logger.warn('No active tab found for getSidebarState');
          return {
            visible: false,
            platform: null,
            model: null
          };
        }
        return this._getStateForTab(activeTab.id);
      }
      return this._getStateForTab(tabId);
    } catch (error) {
      logger.error(`Error getting sidebar state for tab ${tabId}:`, error);
      return {
        visible: false,
        platform: null,
        model: null
      };
    }
  }

  /**
   * Get sidebar visibility for specific tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} Visibility state
   */
  async getSidebarVisibilityForTab(tabId) {
    try {
      const {
        [STORAGE_KEYS.TAB_SIDEBAR_STATES]: tabStates = {}
      } = await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEBAR_STATES);
      return tabStates[tabId.toString()] === true;
    } catch (error) {
      logger.error(`Error getting sidebar visibility for tab ${tabId}:`, error);
      return false;
    }
  }

  /**
   * Set sidebar visibility for specific tab
   * @param {number} tabId - Tab ID
   * @param {boolean} visible - Visibility state
   * @returns {Promise<boolean>} Success indicator
   */
  async setSidebarVisibilityForTab(tabId, visible) {
    try {
      await this._toggleForTab(tabId, visible);
      return true;
    } catch (error) {
      logger.error(`Error setting sidebar visibility for tab ${tabId}:`, error);
      return false;
    }
  }

  /**
   * Clean up tab states for closed tabs
   * Called periodically to prevent storage bloat
   * @returns {Promise<void>}
   */
  async cleanupTabStates() {
    try {
      // Get all current tabs
      const tabs = await chrome.tabs.query({});
      const activeTabIds = new Set(tabs.map(tab => tab.id.toString()));

      // Get current tab states
      const {
        [STORAGE_KEYS.TAB_SIDEBAR_STATES]: tabStates = {}
      } = await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEBAR_STATES);

      // Filter out closed tabs
      const updatedStates = {};
      let stateChanged = false;
      Object.entries(tabStates).forEach(([tabId, state]) => {
        if (activeTabIds.has(tabId)) {
          updatedStates[tabId] = state;
        } else {
          stateChanged = true;
          logger.info(`Removing sidebar state for closed tab ${tabId}`);
        }
      });

      // Save updated states if changed
      if (stateChanged) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_SIDEBAR_STATES]: updatedStates
        });
        logger.info('Tab sidebar states cleaned up');
      }
    } catch (error) {
      logger.error('Error cleaning up tab sidebar states:', error);
    }
  }
}
module.exports = new SidebarStateManager();

/***/ }),

/***/ "./src/shared/constants.js":
/*!*********************************!*\
  !*** ./src/shared/constants.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AI_PLATFORMS: () => (/* binding */ AI_PLATFORMS),
/* harmony export */   CONTENT_TYPES: () => (/* binding */ CONTENT_TYPES),
/* harmony export */   CONTENT_TYPE_LABELS: () => (/* binding */ CONTENT_TYPE_LABELS),
/* harmony export */   INTERFACE_SOURCES: () => (/* binding */ INTERFACE_SOURCES),
/* harmony export */   MESSAGE_ROLES: () => (/* binding */ MESSAGE_ROLES),
/* harmony export */   PROMPT_TYPES: () => (/* binding */ PROMPT_TYPES),
/* harmony export */   SHARED_TYPE: () => (/* binding */ SHARED_TYPE),
/* harmony export */   STORAGE_KEYS: () => (/* binding */ STORAGE_KEYS)
/* harmony export */ });
// src/shared/constants.js

/**
 * Content types used throughout the extension
 */
const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube',
  PDF: 'pdf'
};

/**
 * Shared prompt type - accessible across all content types
 */
const SHARED_TYPE = 'shared';

/**
 * User-friendly labels for content types
 */
const CONTENT_TYPE_LABELS = {
  [CONTENT_TYPES.GENERAL]: 'Web Content',
  [CONTENT_TYPES.REDDIT]: 'Reddit Post',
  [CONTENT_TYPES.YOUTUBE]: 'YouTube Video',
  [CONTENT_TYPES.PDF]: 'PDF Document',
  [SHARED_TYPE]: 'Shared Prompts'
};

/**
 * AI platforms supported by the extension
 */
const AI_PLATFORMS = {
  CLAUDE: 'claude',
  CHATGPT: 'chatgpt',
  DEEPSEEK: 'deepseek',
  MISTRAL: 'mistral',
  GEMINI: 'gemini',
  GROK: 'grok'
};

/**
 * Storage keys used throughout the extension
 */
const STORAGE_KEYS = {
  // Content
  CONTENT_READY: 'contentReady',
  EXTRACTED_CONTENT: 'extractedContent',
  SCRIPT_INJECTED: 'scriptInjected',
  TAB_FORMATTED_CONTENT: 'tab_formatted_content',
  FORMATTED_CONTENT_FOR_INJECTION: 'formatted_content_for_injection',
  // Service
  THEME_PREFERENCE: 'theme_preference',
  TEXT_SIZE_PREFERENCE: 'text_size_preference',
  API_ADVANCED_SETTINGS: 'api_advanced_settings',
  API_CREDENTIALS: 'api_credentials',
  // Prompt
  PRE_PROMPT: 'prePrompt',
  CUSTOM_PROMPTS: 'custom_prompts_by_type',
  DEFAULT_PROMPTS_INIT_FLAG: 'default_prompts_initialized_v1',
  // Platform
  INJECTION_PLATFORM: 'injectionPlatform',
  INJECTION_PLATFORM_TAB_ID: 'injectionPlatformTabId',
  POPUP_PLATFORM: 'popup_platform',
  SIDEBAR_PLATFORM: 'sidebar_platform_preference',
  SIDEBAR_MODEL: 'sidebar_model_preferences',
  TAB_PLATFORM_PREFERENCES: 'tab_platform_preferences',
  TAB_MODEL_PREFERENCES: 'tab_model_preferences',
  TAB_SIDEBAR_STATES: 'tab_sidebar_states',
  // API
  API_PROCESSING_STATUS: 'apiProcessingStatus',
  API_RESPONSE: 'apiResponse',
  API_PROCESSING_ERROR: 'apiProcessingError',
  API_RESPONSE_TIMESTAMP: 'apiResponseTimestamp',
  STREAM_ID: 'streamId',
  // Sidebar
  TAB_CHAT_HISTORIES: 'tab_chat_histories',
  TAB_SYSTEM_PROMPTS: 'tab_system_prompts',
  TAB_TOKEN_STATISTICS: 'tab_token_statistics'
};

/**
 * Interface sources for API requests
 */
const INTERFACE_SOURCES = {
  POPUP: 'popup',
  SIDEBAR: 'sidebar'
};

/**
 * Prompt types
 */
const PROMPT_TYPES = {
  CUSTOM: 'custom',
  QUICK: 'quick'
};

/**
 * Sidepanel message types
 */
const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
};

/***/ }),

/***/ "./src/shared/logger.js":
/*!******************************!*\
  !*** ./src/shared/logger.js ***!
  \******************************/
/***/ ((module) => {

// src/shared/logger.js

/**
 * Cross-context logging utility for Chrome extensions
 * Console-only implementation with backward compatibility
 */

// Determine if running in production mode (set by Webpack's mode option)
const isProduction = "development" === 'production';

/**
 * Log a message to console, conditionally skipping 'info' logs in production.
 * @param {string} context - The context (background, content, popup, etc.)
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - The message to log
 * @param {any} [data=null] - Optional data to include
 */
function log(context, level, message, data = null) {
  // --- Production Log Filtering ---
  // Skip 'info' level logs when in production mode
  if (isProduction && level === 'info') {
    return; // Exit early, do not log
  }
  // -----------------------------

  // Map level to console method
  const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'; // Default to 'log' for 'info'

  // Format prefix with context
  const prefix = `[${context}]`;

  // Log to console with or without data
  if (data !== null) {
    console[consoleMethod](prefix, message, data);
  } else {
    console[consoleMethod](prefix, message);
  }
}

/**
 * Stub function for backward compatibility
 * Returns empty array since we're not storing logs
 * @returns {Promise<Array>} Empty array
 */
async function getLogs() {
  // Log this message even in production, as it's informational about the logger itself
  console.log('[Logger] getLogs called - logs are not being stored in this version');
  return [];
}

/**
 * Stub function for backward compatibility
 */
async function clearLogs() {
  // Log this message even in production
  console.log('[Logger] clearLogs called - logs are not being stored in this version');
}
const logger = {
  api: {
    debug: (message, data) => log('api', 'debug', message, data),
    info: (message, data) => log('api', 'info', message, data),
    warn: (message, data) => log('api', 'warn', message, data),
    error: (message, data) => log('api', 'error', message, data)
  },
  background: {
    debug: (message, data) => log('background', 'debug', message, data),
    info: (message, data) => log('background', 'info', message, data),
    warn: (message, data) => log('background', 'warn', message, data),
    error: (message, data) => log('background', 'error', message, data)
  },
  content: {
    debug: (message, data) => log('content', 'debug', message, data),
    info: (message, data) => log('content', 'info', message, data),
    warn: (message, data) => log('content', 'warn', message, data),
    error: (message, data) => log('content', 'error', message, data)
  },
  extractor: {
    debug: (message, data) => log('extractor', 'debug', message, data),
    info: (message, data) => log('extractor', 'info', message, data),
    warn: (message, data) => log('extractor', 'warn', message, data),
    error: (message, data) => log('extractor', 'error', message, data)
  },
  popup: {
    debug: (message, data) => log('popup', 'debug', message, data),
    info: (message, data) => log('popup', 'info', message, data),
    warn: (message, data) => log('popup', 'warn', message, data),
    error: (message, data) => log('popup', 'error', message, data)
  },
  platform: {
    debug: (message, data) => log('platform', 'debug', message, data),
    info: (message, data) => log('platform', 'info', message, data),
    warn: (message, data) => log('platform', 'warn', message, data),
    error: (message, data) => log('platform', 'error', message, data)
  },
  message: {
    debug: (message, data) => log('message', 'debug', message, data),
    info: (message, data) => log('message', 'info', message, data),
    warn: (message, data) => log('message', 'warn', message, data),
    error: (message, data) => log('message', 'error', message, data)
  },
  service: {
    debug: (message, data) => log('service', 'debug', message, data),
    info: (message, data) => log('service', 'info', message, data),
    warn: (message, data) => log('service', 'warn', message, data),
    error: (message, data) => log('service', 'error', message, data)
  },
  sidebar: {
    debug: (message, data) => log('sidebar', 'debug', message, data),
    info: (message, data) => log('sidebar', 'info', message, data),
    warn: (message, data) => log('sidebar', 'warn', message, data),
    error: (message, data) => log('sidebar', 'error', message, data)
  },
  getLogs,
  clearLogs
};
module.exports = logger;

/***/ }),

/***/ "./src/shared/utils/content-utils.js":
/*!*******************************************!*\
  !*** ./src/shared/utils/content-utils.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   determineContentType: () => (/* binding */ determineContentType),
/* harmony export */   isInjectablePage: () => (/* binding */ isInjectablePage)
/* harmony export */ });
/* harmony import */ var _constants_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../constants.js */ "./src/shared/constants.js");
// src/shared/utils/content-utils.js


/**
 * Determine content type based on URL and selection state
 * This is the single source of truth for content type detection
 * 
 * @param {string} url - The URL to check
 * @returns {string} - The detected content type
 */
function determineContentType(url) {
  // PDF detection criteria evaluation
  const isPdf = url.endsWith('.pdf');
  const containsPdfPath = url.includes('/pdf/');
  const containsPdfViewer = url.includes('pdfviewer');
  const isChromeExtensionPdf = url.includes('chrome-extension://') && url.includes('pdfviewer');

  // PDF detection logic
  if (isPdf || containsPdfPath || containsPdfViewer || isChromeExtensionPdf) {
    return _constants_js__WEBPACK_IMPORTED_MODULE_0__.CONTENT_TYPES.PDF;
  } else if (url.includes('youtube.com/watch')) {
    return _constants_js__WEBPACK_IMPORTED_MODULE_0__.CONTENT_TYPES.YOUTUBE;
  } else if (url.includes('reddit.com/r/') && url.includes('/comments/')) {
    return _constants_js__WEBPACK_IMPORTED_MODULE_0__.CONTENT_TYPES.REDDIT;
  } else {
    return _constants_js__WEBPACK_IMPORTED_MODULE_0__.CONTENT_TYPES.GENERAL;
  }
}
function isInjectablePage(url) {
  if (!url) return false;
  try {
    if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('edge://') || url.startsWith('moz-extension://')) {
      return false;
    }
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) {
      return true;
    }
    const parsedUrl = new URL(url);
    return ['http:', 'https:', 'file:'].includes(parsedUrl.protocol);
  } catch (e) {
    console.warn(`URL parsing failed or non-standard scheme for injection check: ${url}`, e.message);
    return false;
  }
}

/***/ }),

/***/ "./src/shared/utils/error-utils.js":
/*!*****************************************!*\
  !*** ./src/shared/utils/error-utils.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   extractApiErrorMessage: () => (/* binding */ extractApiErrorMessage)
/* harmony export */ });
/**
 * Extracts a user-friendly error message from an API response object.
 * Attempts to parse the JSON body and find specific error details.
 * Falls back to a default message based on status code and text.
 *
 * @param {Response} response - The Fetch API Response object.
 * @returns {Promise<string>} A promise that resolves to the formatted error message string.
 */
async function extractApiErrorMessage(response) {
  let errorData = null;
  let detailString = null;
  const defaultMessage = `API error (${response.status}): ${response.statusText || 'Unknown error'}`;
  try {
    // Clone the response before reading the body, as it can only be read once
    const clonedResponse = response.clone();
    errorData = await clonedResponse.json();
  } catch (jsonError) {
    // Ignore JSON parsing errors, we'll use the default message
    console.warn('Failed to parse API error response as JSON:', jsonError);
    return defaultMessage;
  }

  // Check for array structure first (e.g., some Gemini errors)
  if (Array.isArray(errorData) && errorData.length > 0) {
    const firstError = errorData[0];
    if (firstError?.error?.message && typeof firstError.error.message === 'string') {
      detailString = firstError.error.message;
    }
  }

  // If not found in array or errorData is not an array, check object structure
  if (!detailString && errorData && typeof errorData === 'object') {
    // 1. Check errorData.message
    if (typeof errorData.message === 'string') {
      detailString = errorData.message;
    } else if (typeof errorData.message === 'object' && errorData.message !== null) {
      // Handle nested message objects (e.g., Mistral's { message: { detail: '...' } })
      if (typeof errorData.message.detail === 'string') {
        detailString = errorData.message.detail;
      } else if (typeof errorData.message.error === 'string') {
        detailString = errorData.message.error;
      } else {
        // Fallback for unexpected object structure in message
        detailString = JSON.stringify(errorData.message);
      }
    }

    // 2. Check errorData.error.message (if message wasn't useful)
    if (!detailString && errorData.error && typeof errorData.error === 'object' && typeof errorData.error.message === 'string') {
      detailString = errorData.error.message;
    }
    // Check if errorData.error is the string itself
    else if (!detailString && errorData.error && typeof errorData.error === 'string') {
      detailString = errorData.error;
    }

    // 3. Check errorData.detail (string)
    if (!detailString && typeof errorData.detail === 'string') {
      detailString = errorData.detail;
    }
  }

  // If we found a specific detail, clean it and format the message
  if (detailString) {
    // Clean up common prefixes like '* '
    if (detailString) {
      detailString = detailString.replace(/^\*\s*/, '');
    }
    return `API error (${response.status}): ${detailString}`;
  } else {
    // If we couldn't extract a specific string, log for debugging
    // but return the default message to avoid large objects in UI.
    const dataType = Array.isArray(errorData) ? 'array' : typeof errorData;
    console.warn(`API error data received (type: ${dataType}), but no specific message field found:`, errorData);
    return defaultMessage;
  }
}

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
/*!*********************************!*\
  !*** ./src/background/index.js ***!
  \*********************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _initialization_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./initialization.js */ "./src/background/initialization.js");
/* harmony import */ var _core_message_router_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./core/message-router.js */ "./src/background/core/message-router.js");
/* harmony import */ var _listeners_tab_listener_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./listeners/tab-listener.js */ "./src/background/listeners/tab-listener.js");
/* harmony import */ var _listeners_tab_state_listener_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./listeners/tab-state-listener.js */ "./src/background/listeners/tab-state-listener.js");
/* harmony import */ var _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../services/SidebarStateManager.js */ "./src/services/SidebarStateManager.js");
/* harmony import */ var _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../shared/logger.js */ "./src/shared/logger.js");
/* harmony import */ var _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_shared_logger_js__WEBPACK_IMPORTED_MODULE_5__);
// src/background/index.js - Entry point for background service worker




// Import the specific cleanup function and the listener setup




/**
 * Main entry point for the background service worker
 */
async function startBackgroundService() {
  try {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info('Starting background service...');
    // 1. Initialize extension configuration and state
    await (0,_initialization_js__WEBPACK_IMPORTED_MODULE_0__.initializeExtension)();

    // 2. Set up message router to handle communication
    (0,_core_message_router_js__WEBPACK_IMPORTED_MODULE_1__.setupMessageRouter)();

    // 3. Set up event listeners
    (0,_listeners_tab_listener_js__WEBPACK_IMPORTED_MODULE_2__.setupTabListener)();
    (0,_listeners_tab_state_listener_js__WEBPACK_IMPORTED_MODULE_3__.setupTabStateListener)(); // Sets up onRemoved listener
    setupConnectionListener(); // Add connection listener setup

    // This runs every time the service worker starts (initial load, wake-up, after browser start)
    // It complements the onStartup listener.
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info('Running stale tab cleanup on service worker start...');
    try {
      await (0,_listeners_tab_state_listener_js__WEBPACK_IMPORTED_MODULE_3__.performStaleTabCleanup)(); // Call the cleanup function
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info('Service worker start stale tab cleanup completed.');
    } catch (cleanupError) {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.error('Error during service worker start stale tab cleanup:', cleanupError);
    }

    // 4. Add the onStartup listener for cleanup (Keep this!)
    // This listener persists across service worker restarts.
    chrome.runtime.onStartup.addListener(async () => {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info('Browser startup detected via onStartup listener. Running stale tab cleanup...');
      try {
        // Call the cleanup function directly
        await (0,_listeners_tab_state_listener_js__WEBPACK_IMPORTED_MODULE_3__.performStaleTabCleanup)();
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info('Startup stale tab cleanup completed.');
      } catch (cleanupError) {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.error('Error during startup stale tab cleanup:', cleanupError);
      }
    });
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info('onStartup listener registered for cleanup.');
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info('Service worker started successfully and listeners are set up.');
  } catch (error) {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.error('Error starting background service:', error);
  }
}

/**
 * Sets up the listener for runtime connections (e.g., from side panel).
 */
function setupConnectionListener() {
  // This listener also persists across service worker restarts.
  chrome.runtime.onConnect.addListener(port => {
    _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info(`Connection received: ${port.name}`);
    if (port.name.startsWith('sidepanel-connect-')) {
      const parts = port.name.split('-');
      const tabIdStr = parts[parts.length - 1];
      const tabId = parseInt(tabIdStr, 10);
      if (!isNaN(tabId)) {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info(`Side panel connected for tab ${tabId}`);

        // Mark sidebar as visible upon connection
        _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_4___default().setSidebarVisibilityForTab(tabId, true).then(() => {
          _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info(`Set sidebar visibility to true for tab ${tabId}`);
        }).catch(error => {
          _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.error(`Error setting sidebar visibility to true for tab ${tabId}:`, error);
        });

        // Handle disconnection
        port.onDisconnect.addListener(() => {
          _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info(`Side panel disconnected for tab ${tabId}`);
          if (chrome.runtime.lastError) {
            // Log error but don't crash the extension
            _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.error(`Port disconnect error for tab ${tabId}: ${chrome.runtime.lastError.message}`);
          }
          // Mark sidebar as not visible upon disconnection
          _services_SidebarStateManager_js__WEBPACK_IMPORTED_MODULE_4___default().setSidebarVisibilityForTab(tabId, false).then(() => {
            _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info(`Set sidebar visibility to false for tab ${tabId}`);
          }).catch(error => {
            _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.error(`Error setting sidebar visibility to false for tab ${tabId}:`, error);
          });
        });
      } else {
        _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.error(`Could not parse tabId from port name: ${port.name}`);
      }
    } else {
      _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info(`Ignoring connection from non-sidepanel source: ${port.name}`);
    }
  });
  _shared_logger_js__WEBPACK_IMPORTED_MODULE_5___default().background.info('Runtime connection listener set up.');
}

// Start the background service when the file is loaded
// This runs every time the service worker starts (initial load, wake-up)
startBackgroundService();
})();

/******/ })()
;
//# sourceMappingURL=background.bundle.js.map
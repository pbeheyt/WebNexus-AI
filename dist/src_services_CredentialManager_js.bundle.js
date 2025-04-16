(self["webpackChunkai_content_assistant"] = self["webpackChunkai_content_assistant"] || []).push([["src_services_CredentialManager_js"],{

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

}]);
//# sourceMappingURL=src_services_CredentialManager_js.bundle.js.map
// src/api/implementations/chatgpt-api.js

const BaseApiService = require('../api-base');

/**
 * ChatGPT API implementation
 */
class ChatGptApiService extends BaseApiService {
  constructor() {
    super('chatgpt');
  }

  /**
   * Process with model-specific parameters
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters
   * @returns {Promise<Object>} API response
   */
  async _processWithModel(text, model, apiKey, params) {
    const endpoint = this.config?.endpoint || 'https://api.openai.com/v1/chat/completions';

    try {
      // Use params.model if available (from sidebar selection), otherwise fall back to passed model
      const modelToUse = params.model || model;

      this.logger.info(`Making ChatGPT API request with model: ${modelToUse}`);

      // Create the request payload based on parameter style
      const requestPayload = {
        model: modelToUse // Use the determined model
      };

      // Add messages array with system prompt if available
      const messages = [];

      // Add system message if system prompt is specified in advanced settings
      if (params.systemPrompt) {
        messages.push({ role: 'system', content: params.systemPrompt });
      }

      // Add conversation history if provided
      if (params.conversationHistory && params.conversationHistory.length > 0) {
        // Format conversation history for OpenAI API
        const formattedHistory = this.messageFormatter.formatForOpenAI(params.conversationHistory);
        messages.push(...formattedHistory);
      }

      // Add user message
      messages.push({ role: 'user', content: text });

      requestPayload.messages = messages;

      // Use the correct token parameter based on model style
      if (params.parameterStyle === 'reasoning') {
        requestPayload[params.tokenParameter || 'max_completion_tokens'] = params.effectiveMaxTokens;
      } else {
        requestPayload[params.tokenParameter || 'max_tokens'] = params.effectiveMaxTokens;

        // Only add temperature and top_p for standard models that support them
        if (params.supportsTemperature) {
          requestPayload.temperature = params.temperature;
        }

        if (params.supportsTopP) {
          requestPayload.top_p = params.topP;
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `API error (${response.status}): ${errorData.error?.message || response.statusText}`
        );
      }

      const responseData = await response.json();

      return {
        success: true,
        content: responseData.choices[0].message.content,
        model: responseData.model,
        platformId: this.platformId,
        timestamp: new Date().toISOString(),
        usage: responseData.usage,
        metadata: {
          responseId: responseData.id,
          finishReason: responseData.choices[0].finish_reason,
          parameters: {
            modelUsed: modelToUse,
            maxTokens: params.effectiveMaxTokens,
            temperature: params.supportsTemperature ? params.temperature : null,
            topP: params.supportsTopP ? params.topP : null
          }
        }
      };
    } catch (error) {
      this.logger.error('API processing error:', error);

      return {
        success: false,
        error: error.message,
        platformId: this.platformId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Process with model-specific parameters and streaming support
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters
   * @param {function} onChunk - Callback function for receiving text chunks
   * @returns {Promise<Object>} API response metadata
   */
  async _processWithModelStreaming(text, model, apiKey, params, onChunk) {
    const endpoint = this.config?.endpoint || 'https://api.openai.com/v1/chat/completions';

    try {
      // Use params.model if available (from sidebar selection), otherwise fall back to passed model
      const modelToUse = params.model || model;

      this.logger.info(`Making ChatGPT API streaming request with model: ${modelToUse}`);

      // Create the request payload based on parameter style
      const requestPayload = {
        model: modelToUse,
        stream: true // Enable streaming
      };

      // Add messages array with system prompt if available
      const messages = [];

      // Add system message if system prompt is specified in advanced settings
      if (params.systemPrompt) {
        messages.push({ role: 'system', content: params.systemPrompt });
      }

      // Add conversation history if provided
      if (params.conversationHistory && params.conversationHistory.length > 0) {
        // Format conversation history for OpenAI API
        const formattedHistory = this.messageFormatter.formatForOpenAI(params.conversationHistory);
        messages.push(...formattedHistory);
      }

      // Add user message
      messages.push({ role: 'user', content: text });

      requestPayload.messages = messages;

      // Use the correct token parameter based on model style
      if (params.parameterStyle === 'reasoning') {
        requestPayload[params.tokenParameter || 'max_completion_tokens'] = params.effectiveMaxTokens;
      } else {
        requestPayload[params.tokenParameter || 'max_tokens'] = params.effectiveMaxTokens;

        // Only add temperature and top_p for standard models that support them
        if (params.supportsTemperature) {
          requestPayload.temperature = params.temperature;
        }

        if (params.supportsTopP) {
          requestPayload.top_p = params.topP;
        }
      }

      // Make the streaming request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `API error (${response.status}): ${errorData.error?.message || response.statusText}`
        );
      }

      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let responseMetadata = {
        success: true,
        model: modelToUse,
        platformId: this.platformId,
        timestamp: new Date().toISOString(),
        content: "" // Accumulated content
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk and append to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines in the buffer
          let lineEnd;
          while ((lineEnd = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, lineEnd).trim();
            buffer = buffer.substring(lineEnd + 1);

            if (!line) continue; // Skip empty lines
            if (line === 'data: [DONE]') break; // End of stream

            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                const content = data.choices[0]?.delta?.content || '';

                if (content) {
                  responseMetadata.content += content;
                  onChunk({
                    chunk: content,
                    done: false,
                    model: modelToUse
                  });
                }
              } catch (e) {
                this.logger.error('Error parsing stream chunk:', e);
              }
            }
          }
        }

        // Send final done signal
        onChunk({
          chunk: '',
          done: true,
          model: modelToUse,
          fullContent: responseMetadata.content
        });

        return responseMetadata;
      } catch (error) {
        this.logger.error('Stream processing error:', error);
        throw error;
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      this.logger.error('API streaming processing error:', error);
      throw error;
    }
  }

  /**
   * Verify API credentials are valid
   * @returns {Promise<boolean>} Validation result
   */
  async validateCredentials() {
    try {
      // Make a minimal request to validate credentials
      const testPrompt = "Hello, this is a test request to validate API credentials.";
      const response = await this._processWithApi(testPrompt);
      return response.success === true;
    } catch (error) {
      this.logger.error('Credential validation failed:', error);
      return false;
    }
  }
}

module.exports = ChatGptApiService;

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
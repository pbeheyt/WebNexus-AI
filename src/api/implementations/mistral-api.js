// src/api/implementations/mistral-api.js

const BaseApiService = require('../api-base');

/**
 * Mistral API implementation
 */
class MistralApiService extends BaseApiService {
  constructor() {
    super('mistral');
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
    const endpoint = this.config?.endpoint || 'https://api.mistral.ai/v1/chat/completions';
    
    try {
      this.logger.info(`Making Mistral API request with model: ${model}`);
      
      // Create the request payload
      const requestPayload = {
        model: model
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
      
      // Add token parameter
      requestPayload[params.tokenParameter || 'max_tokens'] = params.effectiveMaxTokens;
      
      // Add temperature if supported
      if (params.supportsTemperature) {
        requestPayload.temperature = params.temperature;
      }
      
      // Add top_p if supported
      if (params.supportsTopP) {
        requestPayload.top_p = params.topP;
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
            modelUsed: model,
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

module.exports = MistralApiService;
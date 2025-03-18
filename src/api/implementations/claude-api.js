// src/api/implementations/claude-api.js

const BaseApiService = require('../api-base');

/**
 * Claude API implementation
 */
class ClaudeApiService extends BaseApiService {
  constructor() {
    super('claude');
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
    const endpoint = this.config?.endpoint || 'https://api.anthropic.com/v1/messages';
    
    try {
      this.logger.info(`Making Claude API request with model: ${model}`);
      
      // Create the request payload with model-specific parameters
      const requestPayload = {
        model: model,
        max_tokens: params.effectiveMaxTokens,
        messages: [
          { 
            role: 'user', 
            content: [
              {
                type: "text",
                text: text
              }
            ]
          }
        ]
      };
      
      // Add temperature if supported
      if (params.supportsTemperature) {
        requestPayload.temperature = params.temperature;
      }
      
      // Add system prompt if specified in advanced settings
      if (params.systemPrompt) {
        requestPayload.system = params.systemPrompt;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': true
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
        content: responseData.content[0].text,
        model: responseData.model,
        platformId: this.platformId,
        timestamp: new Date().toISOString(),
        usage: responseData.usage,
        metadata: {
          responseId: responseData.id,
          parameters: {
            modelUsed: model,
            maxTokens: params.effectiveMaxTokens,
            temperature: params.temperature
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

module.exports = ClaudeApiService;
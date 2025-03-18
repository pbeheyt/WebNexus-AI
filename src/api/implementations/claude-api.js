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
   * Process content through Claude API
   * @param {string} prompt - Formatted prompt text
   * @returns {Promise<Object>} Standardized response object
   */
  async _processWithApi(prompt) {
    const { apiKey, model } = this.credentials;
    const endpoint = this.config?.endpoint || 'https://api.anthropic.com/v1/messages';
    
    // Use configuration-provided default model with a fallback for backwards compatibility
    const defaultModel = this.config?.defaultModel || 'claude-3-7-sonnet-latest';
    
    // Choose the model to use, prioritizing the explicitly provided model
    const modelToUse = model || defaultModel;
    
    try {
      this.logger.info(`Making Claude API request with model: ${modelToUse}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': true
        },
        body: JSON.stringify({
          model: modelToUse,
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
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
        model: responseData.model, // Use actual model from response
        platformId: this.platformId,
        timestamp: new Date().toISOString(),
        usage: responseData.usage,
        metadata: {
          responseId: responseData.id
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
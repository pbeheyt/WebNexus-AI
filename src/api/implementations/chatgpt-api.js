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
   * Process content through ChatGPT API
   * @param {string} prompt - Formatted prompt text
   * @returns {Promise<Object>} Standardized response object
   */
  async _processWithApi(prompt) {
    const { apiKey, model } = this.credentials;
    const endpoint = this.config?.endpoint || 'https://api.openai.com/v1/chat/completions';
    
    // Use configuration default with fallback
    const defaultModel = this.config?.defaultModel || 'gpt-4o-o3';
    
    // Use provided model or default
    const modelToUse = model || defaultModel;
    
    try {
      this.logger.info(`Making ChatGPT API request with model: ${modelToUse}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4000
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
        content: responseData.choices[0].message.content,
        model: responseData.model,
        platformId: this.platformId,
        timestamp: new Date().toISOString(),
        usage: responseData.usage,
        metadata: {
          responseId: responseData.id,
          finishReason: responseData.choices[0].finish_reason
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
// src/api/implementations/gemini-api.js

const BaseApiService = require('../api-base');

/**
 * Gemini API implementation
 */
class GeminiApiService extends BaseApiService {
  constructor() {
    super('gemini');
  }

  /**
   * Process content through Gemini API
   * @param {string} prompt - Formatted prompt text
   * @returns {Promise<Object>} Standardized response object
   */
  async _processWithApi(prompt) {
    const { apiKey, model } = this.credentials;
    const defaultModel = this.config?.defaultModel || 'gemini-1.5-flash';
    const modelToUse = model || defaultModel;

    // Get endpoint from config or use default
    let endpoint = this.config?.endpoint ||
                   `https://generativelanguage.googleapis.com/v1/models/${modelToUse}:generateContent`;

    // Replace {model} placeholder if present
    if (endpoint.includes('{model}')) {
      endpoint = endpoint.replace('{model}', modelToUse);
    }

    try {
      this.logger.info(`Making Gemini API request with model: ${modelToUse}`);

      // Gemini API uses API key as a query parameter
      const url = new URL(endpoint);
      url.searchParams.append('key', apiKey);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 4000
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `API error (${response.status}): ${errorData.error?.message || response.statusText}`
        );
      }

      const responseData = await response.json();

      // Extract content from Gemini's response format
      const content = responseData.candidates[0].content.parts[0].text;

      return {
        success: true,
        content: content,
        model: modelToUse,
        platformId: this.platformId,
        timestamp: new Date().toISOString(),
        usage: responseData.usageMetadata,
        metadata: {
          responseId: responseData.candidates[0].finishReason,
          safetyRatings: responseData.candidates[0].safetyRatings
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

module.exports = GeminiApiService;

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
   * Process with model-specific parameters
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters
   * @returns {Promise<Object>} API response
   */
  async _processWithModel(text, model, apiKey, params) {
    // Get endpoint from config or use default
    let endpoint = this.config?.endpoint || 
                   `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`;

    // Replace {model} placeholder if present
    if (endpoint.includes('{model}')) {
      endpoint = endpoint.replace('{model}', model);
    }

    try {
      this.logger.info(`Making Gemini API request with model: ${model}`);

      // Gemini API uses API key as a query parameter
      const url = new URL(endpoint);
      url.searchParams.append('key', apiKey);

      // Create the request payload
      let fullContent = text;
      
      // Add system prompt if specified in advanced settings
      if (params.systemPrompt) {
        fullContent = `${params.systemPrompt}\n\n${text}`;
      }
      
      const requestPayload = {
        contents: [
          {
            parts: [
              { text: fullContent }
            ]
          }
        ],
        generationConfig: {}
      };

      // Add model-specific parameters
      if (params.tokenParameter) {
        requestPayload.generationConfig[params.tokenParameter] = params.effectiveMaxTokens;
      } else {
        requestPayload.generationConfig.maxOutputTokens = params.effectiveMaxTokens;
      }

      // Add temperature if supported
      if (params.supportsTemperature) {
        requestPayload.generationConfig.temperature = params.temperature;
      }

      // Add top_p if supported
      if (params.supportsTopP) {
        requestPayload.generationConfig.topP = params.topP;
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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

      // Extract content from Gemini's response format
      const content = responseData.candidates[0].content.parts[0].text;

      return {
        success: true,
        content: content,
        model: model,
        platformId: this.platformId,
        timestamp: new Date().toISOString(),
        usage: responseData.usageMetadata,
        metadata: {
          responseId: responseData.candidates[0].finishReason,
          safetyRatings: responseData.candidates[0].safetyRatings,
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

module.exports = GeminiApiService;
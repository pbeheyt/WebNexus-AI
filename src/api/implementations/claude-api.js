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
      // Use params.model if available (from sidebar selection), otherwise fall back to passed model
      const modelToUse = params.model || model;
      
      this.logger.info(`Making Claude API request with model: ${modelToUse}`);
      
      // Create the request payload with model-specific parameters
      const requestPayload = {
        model: modelToUse, // Use the determined model
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
            modelUsed: modelToUse,
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
   * Process with model-specific parameters using streaming
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters
   * @param {Function} onChunk - Callback function for each chunk
   * @returns {Promise<Object>} API
   */
  async _processWithModelStreaming(text, model, apiKey, params, onChunk) {
    const endpoint = this.config?.endpoint || 'https://api.anthropic.com/v1/messages';
    
    try {
      const modelToUse = params.model || model;
      
      this.logger.info(`Making Claude API streaming request with model: ${modelToUse}`);
      
      // Create the request payload with model-specific parameters
      const requestPayload = {
        model: modelToUse,
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
        ],
        stream: true // Enable streaming
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
      
      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullContent = "";
      
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
                // Claude returns delta in 'delta.text'
                const content = data.delta?.text || '';
                
                if (content) {
                  fullContent += content;
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
          fullContent
        });
        
        return {
          success: true,
          content: fullContent,
          model: modelToUse,
          platformId: this.platformId,
          timestamp: new Date().toISOString()
        };
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

module.exports = ClaudeApiService;
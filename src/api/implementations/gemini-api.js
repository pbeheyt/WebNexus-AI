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
      
      // Note: Gemini doesn't support system prompts natively
      // This is kept for backward compatibility but will be
      // hidden in the UI via the hasSystemPrompt flag
      if (params.systemPrompt) {
        this.logger.warn('Gemini does not officially support system prompts, but appending as regular text');
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
   * Process with model-specific parameters and streaming support
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters
   * @param {function} onChunk - Callback function for receiving text chunks
   * @returns {Promise<Object>} API response metadata
   */
  async _processWithModelStreaming(text, model, apiKey, params, onChunk) {
    // Get endpoint from config or use default
    let endpoint = this.config?.endpoint || 
                  `https://generativelanguage.googleapis.com/v1/models/${model}:streamGenerateContent`;
    
    // Replace {model} placeholder if present
    if (endpoint.includes('{model}')) {
      endpoint = endpoint.replace('{model}', model);
    }
    
    try {
      this.logger.info(`Making Gemini API streaming request with model: ${model}`);
      
      // Gemini API uses API key as a query parameter
      const url = new URL(endpoint);
      url.searchParams.append('key', apiKey);
      
      // Create the request payload
      let fullContent = text;
      
      // Note: Gemini doesn't support system prompts natively
      if (params.systemPrompt) {
        this.logger.warn('Gemini does not officially support system prompts, but appending as regular text');
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
      
      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulatedContent = "";
      let jsonBuffer = "";
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Decode the chunk and append to buffer
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete objects in the buffer
          // Find complete JSON objects (Gemini may send them differently than OpenAI)
          let startPos = 0;
          
          // Find all JSON objects in the buffer
          while (startPos < buffer.length) {
            // Skip any whitespace or non-JSON characters at the beginning
            while (startPos < buffer.length && 
                  (buffer[startPos] !== '{' && buffer[startPos] !== '[')) {
              startPos++;
            }
            
            if (startPos >= buffer.length) break;
            
            // Try to find a complete JSON object
            try {
              // Extract potential JSON
              const substr = buffer.substring(startPos);
              
              // Track brackets to find complete JSON objects
              let openBrackets = 0;
              let endPos = startPos;
              let inString = false;
              let escapeNext = false;
              
              for (let i = 0; i < substr.length; i++) {
                const char = substr[i];
                
                if (escapeNext) {
                  escapeNext = false;
                  continue;
                }
                
                if (char === '\\') {
                  escapeNext = true;
                  continue;
                }
                
                if (char === '"' && !escapeNext) {
                  inString = !inString;
                } else if (!inString) {
                  if (char === '{' || char === '[') {
                    openBrackets++;
                  } else if (char === '}' || char === ']') {
                    openBrackets--;
                  }
                  
                  if (openBrackets === 0) {
                    endPos = startPos + i + 1;
                    break;
                  }
                }
              }
              
              // If we found a complete JSON object
              if (openBrackets === 0 && endPos > startPos) {
                const jsonStr = buffer.substring(startPos, endPos);
                
                try {
                  const data = JSON.parse(jsonStr);
                  
                  // Extract content from Gemini's streaming format
                  if (data.candidates && 
                      data.candidates[0].content && 
                      data.candidates[0].content.parts && 
                      data.candidates[0].content.parts.length > 0) {
                    
                    // Gemini may return different content part types
                    const part = data.candidates[0].content.parts[0];
                    let content = '';
                    
                    if (part.text) {
                      content = part.text;
                    } else if (part.textPart) {
                      content = part.textPart;
                    }
                    
                    if (content) {
                      accumulatedContent += content;
                      onChunk({ 
                        chunk: content, 
                        done: false,
                        model: model
                      });
                    }
                  }
                  
                  // Move past this JSON object
                  startPos = endPos;
                  
                } catch (e) {
                  // If parsing fails, move ahead one character and try again
                  this.logger.debug('Partial JSON, continuing...');
                  startPos++;
                }
              } else {
                // Incomplete JSON, keep in buffer and wait for more data
                break;
              }
            } catch (e) {
              // If something goes wrong in our JSON finding logic, move ahead
              this.logger.debug('Error in JSON parsing logic:', e);
              startPos++;
            }
          }
          
          // Keep the remaining part in the buffer
          if (startPos > 0) {
            buffer = buffer.substring(startPos);
          }
        }
        
        // Final decoding to get any remaining content
        buffer += decoder.decode();
        
        // Send final done signal
        onChunk({ 
          chunk: '', 
          done: true,
          model: model, 
          fullContent: accumulatedContent
        });
        
        return {
          success: true,
          content: accumulatedContent,
          model: model,
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

module.exports = GeminiApiService;
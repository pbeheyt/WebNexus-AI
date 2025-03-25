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
   * Process with model-specific parameters and streaming support
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters including conversation history
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
      
      // Format content according to Gemini requirements
      let formattedContent = text;
      let formattedRequest;
      
      // Handle conversation history if provided
      if (params.conversationHistory && params.conversationHistory.length > 0) {
        formattedRequest = this._formatGeminiRequestWithHistory(
          params.conversationHistory, 
          text,
          params.systemPrompt
        );
      } else {
        // Note: Gemini doesn't support system prompts natively
        if (params.systemPrompt) {
          this.logger.warn('Gemini does not officially support system prompts, but appending as regular text');
          formattedContent = `${params.systemPrompt}\n\n${text}`;
        }
        
        formattedRequest = {
          contents: [
            {
              parts: [
                { text: formattedContent }
              ]
            }
          ]
        };
      }
      
      // Add generation configuration
      formattedRequest.generationConfig = {};
      
      // Add model-specific parameters
      if (params.tokenParameter) {
        formattedRequest.generationConfig[params.tokenParameter] = params.maxTokens;
      } else {
        formattedRequest.generationConfig.maxOutputTokens = params.maxTokens;
      }
      
      // Add temperature if supported
      if (params.supportsTemperature) {
        formattedRequest.generationConfig.temperature = params.temperature;
      }
      
      // Add top_p if supported
      if (params.supportsTopP) {
        formattedRequest.generationConfig.topP = params.topP;
      }
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formattedRequest)
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
   * Format conversation history for Gemini API
   * @param {Array} history - Conversation history array
   * @param {string} currentPrompt - Current user prompt
   * @param {string} systemPrompt - Optional system prompt
   * @returns {Object} Formatted request for Gemini API
   */
  _formatGeminiRequestWithHistory(history, currentPrompt, systemPrompt = null) {
    const contents = [];
    
    // If system prompt is provided, add it as a synthetic first message
    // NOTE: Gemini doesn't have native system prompts, so we simulate it
    if (systemPrompt) {
      this.logger.info('Adding system prompt as a first synthetic user message');
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
      
      // Add a synthetic model response that acknowledges the instructions
      contents.push({
        role: 'model',
        parts: [{ text: 'I understand the instructions and will follow them.' }]
      });
    }
    
    // Add conversation history
    for (const message of history) {
      // Map internal role to Gemini role
      const role = message.role === 'assistant' ? 'model' : 'user';
      
      contents.push({
        role: role,
        parts: [{ text: message.content }]
      });
    }
    
    // Add current prompt as final user message
    contents.push({
      role: 'user',
      parts: [{ text: currentPrompt }]
    });
    
    return { contents };
  }

  /**
   * Platform-specific validation implementation for Gemini
   * @protected
   * @param {string} apiKey - The API key to validate
   * @param {string} model - The model to use for validation
   * @returns {Promise<boolean>} Whether the API key is valid
   */
  async _validateWithModel(apiKey, model) {
    // Replace {model} in endpoint if present
    let endpoint = this.config?.endpoint || 
                   `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`;
    
    if (endpoint.includes('{model}')) {
      endpoint = endpoint.replace('{model}', model);
    }
    
    try {
      // Prepare URL with API key
      const url = new URL(endpoint);
      url.searchParams.append('key', apiKey);
      
      // Make a minimal validation request
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: "API validation check" }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 1
          }
        })
      });
      
      // Check if the response is valid
      return response.ok;
    } catch (error) {
      this.logger.error('API key validation error:', error);
      return false;
    }
  }
}

module.exports = GeminiApiService;
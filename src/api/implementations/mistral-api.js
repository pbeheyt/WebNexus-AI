const BaseApiService = require('../api-base');
const ApiTokenTracker = require('../../services/ApiTokenTracker');

/**
 * Mistral API implementation
 */
class MistralApiService extends BaseApiService {
  constructor() {
    super('mistral');
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
    const endpoint = this.config?.endpoint || 'https://api.mistral.ai/v1/chat/completions';
    
    try {
      this.logger.info(`Making Mistral API streaming request with model: ${model}`);
      
      // Create the request payload
      const requestPayload = {
        model: model,
        stream: true // Enable streaming
      };
      
      // Add messages array with system prompt if available
      const messages = [];
      
      // Add system message if system prompt is specified in advanced settings
      if (params.systemPrompt) {
        messages.push({ role: 'system', content: params.systemPrompt });
      }
      
      // Add conversation history if provided
      if (params.conversationHistory && params.conversationHistory.length > 0) {
        // Format conversation history for Mistral API (same format as OpenAI)
        messages.push(...this._formatMistralMessages(params.conversationHistory));
      }
      
      // Add user message
      messages.push({ role: 'user', content: text });
      
      requestPayload.messages = messages;
      
      // Add token parameter
      requestPayload[params.tokenParameter || 'max_tokens'] = params.maxTokens;
      
      // Add temperature if supported
      if (params.supportsTemperature) {
        requestPayload.temperature = params.temperature;
      }
      
      // Add top_p if supported
      if (params.supportsTopP) {
        requestPayload.top_p = params.topP;
      }
      
      // Estimate input tokens
      const inputTokenEstimate = ApiTokenTracker.estimateObjectTokens(requestPayload);
      
      // Get model config for pricing
      const modelConfig = this.config?.models?.find(m => m.id === model);
      const pricing = ApiTokenTracker.getPricingInfo(modelConfig);
      
      // Track input tokens
      if (params.tabId && params.messageId) {
        await ApiTokenTracker.trackMessageTokens(
          params.tabId,
          params.messageId,
          { input: inputTokenEstimate },
          {
            platformId: this.platformId,
            modelId: model,
            pricing: pricing
          }
        );
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
            if (line === 'data: [DONE]') break; // End of stream marker
            
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                const content = data.choices[0]?.delta?.content || '';
                
                if (content) {
                  fullContent += content;
                  onChunk({ 
                    chunk: content, 
                    done: false,
                    model: model
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
          model: model, 
          fullContent
        });
        
        // Estimate output tokens
        const outputTokenEstimate = ApiTokenTracker.estimateTokens(fullContent);
        
        // Track output tokens
        if (params.tabId && params.messageId) {
          await ApiTokenTracker.trackMessageTokens(
            params.tabId,
            params.messageId,
            { output: outputTokenEstimate },
            {
              platformId: this.platformId,
              modelId: model,
              pricing: pricing
            }
          );
        }
        
        return {
          success: true,
          content: fullContent,
          model: model,
          platformId: this.platformId,
          timestamp: new Date().toISOString(),
          tokensUsed: {
            input: inputTokenEstimate,
            output: outputTokenEstimate
          }
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
   * Format conversation history for Mistral API
   * @param {Array} history - Conversation history array
   * @returns {Array} Formatted messages for Mistral API
   */
  _formatMistralMessages(history) {
    return history.map(msg => {
      // Map internal role names to Mistral roles (same as OpenAI format)
      let role = 'user';
      if (msg.role === 'assistant') role = 'assistant';
      else if (msg.role === 'system') role = 'system';
      
      return {
        role,
        content: msg.content
      };
    });
  }
  
  /**
   * Platform-specific validation implementation for Mistral
   * @protected
   * @param {string} apiKey - The API key to validate
   * @param {string} model - The model to use for validation
   * @returns {Promise<boolean>} Whether the API key is valid
   */
  async _validateWithModel(apiKey, model) {
    const endpoint = this.config?.endpoint || 'https://api.mistral.ai/v1/chat/completions';
    
    try {
      // Make a minimal validation request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: 'API validation check' }
          ],
          max_tokens: 1 // Minimum tokens needed
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

module.exports = MistralApiService;
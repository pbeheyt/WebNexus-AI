const BaseApiService = require('../api-base');
const ApiTokenTracker = require('../../services/ApiTokenTracker');

/**
 * Claude API implementation
 */
class ClaudeApiService extends BaseApiService {
  constructor() {
    super('claude');
  }
  
  /**
   * Estimate tokens for Claude-formatted conversation history
   * @param {Array} history - Conversation history array
   * @returns {number} - Estimated token count
   */
  estimateConversationHistoryTokens(history) {
    if (!history || !Array.isArray(history) || history.length === 0) {
      return 0;
    }
    
    // Format conversation history for Claude format
    const formattedMessages = this._formatClaudeMessages(history, "");
    
    // Estimate tokens for the formatted messages
    return ApiTokenTracker.estimateObjectTokens(formattedMessages);
  }
  
  /**
   * Process with model-specific parameters using streaming
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters including conversation history
   * @param {Function} onChunk - Callback function for each chunk
   * @returns {Promise<Object>} API response
   */
  async _processWithModelStreaming(text, model, apiKey, params, onChunk) {
    const endpoint = this.config?.endpoint || 'https://api.anthropic.com/v1/messages';
    
    try {
      const modelToUse = params.model || model;
      
      this.logger.info(`Making Claude API streaming request with model: ${modelToUse}`);
      
      // Create the request payload with model-specific parameters
      const requestPayload = {
        model: modelToUse,
        max_tokens: params.maxTokens,
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
      
      // Add conversation history if available (format for Claude API)
      if (params.conversationHistory && params.conversationHistory.length > 0) {
        // Replace the default message with formatted history
        requestPayload.messages = this._formatClaudeMessages(params.conversationHistory, text);
      }
      
      // Calculate token counts for different components
      const promptTokens = ApiTokenTracker.estimateTokens(text);
      const historyTokens = params.conversationHistory && params.conversationHistory.length > 0
        ? this.estimateConversationHistoryTokens(params.conversationHistory)
        : 0;
      const systemTokens = params.systemPrompt
        ? ApiTokenTracker.estimateTokens(params.systemPrompt)
        : 0;
      const totalInputTokens = promptTokens + historyTokens + systemTokens;
      
      // Get model config for pricing
      const modelConfig = this.config?.models?.find(m => m.id === modelToUse);
      const pricing = ApiTokenTracker.getPricingInfo(modelConfig);
      
      // Track input tokens with detailed breakdown
      if (params.tabId && params.messageId) {
        await ApiTokenTracker.trackMessageTokens(
          params.tabId,
          params.messageId,
          { 
            input: totalInputTokens,
            promptTokens,
            historyTokens,
            systemTokens,
            output: 0 // Will be updated when streaming completes
          },
          {
            platformId: this.platformId,
            modelId: modelToUse,
            pricing: pricing
          }
        );
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
        
        // Enhance error handling for context window errors
        if (errorData.error && 
            (errorData.error.message?.includes('context window') || 
             errorData.error.message?.includes('token limit'))) {
          throw new Error('Context window exceeded. The conversation is too long for the model.');
        }
        
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
              modelId: modelToUse,
              pricing: pricing
            }
          );
        }
        
        return {
          success: true,
          content: fullContent,
          model: modelToUse,
          platformId: this.platformId,
          timestamp: new Date().toISOString(),
          tokensUsed: {
            input: totalInputTokens,
            promptTokens,
            historyTokens,
            systemTokens,
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
   * Format conversation history for Claude API
   * @param {Array} history - Conversation history array
   * @param {string} currentPrompt - Current user prompt
   * @returns {Array} Formatted messages for Claude API
   */
  _formatClaudeMessages(history, currentPrompt) {
    const formattedMessages = [];
    
    // Process conversation history
    for (const message of history) {
      // Map internal role to Claude role
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      
      formattedMessages.push({
        role: role,
        content: [
          {
            type: "text",
            text: message.content
          }
        ]
      });
    }
    
    // Add current prompt as the final user message
    formattedMessages.push({
      role: 'user',
      content: [
        {
          type: "text",
          text: currentPrompt
        }
      ]
    });
    
    return formattedMessages;
  }
  
  /**
   * Platform-specific validation implementation for Claude
   * @protected
   * @param {string} apiKey - The API key to validate
   * @param {string} model - The model to use for validation
   * @returns {Promise<boolean>} Whether the API key is valid
   */
  async _validateWithModel(apiKey, model) {
    const endpoint = this.config?.endpoint || 'https://api.anthropic.com/v1/messages';
    
    try {
      // Make a minimal validation request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': true
        },
        body: JSON.stringify({
          model: model, // Use the default model from config
          max_tokens: 1, // Minimum tokens needed
          messages: [
            { 
              role: 'user', 
              content: [
                {
                  type: "text",
                  text: "API validation check"
                }
              ]
            }
          ]
        })
      });
      
      // Just check if we get a valid response (not error)
      return response.ok;
    } catch (error) {
      this.logger.error('API key validation error:', error);
      return false;
    }
  }
}

module.exports = ClaudeApiService;
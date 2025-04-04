const BaseApiService = require('../api-base');

/**
 * Claude API implementation
 */
class ClaudeApiService extends BaseApiService {
  constructor() {
    super('claude');
  }
  
  /**
   * Process with model-specific parameters using streaming
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters including conversation history
   * @param {Function} onChunk - Callback function for each chunk
   * @returns {Promise<Object>} API response metadata (only returned on success, otherwise error is handled via onChunk)
   */
  async _processWithModelStreaming(text, params, apiKey, onChunk) {
    const endpoint = this.config?.endpoint || 'https://api.anthropic.com/v1/messages';
    let reader; // Declare reader outside try block for finally access

    try {
      const modelToUse = params.model || model;
      this.logger.info(`Making Claude API streaming request with model: ${modelToUse}`);

      // Create the request payload (logic remains the same)
      const requestPayload = {
        model: modelToUse,
        max_tokens: params.maxTokens,
        messages: [{ role: 'user', content: [{ type: "text", text: text }] }],
        stream: true
      };
      if (params.supportsTemperature) requestPayload.temperature = params.temperature;
      if (params.systemPrompt) requestPayload.system = params.systemPrompt;
      this.logger.info(`Claude API request params conversation history:`, params.conversationHistory);
      if (params.conversationHistory && params.conversationHistory.length > 0) {
        requestPayload.messages = this._formatClaudeMessages(params.conversationHistory, text);
      }
      this.logger.info(`Claude API request payload:`, requestPayload);

      // Make the streaming request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': true // Required for direct browser calls
        },
        body: JSON.stringify(requestPayload)
      });

      // Handle non-OK responses by sending an error chunk
      if (!response.ok) {
        let errorData;
        let errorMessage = `API error (${response.status}): ${response.statusText}`;
        try {
          errorData = await response.json();
          // Check for specific Claude error structure
          if (errorData.error && errorData.error.type === 'error' && errorData.error.message) {
             // Enhance error handling for context window errors
            if (errorData.error.message.includes('context window') || errorData.error.message.includes('token limit')) {
              errorMessage = 'Context window exceeded. The conversation is too long for the model.';
            } else {
              errorMessage = `API error (${response.status}): ${errorData.error.message}`;
            }
          }
        } catch (parseError) {
          this.logger.warn('Could not parse error response body:', parseError);
          // Use the basic status text if JSON parsing fails
        }
        this.logger.error(`Claude API Error: ${errorMessage}`, errorData);
        onChunk({ done: true, error: errorMessage, model: modelToUse });
        return; // Stop processing on error
      }

      // Process the stream
      reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulatedContent = ""; // Keep track of content for final successful chunk

      while (true) {
        const { done, value } = await reader.read();
        if (done) break; // Exit loop when stream is finished

        buffer += decoder.decode(value, { stream: true });
        let lineEnd;

        while ((lineEnd = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, lineEnd).trim();
          buffer = buffer.substring(lineEnd + 1);

          if (!line) continue;
          // Claude uses event types, not just 'data:'
          if (line.startsWith('event: ')) {
             const eventType = line.substring(7).trim();
             // We are interested in 'content_block_delta' for text chunks
             // and 'message_stop' for completion. Other events like 'ping' are ignored.
             if (eventType === 'message_stop') {
                 // This indicates the end, but we rely on reader.read() done flag
                 continue;
             }
             // We'll process the 'data:' line associated with the event next
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              // Check for content delta
              if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
                const content = data.delta.text || '';
                if (content) {
                  accumulatedContent += content;
                  onChunk({
                    chunk: content, // Send individual chunk
                    done: false,
                    model: modelToUse
                  });
                }
              } else if (data.type === 'message_delta' && data.delta?.stop_reason) {
                 // Can capture stop reason if needed, but completion is handled by reader done
                 this.logger.info(`Stream stopped with reason: ${data.delta.stop_reason}`);
              } else if (data.type === 'error') {
                 // Handle potential errors signaled within the stream itself
                 const streamErrorMessage = `Stream error: ${data.error?.message || 'Unknown stream error'}`;
                 this.logger.error(streamErrorMessage, data.error);
                 // Send error chunk and stop processing this stream
                 onChunk({ done: true, error: streamErrorMessage, model: modelToUse });
                 // Attempt to release lock early if possible
                 if (reader) await reader.releaseLock().catch(e => this.logger.error('Error releasing lock after stream error:', e));
                 reader = null; // Prevent finally block from trying again
                 return;
              }
            } catch (e) {
              // Log parsing errors but attempt to continue processing the stream
              this.logger.error('Error parsing stream chunk:', e, 'Line:', line);
            }
          }
        }
      }

      // Send final successful done signal
      onChunk({
        chunk: '', // No final chunk content needed here
        done: true,
        model: modelToUse,
        fullContent: accumulatedContent // Include full content
      });

      // Return metadata only on successful completion
      return {
        success: true,
        model: modelToUse,
        platformId: this.platformId,
        timestamp: new Date().toISOString(),
        content: accumulatedContent
      };

    } catch (error) {
      this.logger.error('API streaming processing error:', error);
      // Send error chunk if an unexpected error occurs
      onChunk({
        done: true,
        error: error.message || 'An unknown streaming error occurred',
        model: params.model || model // Use the model determined at the start
      });
      // Do not re-throw; error is handled by sending the chunk
    } finally {
      // Ensure the reader is released even if errors occur
      if (reader) {
        try {
          await reader.releaseLock();
        } catch (releaseError) {
          this.logger.error('Error releasing stream reader lock:', releaseError);
        }
      }
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

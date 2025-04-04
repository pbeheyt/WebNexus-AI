const BaseApiService = require('../api-base');

/**
 * DeepSeek API implementation
 */
class DeepSeekApiService extends BaseApiService {
  constructor() {
    super('deepseek');
  }
  
  /**
   * Process with model-specific parameters and streaming support
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters including conversation history
   * @param {function} onChunk - Callback function for receiving text chunks
   * @returns {Promise<Object>} API response metadata (only returned on success, otherwise error is handled via onChunk)
   */
  async _processWithModelStreaming(text, params, apiKey, onChunk) {
    const endpoint = this.config?.endpoint || 'https://api.deepseek.com/v1/chat/completions';
    let reader; // Declare reader outside try block for finally access
    const modelToUse = params.model || model; // Use params.model if available

    try {
      this.logger.info(`Making DeepSeek API streaming request with model: ${modelToUse}`);

      // Create the request payload (logic remains the same)
      const requestPayload = { model: modelToUse, stream: true };
      const messages = [];
      if (params.systemPrompt) messages.push({ role: 'system', content: params.systemPrompt });
      if (params.conversationHistory && params.conversationHistory.length > 0) {
        messages.push(...this._formatDeepSeekMessages(params.conversationHistory));
      }

      // Check the last message before adding the current user prompt for DeepSeek compatibility
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

      if (lastMessage && lastMessage.role === 'user') {
        // Merge with the last user message
        this.logger.info('Merging current user prompt with previous user message for DeepSeek compatibility.');
        lastMessage.content += `\n\n${text}`; // Append the new text
      } else {
        // Add the current user prompt as a new message if no merge is needed
        messages.push({ role: 'user', content: text });
      }

      // Assign the potentially modified messages array to the payload
      requestPayload.messages = messages;
      requestPayload[params.tokenParameter || 'max_tokens'] = params.maxTokens;
      if (params.supportsTemperature) requestPayload.temperature = params.temperature;
      if (params.supportsTopP) requestPayload.top_p = params.topP;

      // Make the streaming request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestPayload)
      });

      // Handle non-OK responses by sending an error chunk
      if (!response.ok) {
        let errorData;
        let errorMessage = `API error (${response.status}): ${response.statusText}`;
        try {
          errorData = await response.json();
          errorMessage = `API error (${response.status}): ${errorData.error?.message || response.statusText}`;
        } catch (parseError) {
          this.logger.warn('Could not parse error response body:', parseError);
        }
        this.logger.error(`DeepSeek API Error: ${errorMessage}`, errorData);
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
          if (line === 'data: [DONE]') continue; // Handled by the 'done' check above

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              const content = data.choices[0]?.delta?.content || '';

              if (content) {
                accumulatedContent += content;
                onChunk({
                  chunk: content, // Send individual chunk
                  done: false,
                  model: modelToUse
                });
              }
              // Check finish reason if needed
              if (data.choices[0]?.finish_reason) {
                 this.logger.info(`Stream finished with reason: ${data.choices[0].finish_reason}`);
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
        content: accumulatedContent,
        model: modelToUse,
        platformId: this.platformId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('API streaming processing error:', error);
      // Send error chunk if an unexpected error occurs
      onChunk({
        done: true,
        error: error.message || 'An unknown streaming error occurred',
        model: modelToUse
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
   * Format conversation history for DeepSeek API, merging consecutive messages of the same role.
   * Skips system messages or unknown roles found within the history.
   * @param {Array} history - Conversation history array
   * @returns {Array} Formatted messages for DeepSeek API
   */
  _formatDeepSeekMessages(history) {
    const formattedMessages = [];
    this.logger.info(`Formatting ${history.length} history messages for DeepSeek, merging consecutive roles.`);

    for (const msg of history) {
      let apiRole;
      // Map internal roles to API roles, skipping system/unknown messages within history
      if (msg.role === 'user') {
        apiRole = 'user';
      } else if (msg.role === 'assistant') {
        apiRole = 'assistant';
      } else {
        this.logger.warn(`Skipping message with role '${msg.role || 'unknown'}' found within conversation history for DeepSeek API call.`);
        continue; // Skip system or unknown roles
      }

      const lastMessage = formattedMessages.length > 0 ? formattedMessages[formattedMessages.length - 1] : null;

      // Check if the last message exists and has the same role as the current message
      if (lastMessage && lastMessage.role === apiRole) {
        // Merge content with the last message
        this.logger.info(`Merging consecutive '${apiRole}' message content for DeepSeek compatibility.`);
        lastMessage.content += `\n\n${msg.content}`; // Append content
      } else {
        // Add as a new message if roles differ or it's the first message
        formattedMessages.push({ role: apiRole, content: msg.content });
      }
    }

    // Final check for alternation (optional, but good for debugging)
    for (let i = 0; i < formattedMessages.length - 1; i++) {
        if (formattedMessages[i].role === formattedMessages[i+1].role) {
            this.logger.error(`DeepSeek formatting failed: Consecutive roles found after merge at index ${i}. Role: ${formattedMessages[i].role}`);
            // Handle error case if needed, e.g., return only valid prefix
        }
    }


    this.logger.info(`Formatted history for DeepSeek contains ${formattedMessages.length} messages after merging.`);
    return formattedMessages;
  }

  /**
   * Platform-specific validation implementation for DeepSeek
   * @protected
   * @param {string} apiKey - The API key to validate
   * @param {string} model - The model to use for validation
   * @returns {Promise<boolean>} Whether the API key is valid
   */
  async _validateWithModel(apiKey, model) {
    const endpoint = this.config?.endpoint || 'https://api.deepseek.com/v1/chat/completions';
    
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

module.exports = DeepSeekApiService;

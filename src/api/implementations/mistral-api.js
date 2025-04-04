const BaseApiService = require('../api-base');

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
   * @returns {Promise<Object>} API response metadata (only returned on success, otherwise error is handled via onChunk)
   */
  async _processWithModelStreaming(text, params, apiKey, onChunk) {
    const endpoint = this.config?.endpoint || 'https://api.mistral.ai/v1/chat/completions';
    let reader; // Declare reader outside try block for finally access

    try {
      this.logger.info(`Making Mistral API streaming request with model: ${params.model}`);

      // Create the request payload (logic remains the same)
      const requestPayload = { model: params.model, stream: true };
      const messages = [];
      if (params.systemPrompt) messages.push({ role: 'system', content: params.systemPrompt });
      if (params.conversationHistory && params.conversationHistory.length > 0) {
        messages.push(...this._formatMistralMessages(params.conversationHistory));
      }
      messages.push({ role: 'user', content: text });
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
          // Mistral error structure might be { message: ..., type: ..., code: ... }
          errorMessage = `API error (${response.status}): ${errorData.message || errorData.error?.message || response.statusText}`;
        } catch (parseError) {
          this.logger.warn('Could not parse error response body:', parseError);
        }
        this.logger.error(`Mistral API Error: ${errorMessage}`, errorData);
        onChunk({ done: true, error: errorMessage, model: params.model });
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
                  model: params.model
                });
              }
              // Check if the choice indicates completion (though reader 'done' is primary)
              if (data.choices[0]?.finish_reason) {
                 this.logger.info(`Stream finished with reason: ${data.choices[0].finish_reason}`);
                 // We don't break here, let the reader signal 'done'
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
        model: params.model,
        fullContent: accumulatedContent // Include full content
      });

      // Return metadata only on successful completion
      return {
        success: true,
        content: accumulatedContent,
        model: params.model,
        platformId: this.platformId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('API streaming processing error:', error);
      // Send error chunk if an unexpected error occurs
      onChunk({
        done: true,
        error: error.message || 'An unknown streaming error occurred',
        model: params.model
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

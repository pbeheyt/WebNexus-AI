const BaseApiService = require('../api-base');

/**
 * Claude API implementation
 */
class ClaudeApiService extends BaseApiService {
  constructor() {
    super('claude');
  }

  /**
   * Build the platform-specific API request options for Claude.
   * @override
   * @protected
   * @param {string} prompt - The final structured prompt.
   * @param {Object} params - Resolved model parameters (model, temp, history, etc.).
   * @param {string} apiKey - The API key.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildApiRequest(prompt, params, apiKey) {
    const endpoint = this.config?.endpoint || 'https://api.anthropic.com/v1/messages';
    this.logger.info(`Building Claude API request for model: ${params.model}`);

    const requestPayload = {
      model: params.model,
      max_tokens: params.maxTokens,
      messages: [{ role: 'user', content: [{ type: "text", text: prompt }] }], // Start with current prompt
      stream: true
    };

    // Apply optional parameters
    if ('temperature' in params) {
      requestPayload.temperature = params.temperature;
    }
    if ('topP' in params) {
      requestPayload.top_p = params.topP;
    }
    if (params.systemPrompt) {
      requestPayload.system = params.systemPrompt;
    }

    // Prepend conversation history if available
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      // Use the helper to format history and add the current prompt correctly
      requestPayload.messages = this._formatClaudeMessages(params.conversationHistory, prompt);
    }

    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true' // Required for direct browser calls
      },
      body: JSON.stringify(requestPayload)
    };
  }

  /**
   * Parse a single line/chunk from the Claude API stream.
   * Handles Server-Sent Events (SSE) format used by Claude.
   * @override
   * @protected
   * @param {string} line - A single line string from the stream.
   * @returns {Object} Parsed result: { type: 'content' | 'error' | 'done' | 'ignore', chunk?: string, error?: string }.
   */
  _parseStreamChunk(line) {
    if (!line) {
      return { type: 'ignore' };
    }

    // Claude uses event types
    if (line.startsWith('event: ')) {
      const eventType = line.substring(7).trim();
      // We only care about the data associated with specific events.
      // 'message_stop' signals completion, but we let the reader handle the actual stream end.
      // 'ping' can be ignored.
      if (eventType === 'message_stop') {
        return { type: 'done' }; // Signal potential end, base class waits for reader
      }
      // Other events like 'message_start', 'content_block_start/stop' are ignored for now.
      return { type: 'ignore' };
    }

    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.substring(6));

        // Check for content delta
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
          const content = data.delta.text;
          return content ? { type: 'content', chunk: content } : { type: 'ignore' };
        }

        // Check for errors reported within the stream
        if (data.type === 'error') {
          const streamErrorMessage = `Stream error: ${data.error?.type} - ${data.error?.message || 'Unknown stream error'}`;
          this.logger.error(streamErrorMessage, data.error);
          return { type: 'error', error: streamErrorMessage };
        }

        // Ignore other data types like 'message_delta' (stop_reason is handled by 'message_stop' event or reader end)
        return { type: 'ignore' };

      } catch (e) {
        this.logger.error('Error parsing Claude stream chunk:', e, 'Line:', line);
        return { type: 'error', error: `Error parsing stream data: ${e.message}` };
      }
    }

    // Ignore lines that are not 'event:' or 'data:'
    return { type: 'ignore' };
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
   * Build the platform-specific API request options for validation.
   * @override
   * @protected
   * @param {string} apiKey - The API key to validate.
   * @param {string} model - The model to use for validation.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildValidationRequest(apiKey, model) {
    const endpoint = this.config?.endpoint || 'https://api.anthropic.com/v1/messages';
    const validationPayload = {
      model: model,
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
    };

    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true' // Required for direct browser calls
      },
      body: JSON.stringify(validationPayload)
    };
  }
}

module.exports = ClaudeApiService;

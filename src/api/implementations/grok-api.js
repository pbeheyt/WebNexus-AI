const BaseApiService = require('../api-base');

/**
 * Grok API implementation
 */
class GrokApiService extends BaseApiService {
  constructor() {
    super('grok');
  }

  /**
   * Build the platform-specific API request options for Grok.
   * @override
   * @protected
   * @param {string} prompt - The final structured prompt.
   * @param {Object} params - Resolved model parameters (model, temp, history, etc.).
   * @param {string} apiKey - The API key.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildApiRequest(prompt, params, apiKey) {
    const endpoint = this.config?.endpoint || 'https://api.x.ai/v1/chat/completions';
    this.logger.info(`[${this.platformId}] Building API request for model: ${params.model}`);

    const requestPayload = {
      model: params.model,
      stream: true
    };

    const messages = [];
    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt });
    }
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      messages.push(...this._formatGrokMessages(params.conversationHistory));
    }
    messages.push({ role: 'user', content: prompt }); // Use the structured prompt
    requestPayload.messages = messages;

    // Apply model parameters
    requestPayload[params.tokenParameter || 'max_tokens'] = params.maxTokens;
    if ('temperature' in params) {
      requestPayload.temperature = params.temperature;
    }
    if ('topP' in params) {
      requestPayload.top_p = params.topP;
    }

    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestPayload)
    };
  }

  /**
   * Parse a single line/chunk from the Grok API stream.
   * Assumes OpenAI-compatible SSE format.
   * @override
   * @protected
   * @param {string} line - A single line string from the stream.
   * @returns {Object} Parsed result: { type: 'content' | 'done' | 'ignore' | 'error', chunk?: string, error?: string }.
   */
  _parseStreamChunk(line) {
    if (!line) {
      return { type: 'ignore' };
    }

    // Grok uses 'data: [DONE]' like OpenAI
    if (line === 'data: [DONE]') {
      return { type: 'done' };
    }

    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.substring(6));
        const content = data.choices?.[0]?.delta?.content;

        if (content) {
          return { type: 'content', chunk: content };
        } else {
          // Ignore chunks without content (like finish_reason markers)
          if (data.choices?.[0]?.finish_reason) {
             this.logger.info(`[${this.platformId}] Stream finished with reason: ${data.choices[0].finish_reason}`);
          }
          return { type: 'ignore' };
        }
      } catch (e) {
        this.logger.error(`[${this.platformId}] Error parsing stream chunk:`, e, 'Line:', line);
        return { type: 'error', error: `Error parsing stream data: ${e.message}` };
      }
    }

    return { type: 'ignore' };
  }

  /**
   * Format conversation history for Grok API
   * @param {Array} history - Conversation history array
   * @returns {Array} Formatted messages for Grok API
   */
  _formatGrokMessages(history) {
    return history.map(msg => {
      // Map internal role names to Grok roles (same as OpenAI format)
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
   * Build the platform-specific API request options for validation.
   * @override
   * @protected
   * @param {string} apiKey - The API key to validate.
   * @param {string} model - The model to use for validation.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildValidationRequest(apiKey, model) {
    const endpoint = this.config?.endpoint || 'https://api.x.ai/v1/chat/completions';
    const validationPayload = {
      model: model,
      messages: [
        { role: 'user', content: 'API validation check' }
      ],
      max_tokens: 1 // Minimum tokens needed
    };

    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(validationPayload)
    };
  }
}

module.exports = GrokApiService;
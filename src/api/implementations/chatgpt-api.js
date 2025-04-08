const BaseApiService = require('../api-base');

/**
 * ChatGPT API implementation
 */
class ChatGptApiService extends BaseApiService {
  constructor() {
    super('chatgpt');
  }

  /**
   * Build the platform-specific API request options for ChatGPT.
   * @override
   * @protected
   * @param {string} prompt - The final structured prompt.
   * @param {Object} params - Resolved model parameters (model, temp, history, etc.).
   * @param {string} apiKey - The API key.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildApiRequest(prompt, params, apiKey) {
    const endpoint = this.config?.endpoint || 'https://api.openai.com/v1/chat/completions';
    this.logger.info(`Building ChatGPT API request for model: ${params.model}`);

    const requestPayload = {
      model: params.model,
      stream: true
    };

    const messages = [];
    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt });
    }
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      messages.push(...this._formatOpenAIMessages(params.conversationHistory));
    }
    messages.push({ role: 'user', content: prompt }); // Use the structured prompt
    requestPayload.messages = messages;

    // Apply model parameters
    if (params.parameterStyle === 'reasoning') {
      requestPayload[params.tokenParameter || 'max_completion_tokens'] = params.maxTokens;
    } else {
      requestPayload[params.tokenParameter || 'max_tokens'] = params.maxTokens;
      if ('temperature' in params) {
        requestPayload.temperature = params.temperature;
      }
      if ('topP' in params) {
        requestPayload.top_p = params.topP;
      }
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
   * Parse a single line/chunk from the ChatGPT API stream.
   * @override
   * @protected
   * @param {string} line - A single line string from the stream.
   * @returns {Object} Parsed result: { type: 'content' | 'done' | 'ignore', chunk?: string }.
   */
  _parseStreamChunk(line) {
    if (!line) {
      return { type: 'ignore' };
    }

    // OpenAI uses 'data: [DONE]' to signal the end of the stream content
    if (line === 'data: [DONE]') {
      return { type: 'done' }; // Signal done, but let the reader confirm stream end
    }

    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.substring(6));
        const content = data.choices?.[0]?.delta?.content;

        if (content) {
          return { type: 'content', chunk: content };
        } else {
          // Ignore chunks without content (e.g., role markers, finish_reason)
          return { type: 'ignore' };
        }
      } catch (e) {
        this.logger.error('Error parsing ChatGPT stream chunk:', e, 'Line:', line);
        // Treat parsing errors as stream errors - return error type
        return { type: 'error', error: `Error parsing stream data: ${e.message}` };
      }
    }

    // Ignore lines that don't start with 'data: ' (e.g., potential comments or empty lines already handled)
    return { type: 'ignore' };
  }

  /**
   * Format conversation history for OpenAI API
   * @param {Array} history - Conversation history array
   * @returns {Array} Formatted messages for OpenAI API
   */
  _formatOpenAIMessages(history) {
    return history.map(msg => {
      // Map internal role names to OpenAI roles
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
    const endpoint = this.config?.endpoint || 'https://api.openai.com/v1/chat/completions';
    const validationPayload = {
      model: model,
      messages: [
        { role: 'user', content: 'API validation check' }
      ],
      max_tokens: 1 // Minimum tokens
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

module.exports = ChatGptApiService;

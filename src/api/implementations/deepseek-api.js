const BaseApiService = require('../api-base');

/**
 * DeepSeek API implementation
 */
class DeepSeekApiService extends BaseApiService {
  constructor() {
    super('deepseek');
  }

  /**
   * Build the platform-specific API request options for DeepSeek.
   * Handles merging consecutive user messages as required by the API.
   * @override
   * @protected
   * @param {string} prompt - The final structured prompt (current user input).
   * @param {Object} params - Resolved model parameters (model, temp, history, etc.).
   * @param {string} apiKey - The API key.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildApiRequest(prompt, params, apiKey) {
    const endpoint = this.config?.endpoint || 'https://api.deepseek.com/v1/chat/completions';
    this.logger.info(`Building DeepSeek API request for model: ${params.model}`);

    const requestPayload = {
      model: params.model,
      stream: true
    };

    let messages = [];
    // Add system prompt first if it exists
    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt });
    }

    // Format history, merging consecutive roles (excluding system)
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      messages.push(...this._formatDeepSeekMessages(params.conversationHistory));
    }

    // Now, handle the current user prompt, merging if necessary
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

    if (lastMessage && lastMessage.role === 'user') {
      // Merge the current prompt into the last user message
      this.logger.info('Merging current user prompt with previous user message for DeepSeek compatibility.');
      lastMessage.content += `\n\n${prompt}`; // Append the new prompt text
    } else {
      // Add the current prompt as a new user message
      messages.push({ role: 'user', content: prompt });
    }

    // Assign the final message list to the payload
    requestPayload.messages = messages;

    // Apply other parameters
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
   * Parse a single line/chunk from the DeepSeek API stream.
   * Similar format to OpenAI.
   * @override
   * @protected
   * @param {string} line - A single line string from the stream.
   * @returns {Object} Parsed result: { type: 'content' | 'done' | 'ignore' | 'error', chunk?: string, error?: string }.
   */
  _parseStreamChunk(line) {
    if (!line) {
      return { type: 'ignore' };
    }

    // DeepSeek also uses 'data: [DONE]'
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
             this.logger.info(`DeepSeek stream finished with reason: ${data.choices[0].finish_reason}`);
          }
          return { type: 'ignore' };
        }
      } catch (e) {
        this.logger.error('Error parsing DeepSeek stream chunk:', e, 'Line:', line);
        return { type: 'error', error: `Error parsing stream data: ${e.message}` };
      }
    }

    return { type: 'ignore' };
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
   * Build the platform-specific API request options for validation.
   * @override
   * @protected
   * @param {string} apiKey - The API key to validate.
   * @param {string} model - The model to use for validation.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildValidationRequest(apiKey, model) {
    const endpoint = this.config?.endpoint || 'https://api.deepseek.com/v1/chat/completions';
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

module.exports = DeepSeekApiService;

import BaseApiService from '../api-base.js';

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
    const endpoint =
      this.config?.endpoint || 'https://api.anthropic.com/v1/messages';
    this.logger.info(
      `[${this.platformId}] Building API request for model: ${params.model}`
    );

    const requestPayload = {
      model: params.model,
      max_tokens: params.maxTokens,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }], // Start with current prompt
      stream: true,
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

    // Enable Thinking Mode using the 'thinking' parameter if requested and budget is valid
    if (params.isThinkingEnabledForRequest && params.thinkingBudget) {
      const minBudget = 1024; // Minimum required budget by Claude API
      // Validate the provided budget against API constraints
      if (
        params.thinkingBudget >= minBudget &&
        params.thinkingBudget < params.maxTokens
      ) {
        // Add the 'thinking' object to the request payload
        requestPayload.thinking = {
          type: 'enabled',
          budget_tokens: params.thinkingBudget,
        };
        this.logger.info(
          `[${this.platformId}] Enabling Extended Thinking for model: ${params.model} with budget: ${params.thinkingBudget}`
        );
      } else {
        // Log a warning and disable thinking if the budget is invalid
        this.logger.warn(
          `[${this.platformId}] Invalid thinking budget (${params.thinkingBudget}) provided for max_tokens (${params.maxTokens}). Min required: ${minBudget}, must be less than max_tokens. Disabling thinking for this request.`
        );
        // Ensure the flag reflects that thinking won't actually be enabled
        params.isThinkingEnabledForRequest = false;
      }
    } else if (params.isThinkingEnabledForRequest && !params.thinkingBudget) {
      // Log a warning if thinking was requested but no budget was resolved
      this.logger.warn(
        `[${this.platformId}] Thinking mode requested but no budget was provided in resolved params. Thinking will not be enabled.`
      );
      params.isThinkingEnabledForRequest = false; // Ensure flag is accurate
    }

    // Prepend conversation history if available
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      // Use the helper to format history and add the current prompt correctly
      requestPayload.messages = this._formatClaudeMessages(
        params.conversationHistory,
        prompt
      );
    }

    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true', // Required for direct browser calls
      },
      body: JSON.stringify(requestPayload),
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
        // Attempt to parse the JSON data from the SSE line
        const data = JSON.parse(line.substring(6));

        // Check for content block deltas (where text or thinking content arrives)
        if (data.type === 'content_block_delta' && data.delta) {
          // Case 1: Standard text delta
          if (data.delta.type === 'text_delta' && data.delta.text) {
            return { type: 'content', chunk: data.delta.text };
          }
          // Case 2: Thinking content delta
          else if (
            data.delta.type === 'thinking_delta' &&
            data.delta.thinking
          ) {
            // Return a distinct type for thinking content
            return { type: 'thinking', chunk: data.delta.thinking };
          }
          // Case 3: Signature delta (appears at the end of a thinking block)
          else if (data.delta.type === 'signature_delta') {
            // We don't need the signature for simple streaming, so ignore it
            this.logger.info(
              `[${this.platformId}] Received signature delta (ignored).`
            );
            return { type: 'ignore' };
          }
        }

        // Check for explicit error messages within the stream data
        if (data.type === 'error') {
          const streamErrorMessage = `Stream error: ${data.error?.type} - ${data.error?.message || 'Unknown stream error'}`;
          this.logger.error(
            `[${this.platformId}] ${streamErrorMessage}`,
            data.error
          );
          // Return an error object to be handled by the base class
          return { type: 'error', error: streamErrorMessage };
        }

        // Check for explicit redacted thinking blocks (these usually appear whole, not via delta)
        if (data.type === 'redacted_thinking') {
          this.logger.info(
            `[${this.platformId}] Received full redacted thinking block (ignored).`
          );
          return { type: 'ignore' };
        }
        // Also check if a content block *starts* as redacted thinking
        if (
          data.type === 'content_block_start' &&
          data.content_block?.type === 'redacted_thinking'
        ) {
          this.logger.info(
            `[${this.platformId}] Started redacted thinking block (ignored).`
          );
          return { type: 'ignore' };
        }

        // Ignore all other event types (e.g., 'message_start', 'message_delta', 'content_block_start', 'content_block_stop' for non-redacted blocks)
        // These are metadata and don't contain streamable content chunks themselves.
        return { type: 'ignore' };
      } catch (e) {
        this.logger.error(
          `[${this.platformId}] Error parsing stream chunk:`,
          e,
          'Line:',
          line
        );
        return {
          type: 'error',
          error: `Error parsing stream data: ${e.message}`,
        };
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
            type: 'text',
            text: message.content,
          },
        ],
      });
    }

    // Add current prompt as the final user message
    formattedMessages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: currentPrompt,
        },
      ],
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
    const endpoint =
      this.config?.endpoint || 'https://api.anthropic.com/v1/messages';
    const validationPayload = {
      model: model,
      max_tokens: 1, // Minimum tokens needed
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'API validation check',
            },
          ],
        },
      ],
    };

    return {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true', // Required for direct browser calls
      },
      body: JSON.stringify(validationPayload),
    };
  }
}

export default ClaudeApiService;

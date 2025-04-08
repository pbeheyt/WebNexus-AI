const BaseApiService = require('../api-base');
// extractApiErrorMessage is now used in the base class

/**
 * Gemini API implementation
 */
class GeminiApiService extends BaseApiService {
  constructor() {
    super('gemini');
    this._streamBuffer = ""; // Buffer specific to Gemini's JSON stream parsing
  }

  /**
   * Constructs the correct Gemini API endpoint based on the model and method.
   * @param {string} model - The model ID (e.g., "gemini-1.5-pro", "gemini-1.5-pro-exp-03-25")
   * @param {string} method - The API method (e.g., ":streamGenerateContent", ":generateContent")
   * @returns {string} The fully constructed endpoint URL.
   * @throws {Error} If Gemini endpoint configuration is missing or model/method are invalid.
   */
  _getGeminiEndpoint(model, method) {
    // Use a base structure, ignore the specific endpoint in config for flexibility
    const baseTemplate = "https://generativelanguage.googleapis.com/{version}/models/{model}{method}";

    if (!model || !method) {
      throw new Error("Model and method are required to build Gemini endpoint.");
    }

    const isExperimental = model.includes('-exp-');
    const apiVersion = isExperimental ? 'v1beta' : 'v1'; // v1beta supports systemInstruction

    this.logger.info(`Using API version '${apiVersion}' for model '${model}'`);

    let endpoint = baseTemplate
      .replace('{version}', apiVersion)
      .replace('{model}', model)
      .replace('{method}', method); // Method includes the leading ':'

    return endpoint;
  }

  /**
   * Build the platform-specific API request options for Gemini.
   * @override
   * @protected
   * @param {string} prompt - The final structured prompt.
   * @param {Object} params - Resolved model parameters (model, temp, history, etc.).
   * @param {string} apiKey - The API key.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildApiRequest(prompt, params, apiKey) {
    // Construct the endpoint dynamically based on model version
    const endpoint = this._getGeminiEndpoint(params.model, ':streamGenerateContent');
    this.logger.info(`Building Gemini API request to: ${endpoint}`);

    // Gemini API uses API key as a query parameter
    const url = new URL(endpoint);
    url.searchParams.append('key', apiKey);

    // Format content according to Gemini requirements
    let formattedRequest;
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      formattedRequest = this._formatGeminiRequestWithHistory(params.conversationHistory, prompt);
    } else {
      formattedRequest = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
    }

    // Add systemInstruction if provided and supported by the model
    if (params.systemPrompt) {
      if (params.modelSupportsSystemPrompt === true) {
        this.logger.info(`Adding system prompt using systemInstruction for model: ${params.model}.`);
        formattedRequest.systemInstruction = { parts: [{ text: params.systemPrompt }] };
      } else {
        this.logger.warn(`System prompts via systemInstruction are not supported by the selected model: ${params.model}. The provided system prompt will be IGNORED.`);
      }
    }

    // Add generation configuration
    formattedRequest.generationConfig = {};
    if (params.tokenParameter) {
      formattedRequest.generationConfig[params.tokenParameter] = params.maxTokens;
    } else {
      formattedRequest.generationConfig.maxOutputTokens = params.maxTokens;
    }
    if ('temperature' in params) {
      formattedRequest.generationConfig.temperature = params.temperature;
    }
    if ('topP' in params) {
      formattedRequest.generationConfig.topP = params.topP;
    }

    return {
      url: url.toString(),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formattedRequest)
    };
  }

   /**
   * Parse a single line/chunk from the Gemini API stream.
   * Handles potentially fragmented JSON objects/arrays within the stream.
   * It uses an internal buffer (`this._streamBuffer`) to manage incomplete JSON.
   * @override
   * @protected
   * @param {string} line - A single line string chunk received from the base class stream loop.
   *                       Note: Gemini doesn't strictly use lines, so this contains raw stream data.
   * @returns {Object} Parsed result: { type: 'content' | 'error' | 'ignore', chunk?: string, error?: string }.
   *                   Returns 'ignore' if the buffer doesn't contain a complete JSON object yet.
   */
  _parseStreamChunk(line) {
    // Append the raw data (which might not be a complete line) to the buffer
    this._streamBuffer += line;
    this._streamBuffer = this._streamBuffer.trimStart();
    let jsonStr = null;
    let endPos = -1;

    try {
        // Check if buffer is empty after trimming
        if (this._streamBuffer.length === 0) return { type: 'ignore' };

        // Find the end of the first complete JSON structure in the buffer
        let openBrackets = 0;
        let openBraces = 0;
        let inString = false;
        let escapeNext = false;
        let firstChar = this._streamBuffer.charAt(0);

        // Attempt recovery if buffer doesn't start with '{' or '['
        if (firstChar !== '[' && firstChar !== '{') {
            const nextJsonStart = this._streamBuffer.search(/[\{\[]/);
            if (nextJsonStart !== -1) {
                this.logger.warn(`Gemini stream buffer recovery: Discarding "${this._streamBuffer.substring(0, nextJsonStart)}"`);
                this._streamBuffer = this._streamBuffer.substring(nextJsonStart);
                firstChar = this._streamBuffer.charAt(0);
            } else {
                // Cannot find start of JSON, discard buffer and ignore
                this.logger.warn("Clearing Gemini buffer, no JSON start found.");
                this._streamBuffer = "";
                return { type: 'ignore' };
            }
        }

        // Scan for the end of the JSON structure
        for (let i = 0; i < this._streamBuffer.length; i++) {
            const char = this._streamBuffer[i];
            if (escapeNext) { escapeNext = false; continue; }
            if (char === '\\') { escapeNext = true; continue; }
            if (char === '"') { inString = !inString; }
            if (!inString) {
                if (char === '{') openBraces++; else if (char === '}') openBraces--;
                else if (char === '[') openBrackets++; else if (char === ']') openBrackets--;
            }
            // Check if we've closed the initial structure
            if (openBrackets === 0 && openBraces === 0 && i >= 0 && (firstChar === '[' || firstChar === '{')) {
                endPos = i + 1;
                break;
            }
        }

        // If a complete JSON structure was found
        if (endPos !== -1) {
            jsonStr = this._streamBuffer.substring(0, endPos);
            this._streamBuffer = this._streamBuffer.substring(endPos).trimStart(); // Consume from buffer

            const dataArray = JSON.parse(jsonStr);
            // Gemini stream often sends an array, process the first element
            const data = Array.isArray(dataArray) ? dataArray[0] : dataArray;

            if (!data) return { type: 'ignore' }; // Empty array case

            // Check for errors reported within the stream
            if (data.error) {
                let errMsg = 'Unknown stream error';
                if (data.error.message && typeof data.error.message === 'string') {
                    errMsg = data.error.message;
                } else { try { errMsg = JSON.stringify(data.error); } catch(e) {} }
                this.logger.error(`Gemini stream error: ${errMsg}`, data.error);
                return { type: 'error', error: `API Error in stream: ${errMsg}` };
            }

            // Check for content
            if (data.candidates?.[0]?.content?.parts?.[0]) {
                const part = data.candidates[0].content.parts[0];
                const content = part.text;
                // Return content chunk if text exists, otherwise ignore
                return content ? { type: 'content', chunk: content } : { type: 'ignore' };
            }

            // Ignore other structures (like promptFeedback)
            return { type: 'ignore' };

        } else {
            // Incomplete JSON object in buffer, wait for more data
            return { type: 'ignore' };
        }

    } catch (parseError) {
        this.logger.error('Gemini JSON parsing error:', parseError, 'Buffer state:', jsonStr || this._streamBuffer.substring(0, 200));
        this._streamBuffer = ""; // Clear buffer on error to prevent infinite loops
        return { type: 'error', error: `Stream parsing error: ${parseError.message}` };
    }
  }

  /**
   * Format conversation history for Gemini API.
   * NOTE: This function does
   *       in _processWithModelStreaming using the `systemInstruction` field for v1beta.
   * @param {Array<Object>} history - Conversation history array ( { role: 'user'|'assistant', content: string } )
   * @param {string} currentPrompt - Current user prompt
   * @returns {Object} Formatted request object structure { contents: [...] }
   */
  _formatGeminiRequestWithHistory(history, currentPrompt) {
    const contents = [];

    // Append each message from history with its corresponding role (user or model)
    for (const message of history) {
      // Map 'assistant' role from internal representation to 'model' for Gemini API
      const messageRole = message.role === 'assistant' ? 'model' : 'user';

      contents.push({
        role: messageRole,
        parts: [{ text: message.content }]
      });
    }

    // Add current prompt as the final user message
    contents.push({
      role: 'user',
      parts: [{ text: currentPrompt }]
    });

    // Return the structure Gemini expects (systemInstruction is added elsewhere if needed)
    return { contents };
  }

  /**
   * Platform-specific validation implementation for Gemini
   * @protected
   * @param {string} apiKey - The API key to validate
   * @param {string} model - The model to use for validation
   * @returns {Promise<boolean>} Whether the API key is valid
   */
  async _validateWithModel(apiKey, model) {
     this.logger.info(`Validating Gemini API key with model: ${model}`);
    try {
      // Construct the endpoint dynamically based on model version
      const endpoint = this._getGeminiEndpoint(model, ':generateContent'); // Use non-streaming method
      this.logger.info(`Validation endpoint: ${endpoint}`);

      // Prepare URL with API key
      const url = new URL(endpoint);
      url.searchParams.append('key', apiKey);

      // Make a minimal validation request
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user', // Explicitly set role for validation consistency
              parts: [
                { text: "API validation check" } // Minimal prompt
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 1 // Request minimal output
          }
          // No systemInstruction needed for basic validation
        })
      });

      // Check if the response is valid (2xx status code)
      if(response.ok) {
        this.logger.info(`API key validation successful for model ${model} (Status: ${response.status})`);
        return true;
      } else {
         const errorText = await response.text();
         // Log specific error codes if helpful (e.g., 400 for bad API key)
         this.logger.warn(`API key validation failed for model ${model} (Status: ${response.status}): ${errorText.substring(0, 500)}`);
         return false;
      }

    } catch (error) {
      this.logger.error(`API key validation error for model ${model}:`, error);
      return false;
    }
  }
}

module.exports = GeminiApiService;

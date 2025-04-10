const BaseApiService = require('../api-base');

/**
 * Gemini API implementation
 */
class GeminiApiService extends BaseApiService {
  constructor() {
    super('gemini');
    this._streamBuffer = ""; // Buffer specific to Gemini's JSON stream parsing
    this._lastEmittedText = ""; // Store the last successfully emitted text for diffing
  }

  /**
   * Resets the internal state specific to Gemini streaming (buffer and last emitted text).
   * Called by the base class before starting a new stream.
   * @protected
   */
  _resetStreamState() {
    this.logger.info('Resetting Gemini stream state (buffer and last emitted text)');
    this._streamBuffer = "";
    this._lastEmittedText = "";
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
   * Implements diffing logic to send only new text increments.
   * @override
   * @protected
   * @param {string} line - A single line string chunk received from the base class stream loop.
   *                       Note: Gemini doesn't strictly use lines, so this contains raw stream data.
   * @returns {Object} Parsed result: { type: 'content' | 'error' | 'ignore', chunk?: string, error?: string }.
   *                   Returns 'ignore' if the buffer doesn't contain a complete JSON object yet.
   */
   _parseStreamChunk(line) {
    // Append the raw data
    if (line) {
        this._streamBuffer += line;
    }
    this._streamBuffer = this._streamBuffer.trimStart();

    this.logger.info(`Gemini _parseStreamChunk called. Current Buffer length: ${this._streamBuffer.length}. Buffer start: "${this._streamBuffer.substring(0, 100)}"`);

    let jsonStr = null;
    let endPos = -1;

    try {
        if (this._streamBuffer.length === 0) {
            this.logger.info("Gemini buffer empty, ignoring.");
            return { type: 'ignore' };
        }

        // --- Find JSON boundary logic (unchanged) ---
        let openBrackets = 0;
        let openBraces = 0;
        let inString = false;
        let escapeNext = false;
        let firstChar = this._streamBuffer.charAt(0);
        if (firstChar !== '[' && firstChar !== '{') {
             const nextJsonStart = this._streamBuffer.search(/[\{\[]/);
             if (nextJsonStart !== -1) {
                 this.logger.warn(`Gemini stream buffer recovery: Discarding "${this._streamBuffer.substring(0, nextJsonStart)}"`);
                 this._streamBuffer = this._streamBuffer.substring(nextJsonStart);
                 firstChar = this._streamBuffer.charAt(0);
                 if (this._streamBuffer.length === 0) return { type: 'ignore' };
             } else {
                 this.logger.warn("Clearing Gemini buffer, no JSON start found.");
                 this._streamBuffer = "";
                 return { type: 'ignore' };
             }
         }
        for (let i = 0; i < this._streamBuffer.length; i++) {
            const char = this._streamBuffer[i];
            if (escapeNext) { escapeNext = false; continue; }
            if (char === '\\') { escapeNext = true; continue; }
            if (char === '"') { inString = !inString; }
            if (!inString) {
                if (char === '{') openBraces++; else if (char === '}') openBraces--;
                else if (char === '[') openBrackets++; else if (char === ']') openBrackets--;
            }
            if (openBrackets === 0 && openBraces === 0 && i >= 0 && (firstChar === '[' || firstChar === '{')) {
                endPos = i + 1;
                break;
            }
        }
        // --- End JSON boundary logic ---


        if (endPos !== -1) {
            jsonStr = this._streamBuffer.substring(0, endPos);
            this.logger.info(`Gemini found complete JSON structure (endPos: ${endPos}). JSON String: "${jsonStr.substring(0, 200)}..."`); // Log start only

            this._streamBuffer = this._streamBuffer.substring(endPos).trimStart();
            this.logger.info(`Gemini consumed JSON. Remaining buffer length: ${this._streamBuffer.length}`);

            const parsedJson = JSON.parse(jsonStr); // Parse the whole structure

            // --- START MODIFIED HANDLING ---
            let dataToProcess = [];
            if (Array.isArray(parsedJson)) {
                this.logger.info(`Gemini parsed JSON is an ARRAY with ${parsedJson.length} elements.`);
                dataToProcess = parsedJson;
            } else if (typeof parsedJson === 'object' && parsedJson !== null) {
                 this.logger.info(`Gemini parsed JSON is a single OBJECT.`);
                dataToProcess = [parsedJson]; // Treat single object as an array of one
            } else {
                this.logger.warn(`Gemini parsed unexpected JSON type: ${typeof parsedJson}. Ignoring.`);
                return { type: 'ignore' };
            }

            let accumulatedNewChunk = "";
            let finalFullContentInChunk = this._lastEmittedText; // Start with previous baseline

            for (const data of dataToProcess) {
                this.logger.info(`Processing element. Keys: ${data ? Object.keys(data).join(', ') : 'null/empty'}`);

                if (!data) {
                    this.logger.info("Element data is null/empty, skipping.");
                    continue;
                }

                if (data.error) {
                    let errMsg = 'Unknown stream error';
                    if (data.error.message && typeof data.error.message === 'string') {
                        errMsg = data.error.message;
                    } else { try { errMsg = JSON.stringify(data.error); } catch(e) {} }
                    this.logger.error(`Gemini stream error in element: ${errMsg}`, data.error);
                    this._lastEmittedText = ""; // Reset on error
                    // If we already accumulated content, send it before the error? Or just error out?
                    // Let's just error out for now.
                    return { type: 'error', error: `API Error in stream: ${errMsg}` };
                }

                if (data.candidates?.[0]?.content?.parts?.[0]) {
                    const part = data.candidates[0].content.parts[0];
                    const currentElementFullContent = part.text || "";
                    this.logger.info(`Element extracted fullContent. Length: ${currentElementFullContent.length}. Content start: "${currentElementFullContent.substring(0, 100)}"`);
                    this.logger.info(`Element PRE-DIFF: _lastEmittedText length: ${this._lastEmittedText.length}. Text start: "${this._lastEmittedText.substring(0, 100)}"`);

                    let elementNewChunk = "";
                    // Diff against the *cumulative* last emitted text
                    if (currentElementFullContent === this._lastEmittedText) {
                        this.logger.info("Element DIFF: fullContent is identical to _lastEmittedText. No new chunk.");
                    } else if (currentElementFullContent.startsWith(this._lastEmittedText)) {
                        elementNewChunk = currentElementFullContent.substring(this._lastEmittedText.length);
                        this.logger.info(`Element DIFF: Content starts with last emitted. newChunk length: ${elementNewChunk.length}. Chunk start: "${elementNewChunk.substring(0, 100)}"`);
                    } else {
                        this.logger.warn(`Element DIFF: Content mismatch or first chunk. Sending full content as new chunk. fullContent length: ${currentElementFullContent.length}`);
                        elementNewChunk = currentElementFullContent; // Send the whole thing
                        this._lastEmittedText = ""; // Reset baseline if mismatch occurs
                    }

                    if (elementNewChunk.length > 0) {
                        accumulatedNewChunk += elementNewChunk;
                        // IMPORTANT: Update the baseline *immediately* for the next diff within this same chunk
                        this._lastEmittedText = currentElementFullContent;
                        finalFullContentInChunk = currentElementFullContent; // Track the latest full content
                        this.logger.info(`Element POST-DIFF: Updated _lastEmittedText (length: ${this._lastEmittedText.length}). Accum chunk length: ${accumulatedNewChunk.length}`);
                    } else {
                         this.logger.info("Element POST-DIFF: elementNewChunk is empty. _lastEmittedText NOT updated for this element.");
                    }
                } else {
                     this.logger.info("Element has no candidates/content/parts/text, skipping.");
                }
            } // End loop through array elements

            // After processing all elements in the array/object:
            if (accumulatedNewChunk.length > 0) {
                this.logger.info(`FINAL RETURN: Returning 'content' chunk. Total new length: ${accumulatedNewChunk.length}. Final _lastEmittedText length: ${this._lastEmittedText.length}`);
                // Note: _lastEmittedText was already updated inside the loop to the latest full content
                return { type: 'content', chunk: accumulatedNewChunk };
            } else {
                this.logger.info("FINAL RETURN: Accumulated new chunk is empty, returning 'ignore'.");
                return { type: 'ignore' };
            }
            // --- END MODIFIED HANDLING ---

        } else {
            this.logger.info("Gemini buffer does not contain a complete JSON object yet, ignoring.");
            return { type: 'ignore' };
        }

    } catch (parseError) {
        this.logger.error('Gemini JSON parsing error:', parseError, 'Buffer state:', jsonStr || this._streamBuffer.substring(0, 200));
        this._streamBuffer = "";
        this._lastEmittedText = "";
        return { type: 'error', error: `Stream parsing error: ${parseError.message}` };
    }
  }

  /**
   * Format conversation history for Gemini API.
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
   * Build the platform-specific API request options for validation.
   * @override
   * @protected
   * @param {string} apiKey - The API key to validate.
   * @param {string} model - The model to use for validation.
   * @returns {Promise<Object>} Fetch options { url, method, headers, body }.
   */
  async _buildValidationRequest(apiKey, model) {
    // Construct the endpoint dynamically based on model version
    const endpoint = this._getGeminiEndpoint(model, ':generateContent'); // Use non-streaming method
    this.logger.info(`Building Gemini validation request to: ${endpoint}`);

    // Prepare URL with API key
    const url = new URL(endpoint);
    url.searchParams.append('key', apiKey);

    const validationPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: "API validation check" } // Minimal prompt
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 1 // Request minimal output
      }
      // No systemInstruction needed for basic validation
    };

    return {
      url: url.toString(),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validationPayload)
    };
  }
}

module.exports = GeminiApiService;
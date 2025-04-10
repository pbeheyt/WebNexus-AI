// src/api/implementations/gemini-api.js
const BaseApiService = require('../api-base');

/**
 * Gemini API implementation
 */
class GeminiApiService extends BaseApiService {
  constructor() {
    super('gemini');
    this._streamBuffer = ""; // Buffer specific to Gemini's JSON stream parsing
    // REMOVED: No longer needed --> this._lastEmittedText = "";
  }

  _resetStreamState() {
    this.logger.info('Resetting Gemini stream state (buffer)');
    this._streamBuffer = "";
    // REMOVED: No longer needed --> this._lastEmittedText = "";
  }

  _getGeminiEndpoint(model, method) {
    const baseTemplate = "https://generativelanguage.googleapis.com/{version}/models/{model}{method}";
    if (!model || !method) {
      throw new Error("Model and method are required to build Gemini endpoint.");
    }
    const isExperimental = model.includes('-exp-');
    const apiVersion = isExperimental ? 'v1beta' : 'v1';
    this.logger.info(`Using API version '${apiVersion}' for model '${model}'`);
    return baseTemplate
      .replace('{version}', apiVersion)
      .replace('{model}', model)
      .replace('{method}', method);
  }

  async _buildApiRequest(prompt, params, apiKey) {
    const endpoint = this._getGeminiEndpoint(params.model, ':streamGenerateContent');
    this.logger.info(`Building Gemini API request to: ${endpoint}`);
    const url = new URL(endpoint);
    url.searchParams.append('key', apiKey);

    let formattedRequest;
    if (params.conversationHistory && params.conversationHistory.length > 0) {
      formattedRequest = this._formatGeminiRequestWithHistory(params.conversationHistory, prompt);
    } else {
      formattedRequest = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
    }

    if (params.systemPrompt) {
      if (params.modelSupportsSystemPrompt === true) {
        this.logger.info(`Adding system prompt using systemInstruction for model: ${params.model}.`);
        formattedRequest.systemInstruction = { parts: [{ text: params.systemPrompt }] };
      } else {
        this.logger.warn(`System prompts via systemInstruction are not supported by the selected model: ${params.model}. The provided system prompt will be IGNORED.`);
      }
    }

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
   * If a complete JSON structure is an array, iterates through its elements.
   * Extracts the text from each part as an individual chunk.
   * @override
   * @protected
   * @param {string} line - A single line string chunk received from the base class stream loop, OR an empty string to process the internal buffer.
   * @returns {Object} Parsed result: { type: 'content', chunks: string[] } | { type: 'error', error: string } | { type: 'ignore' }.
   *                   Returns 'ignore' if the buffer doesn't contain a complete JSON object yet.
   */
   _parseStreamChunk(line) {
    if (line) {
        this._streamBuffer += line;
    }
    this._streamBuffer = this._streamBuffer.trimStart();

    let jsonStr = null;
    let endPos = -1;

    try {
        if (this._streamBuffer.length === 0) {
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
            this._streamBuffer = this._streamBuffer.substring(endPos).trimStart(); // Consume

            const parsedJson = JSON.parse(jsonStr);

            // --- START SIMPLIFIED HANDLING ---
            let dataToProcess = [];
            if (Array.isArray(parsedJson)) {
                dataToProcess = parsedJson;
            } else if (typeof parsedJson === 'object' && parsedJson !== null) {
                dataToProcess = [parsedJson]; // Treat single object as an array of one
            } else {
                this.logger.warn(`Gemini parsed unexpected JSON type: ${typeof parsedJson}. Ignoring.`);
                return { type: 'ignore' };
            }

            let newChunks = []; // Array to hold individual chunks

            for (const data of dataToProcess) {
                if (!data) continue; // Skip null/empty elements

                if (data.error) {
                    let errMsg = data.error.message || JSON.stringify(data.error);
                    this.logger.error(`Gemini stream error in element: ${errMsg}`, data.error);
                    // No need to reset _lastEmittedText anymore
                    return { type: 'error', error: `API Error in stream: ${errMsg}` };
                }

                // Directly extract the text chunk if available
                const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text;

                if (textChunk && textChunk.length > 0) {
                    this.logger.info(`Gemini extracted text chunk. Length: ${textChunk.length}. Chunk start: "${textChunk.substring(0, 100)}"`);
                    newChunks.push(textChunk); // Add the chunk directly
                } else {
                    // Log if we got a valid structure but no text
                    this.logger.info("Gemini element has no text content, skipping.");
                }
            } // End loop through array elements

            // After processing all elements:
            if (newChunks.length > 0) {
                this.logger.info(`Gemini returning ${newChunks.length} new content chunks.`);
                return { type: 'content', chunks: newChunks }; // Return array of chunks
            } else {
                this.logger.info("Gemini processed JSON but found no new text chunks, ignoring.");
                return { type: 'ignore' };
            }
            // --- END SIMPLIFIED HANDLING ---

        } else {
            // Incomplete JSON object in buffer
            return { type: 'ignore' };
        }

    } catch (parseError) {
        this.logger.error('Gemini JSON parsing error:', parseError, 'Buffer state:', jsonStr || this._streamBuffer.substring(0, 200));
        this._streamBuffer = "";
        // No need to reset _lastEmittedText anymore
        return { type: 'error', error: `Stream parsing error: ${parseError.message}` };
    }
  }

  _formatGeminiRequestWithHistory(history, currentPrompt) {
    const contents = [];
    for (const message of history) {
      const messageRole = message.role === 'assistant' ? 'model' : 'user';
      contents.push({ role: messageRole, parts: [{ text: message.content }] });
    }
    contents.push({ role: 'user', parts: [{ text: currentPrompt }] });
    return { contents };
  }

  async _buildValidationRequest(apiKey, model) {
    const endpoint = this._getGeminiEndpoint(model, ':generateContent');
    this.logger.info(`Building Gemini validation request to: ${endpoint}`);
    const url = new URL(endpoint);
    url.searchParams.append('key', apiKey);
    const validationPayload = {
      contents: [{ role: 'user', parts: [{ text: "API validation check" }] }],
      generationConfig: { maxOutputTokens: 1 }
    };
    return {
      url: url.toString(),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validationPayload)
    };
  }
}

module.exports = GeminiApiService;
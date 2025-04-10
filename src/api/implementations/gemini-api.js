// src/api/implementations/gemini-api.js
const BaseApiService = require('../api-base');

/**
 * Gemini API implementation
 */
class GeminiApiService extends BaseApiService {
  constructor() {
    super('gemini');
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
    url.searchParams.append('alt', 'sse');
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
    if (!line || !line.startsWith('data: ')) {
      // Ignore empty lines or lines not starting with 'data: '
      // Also handles potential 'event:' lines if Gemini SSE uses them.
      // Check for potential [DONE] signal if Gemini SSE uses it.
      if (line === 'data: [DONE]') {
         this.logger.info('Gemini SSE stream signal [DONE] received.');
         return { type: 'done' };
      }
      return { type: 'ignore' };
    }

    // Extract the JSON string part after 'data: '
    const jsonString = line.substring(5).trim(); // Get content after 'data: '

    if (!jsonString) {
      return { type: 'ignore' }; // Ignore if data part is empty
    }

    try {
      const data = JSON.parse(jsonString);

      // Extract text content - assuming the same structure as the previous JSON stream
      // Check candidates -> content -> parts -> text
      const textChunk = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (textChunk && typeof textChunk === 'string') {
        // Return the extracted text chunk
        return { type: 'content', chunk: textChunk };
      } else {
        // If structure is valid but no text found, or if error field exists
        if (data?.error) {
            const errorMessage = data.error.message || JSON.stringify(data.error);
            this.logger.error(`Gemini SSE stream returned an error: ${errorMessage}`, data.error);
            return { type: 'error', error: `API Error in stream: ${errorMessage}` };
        }
        // Log other valid structures without text for debugging
        if (data?.candidates?.[0]?.finishReason) {
            this.logger.info(`Gemini SSE stream finished with reason: ${data.candidates[0].finishReason}`);
            // We might treat specific finish reasons differently later if needed.
            // For now, ignore finish reason markers unless they contain an error.
        } else {
            this.logger.warn('Parsed Gemini SSE data, but no text chunk found or structure mismatch.', data);
        }
        return { type: 'ignore' }; // Ignore chunks without usable text content
      }
    } catch (parseError) {
      this.logger.error('Error parsing Gemini SSE JSON chunk:', parseError, 'Raw JSON String:', jsonString);
      // Return error type on JSON parsing failure
      return { type: 'error', error: `Error parsing stream data: ${parseError.message}` };
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

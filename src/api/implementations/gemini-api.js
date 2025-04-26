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
    const isPreviewOrExperimental = model.includes('-exp-') || model.includes('-preview-');
    const apiVersion = isPreviewOrExperimental ? 'v1beta' : 'v1';
    this.logger.info(`[${this.platformId}] Using API version '${apiVersion}' for model '${model}'`);
    return baseTemplate
      .replace('{version}', apiVersion)
      .replace('{model}', model)
      .replace('{method}', method);
  }

  async _buildApiRequest(prompt, params, apiKey) {
    const endpoint = this._getGeminiEndpoint(params.model, ':streamGenerateContent');
    this.logger.info(`[${this.platformId}] Building API request to: ${endpoint}`);
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
        this.logger.info(`[${this.platformId}] Adding system prompt using systemInstruction for model: ${params.model}.`);
        formattedRequest.systemInstruction = { parts: [{ text: params.systemPrompt }] };
      } else {
        this.logger.warn(`[${this.platformId}] System prompts via systemInstruction are not supported by the selected model: ${params.model}. The provided system prompt will be IGNORED.`);
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

    // Add thinkingMode to the request body
    if ('thinkingMode' in params && params.thinkingMode) {
      formattedRequest.thinkingMode = {
        type: params.thinkingMode.type,
        budget: params.thinkingMode.budgetTokens ? { tokens: params.thinkingMode.budgetTokens } : undefined
      };
    }

    return {
      url: url.toString(),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formattedRequest)
    };
  }

  _parseStreamChunk(line) {
    if (!line || !line.startsWith('data: ')) {
      if (line === 'data: [DONE]') {
         this.logger.info(`[${this.platformId}] SSE stream signal [DONE] received.`);
         return { type: 'done' };
      }
      return { type: 'ignore' };
    }

    const jsonString = line.substring(5).trim();

    if (!jsonString) {
      return { type: 'ignore' };
    }

    try {
      const data = JSON.parse(jsonString);

      const textChunk = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (textChunk && typeof textChunk === 'string') {
        return { type: 'content', chunk: textChunk };
      } else {
        if (data?.error) {
            const errorMessage = data.error.message || JSON.stringify(data.error);
            this.logger.error(`[${this.platformId}] SSE stream returned an error: ${errorMessage}`, data.error);
            return { type: 'error', error: `API Error in stream: ${errorMessage}` };
        }
        if (data?.candidates?.[0]?.finishReason) {
            this.logger.info(`[${this.platformId}] SSE stream finished with reason: ${data.candidates[0].finishReason}`);
        } else {
            this.logger.warn(`[${this.platformId}] Parsed SSE data, but no text chunk found or structure mismatch.`, data);
        }
        return { type: 'ignore' };
      }
    } catch (parseError) {
      this.logger.error(`[${this.platformId}] Error parsing SSE JSON chunk:`, parseError, 'Raw JSON String:', jsonString);
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
    this.logger.info(`[${this.platformId}] Building validation request to: ${endpoint}`);
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
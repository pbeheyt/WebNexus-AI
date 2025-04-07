const BaseApiService = require('../api-base');
const { extractApiErrorMessage } = require('../../shared/utils/error-utils');

/**
 * Gemini API implementation
 */
class GeminiApiService extends BaseApiService {
  constructor() {
    super('gemini');
  }

  /**
   * Constructs the correct Gemini API endpoint based on the model and method.
   * @param {string} model - The model ID (e.g., "gemini-1.5-pro", "gemini-2.5-pro-exp-03-25")
   * @param {string} method - The API method (e.g., ":streamGenerateContent", ":generateContent")
   * @returns {string} The fully constructed endpoint URL.
   * @throws {Error} If Gemini endpoint configuration is missing.
   */
  _getGeminiEndpoint(model, method) {
    // Use a base structure, ignore the specific endpoint in config for flexibility
    const baseTemplate = "https://generativelanguage.googleapis.com/{version}/models/{model}{method}";

    if (!model || !method) {
      throw new Error("Model and method are required to build Gemini endpoint.");
    }

    const isExperimental = model.includes('-exp-');
    const apiVersion = isExperimental ? 'v1beta' : 'v1';

    this.logger.info(`Using API version '${apiVersion}' for model '${model}'`);

    let endpoint = baseTemplate
      .replace('{version}', apiVersion)
      .replace('{model}', model)
      .replace('{method}', method); // Method includes the leading ':'

    return endpoint;
  }

  /**
   * Process with model-specific parameters and streaming support
   * @param {string} text - Prompt text
   * @param {string} model - Model ID to use
   * @param {string} apiKey - API key
   * @param {Object} params - Resolved parameters including conversation history
   * @param {function} onChunk - Callback function for receiving text chunks
   * @param {AbortSignal} [abortSignal] - Optional AbortSignal for cancellation
   * @returns {Promise<Object>} API response metadata (only returned on success, otherwise error is handled via onChunk)
   */
  async _processWithModelStreaming(text, params, apiKey, onChunk, abortSignal) {
    let reader; // Declare reader outside try block for finally access

    try {
      // Construct the endpoint dynamically based on model version
      const endpoint = this._getGeminiEndpoint(params.model, ':streamGenerateContent');
      this.logger.info(`Making Gemini API streaming request to: ${endpoint}`);

      // Gemini API uses API key as a query parameter
      const url = new URL(endpoint);
      url.searchParams.append('key', apiKey);

      // Format content according to Gemini requirements (logic remains the same)
      let formattedContent = text;
      let formattedRequest;
      if (params.conversationHistory && params.conversationHistory.length > 0) {
        formattedRequest = this._formatGeminiRequestWithHistory(
          params.conversationHistory, text, params.systemPrompt
        );
      } else {
        if (params.systemPrompt) {
           this.logger.warn('Gemini does not officially support system prompts via this API structure, prepending to user text.');
           formattedContent = `${params.systemPrompt}\n\n${text}`;
        }
        formattedRequest = { contents: [{ parts: [{ text: formattedContent }] }] };
      }
      formattedRequest.generationConfig = {};
      if (params.tokenParameter) {
        formattedRequest.generationConfig[params.tokenParameter] = params.maxTokens;
      } else {
        formattedRequest.generationConfig.maxOutputTokens = params.maxTokens;
      }
      // Add generation config if parameters are defined in params (inclusion handled by ModelParameterService)
      if ('temperature' in params) {
         formattedRequest.generationConfig.temperature = params.temperature;
      }
      if ('topP' in params) {
         formattedRequest.generationConfig.topP = params.topP;
      }

      // Make the streaming request
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedRequest),
        signal: abortSignal // Add this line
      });

      // Handle non-OK responses by sending an error chunk
      if (!response.ok) {
        const errorMessage = await extractApiErrorMessage(response);
        this.logger.error(`Gemini API Error: ${errorMessage}`, response); // Log the original response
        onChunk({ done: true, error: errorMessage, model: params.model });
        return; // Stop processing on error
      }

      // Process the stream
      reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulatedContent = "";

      // Inner try/catch specifically for the stream reading/parsing loop
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break; // Exit loop when stream is finished

          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.trimStart();

          let processAgain = true;
          while (processAgain && buffer.length > 0) {
            processAgain = false;
            let jsonStr = null;
            let endPos = -1;

            try {
              // Find the end of the first complete JSON structure (simplified logic)
              let openBrackets = 0;
              let openBraces = 0;
              let inString = false;
              let escapeNext = false;
              let firstChar = buffer.charAt(0);

              if (firstChar !== '[' && firstChar !== '{') {
                this.logger.info("Buffer doesn't start with expected JSON, attempting recovery:", buffer.substring(0, 100));
                const nextJsonStart = buffer.search(/[\{\[]/);
                if (nextJsonStart !== -1) {
                  buffer = buffer.substring(nextJsonStart);
                  firstChar = buffer.charAt(0);
                } else {
                  this.logger.warn("No JSON start found in buffer, clearing.");
                  buffer = "";
                  continue; // Skip to next reader.read()
                }
              }

              for (let i = 0; i < buffer.length; i++) {
                 const char = buffer[i];
                 if (escapeNext) { escapeNext = false; continue; }
                 if (char === '\\') { escapeNext = true; continue; }
                 if (char === '"') { inString = !inString; }
                 if (!inString) {
                     if (char === '{') openBraces++; else if (char === '}') openBraces--;
                     else if (char === '[') openBrackets++; else if (char === ']') openBrackets--;
                 }
                 if (openBrackets === 0 && openBraces === 0 && i >= 0 && (firstChar === '[' || firstChar === '{')) {
                    // Found the end of a top-level structure
                    endPos = i + 1;
                    break;
                 }
              }

              if (endPos !== -1) {
                jsonStr = buffer.substring(0, endPos);
                buffer = buffer.substring(endPos).trimStart();

                const dataArray = JSON.parse(jsonStr); // Parse the extracted JSON

                for (const data of (Array.isArray(dataArray) ? dataArray : [dataArray])) {
                  if (data.error) {
                    // Refined error message extraction for stream errors
                    let streamErrorMessage = 'Unknown stream error'; // Default
                    if (data.error) {
                      if (typeof data.error.message === 'string') {
                        streamErrorMessage = data.error.message;
                      } else {
                        try {
                          // Fallback: stringify the error object if message isn't a string
                          streamErrorMessage = JSON.stringify(data.error);
                        } catch (stringifyError) {
                          // If stringify fails, keep the default
                          this.logger.warn('Could not stringify stream error object:', stringifyError);
                        }
                      }
                    }
                    // Prepend context
                    streamErrorMessage = `API Error in stream: ${streamErrorMessage}`;

                    this.logger.error(streamErrorMessage, data.error); // Log the extracted/fallback message and the original error object
                    // Send error chunk and stop processing THIS stream
                    onChunk({ done: true, error: streamErrorMessage, model: params.model }); // Use the refined message
                    // Release lock and return immediately from the outer function
                    if (reader) await reader.releaseLock().catch(e => this.logger.error('Error releasing lock after stream error:', e));
                    reader = null;
                    return;
                  }

                  if (data.candidates?.[0]?.content?.parts?.[0]) {
                    const part = data.candidates[0].content.parts[0];
                    const content = part.text || '';
                    if (content) {
                      accumulatedContent += content;
                      onChunk({ chunk: content, done: false, model: params.model });
                    }
                  }
                }
                processAgain = true; // Successfully processed, check buffer again
              } else {
                // Incomplete JSON, wait for more data
                break; // Exit inner loop, wait for next read()
              }

            } catch (parseOrProcessError) {
              // Catch errors from JSON.parse or processing the data block
              this.logger.error('JSON parsing or processing error in stream chunk:', parseOrProcessError, 'Problematic JSON string:', jsonStr || buffer.substring(0, 200));
              // Send error chunk and stop processing
              onChunk({ done: true, error: `Stream parsing error: ${parseOrProcessError.message}`, model: params.model });
              if (reader) await reader.releaseLock().catch(e => this.logger.error('Error releasing lock after parse error:', e));
              reader = null;
              return; // Exit outer function
            }
          } // end while(processAgain)
        } // end while(true) from reader.read()

      } catch (streamReadError) {
        // Catch errors from reader.read() itself
        this.logger.error('Stream reading error:', streamReadError);
        onChunk({ done: true, error: `Stream read error: ${streamReadError.message}`, model: params.model });
        // No return needed here, finally will execute
      }
      // End of inner try/catch for stream processing

      // If we exit the loop successfully, send the final done signal
      onChunk({
        chunk: '',
        done: true,
        model: params.model,
        fullContent: accumulatedContent
      });

      // Return metadata only on successful completion
      return {
        success: true,
        content: accumulatedContent,
        model: params.model,
        platformId: this.platformId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      // Catch errors from initial setup, fetch, or errors re-thrown/missed by inner catches
      if (error.name === 'AbortError') {
        this.logger.info('API request cancelled via AbortController.');
        // Send a specific cancellation message/error via onChunk
        onChunk({
          done: true,
          error: 'Cancelled by user', // Specific cancellation message
          model: params.model
        });
      } else {
        // Handle other errors as before
        this.logger.error('API streaming processing error (outer catch):', error);
        onChunk({
          done: true,
          error: error.message || 'An unknown streaming error occurred',
          model: params.model // Use model from params
        });
      }
      // Do not re-throw error here, it's handled by onChunk
    } finally {
      // Ensure the reader is released even if errors occur
      if (reader && typeof reader.releaseLock === 'function') {
        try {
          await reader.releaseLock();
        } catch (releaseError) {
          this.logger.error('Error releasing stream reader lock:', releaseError);
        }
      }
    }
  }

  /**
   * Format conversation history for Gemini API
   * @param {Array} history - Conversation history array
   * @param {string} currentPrompt - Current user prompt
   * @param {string} systemPrompt - Optional system prompt
   * @returns {Object} Formatted request object structure { contents: [...] }
   */
  _formatGeminiRequestWithHistory(history, currentPrompt, systemPrompt = null) {
    const contents = [];

    // Add system prompt as a user message if provided
    if (systemPrompt) {
      this.logger.info('Prepending system prompt as first user message for Gemini history.');
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
    }

    // Append each message from history with its corresponding role
    for (const message of history) {
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

    // Return the structure Gemini expects
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
              parts: [
                { text: "API validation check" } // Minimal prompt
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 1 // Request minimal output
          }
        })
      });

      // Check if the response is valid (2xx status code)
      if(response.ok) {
        this.logger.info(`API key validation successful for model ${model} (Status: ${response.status})`);
        return true;
      } else {
         const errorText = await response.text();
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

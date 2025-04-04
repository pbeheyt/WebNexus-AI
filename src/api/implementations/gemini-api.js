const BaseApiService = require('../api-base');

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
   * @returns {Promise<Object>} API response metadata (only returned on success, otherwise error is handled via onChunk)
   */
  async _processWithModelStreaming(text, model, apiKey, params, onChunk) {
    let reader; // Declare reader outside try block for finally access
    const modelToUse = model; // Use the provided model directly

    try {
      // Construct the endpoint dynamically based on model version
      const endpoint = this._getGeminiEndpoint(modelToUse, ':streamGenerateContent');
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
      if (params.supportsTemperature && typeof params.temperature === 'number') {
         formattedRequest.generationConfig.temperature = params.temperature;
      }
      if (params.supportsTopP && typeof params.topP === 'number') {
         formattedRequest.generationConfig.topP = params.topP;
      }

      // Make the streaming request
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedRequest)
      });

      // Handle non-OK responses by sending an error chunk
      if (!response.ok) {
        let errorBody = await response.text();
        let errorMessage = `API error (${response.status}): ${response.statusText}`;
        try {
            const errorData = JSON.parse(errorBody);
            errorMessage = `API error (${response.status}): ${errorData.error?.message || errorMessage}`;
        } catch (e) {
            if (errorBody.length < 500) errorMessage = `API error (${response.status}): ${errorBody}`;
             this.logger.info("Failed to parse error response as JSON:", errorBody);
        }
        this.logger.error(`Gemini API Error: ${errorMessage}`);
        onChunk({ done: true, error: errorMessage, model: modelToUse });
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
                    const streamErrorMessage = `API Error in stream: ${data.error.message || 'Unknown error'}`;
                    this.logger.error(streamErrorMessage, data.error);
                    // Send error chunk and stop processing THIS stream
                    onChunk({ done: true, error: streamErrorMessage, model: modelToUse });
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
                      onChunk({ chunk: content, done: false, model: modelToUse });
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
              this.logger.error('Error parsing/processing stream chunk:', parseOrProcessError, 'Chunk:', jsonStr || buffer.substring(0, 200));
              // Send error chunk and stop processing
              onChunk({ done: true, error: `Stream parsing error: ${parseOrProcessError.message}`, model: modelToUse });
              if (reader) await reader.releaseLock().catch(e => this.logger.error('Error releasing lock after parse error:', e));
              reader = null;
              return; // Exit outer function
            }
          } // end while(processAgain)
        } // end while(true) from reader.read()

      } catch (streamReadError) {
        // Catch errors from reader.read() itself
        this.logger.error('Stream reading error:', streamReadError);
        onChunk({ done: true, error: `Stream read error: ${streamReadError.message}`, model: modelToUse });
        // No return needed here, finally will execute
      }
      // End of inner try/catch for stream processing

      // If we exit the loop successfully, send the final done signal
      onChunk({
        chunk: '',
        done: true,
        model: modelToUse,
        fullContent: accumulatedContent
      });

      // Return metadata only on successful completion
      return {
        success: true,
        content: accumulatedContent,
        model: modelToUse,
        platformId: this.platformId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      // Catch errors from initial setup, fetch, or errors re-thrown/missed by inner catches
      this.logger.error('API streaming processing error (outer catch):', error);
      // Send error chunk if an unexpected error occurs
      onChunk({
        done: true,
        error: error.message || 'An unknown streaming error occurred',
        model: modelToUse
      });
      // Do not re-throw; error is handled by sending the chunk
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

    // IMPORTANT: Gemini v1/v1beta generateContent API handles roles differently than some others.
    // It expects alternating user/model roles. System prompts aren't directly supported
    // in the main 'contents' array structure in the same way as OpenAI/Anthropic.
    // The 'systemInstruction' field is available in v1beta but separate from 'contents'.

    let currentRole = 'user'; // Start expecting user

    // Prepend system prompt as the *very first* user message if provided.
    // This is a common workaround, effectiveness varies.
    if (systemPrompt) {
       this.logger.info('Prepending system prompt as first user message for Gemini history.');
       contents.push({
           role: 'user',
           parts: [{ text: systemPrompt }]
       });
       // Add a dummy model response to maintain alternation if needed by model
       contents.push({
          role: 'model',
          parts: [{ text: 'Understood.' }] // Or some other neutral response
       });
       currentRole = 'user'; // Next message must be user
    }


    for (const message of history) {
      const expectedRole = currentRole;
      const messageRole = message.role === 'assistant' ? 'model' : 'user';

      // Ensure alternation: If the current message role doesn't match the expected
      // alternating role, log a warning. Simple merging or dropping might be needed
      // for strict models, but for now, just push it.
      if (messageRole !== expectedRole) {
          this.logger.warn(`Gemini History: Expected role '${expectedRole}' but got '${messageRole}'. Model might ignore or error.`);
          // Simple fix: Force the role? Or skip? For now, let it pass.
      }

      contents.push({
        role: messageRole,
        parts: [{ text: message.content }]
      });
      currentRole = messageRole === 'user' ? 'model' : 'user'; // Flip expectation
    }

     // Ensure the final prompt is from the user role
     if (currentRole !== 'user') {
         // If the last history message was 'user', the model expects 'model' next.
         // We need to add the current prompt as 'user', which might violate strict alternation.
         // A common practice is to just add it.
         this.logger.warn(`Gemini History: Adding final user prompt after a '${currentRole}' message. Strict models might require alternation.`);
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

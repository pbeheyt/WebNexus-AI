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
   * @returns {Promise<Object>} API response metadata
   */
  async _processWithModelStreaming(text, model, apiKey, params, onChunk) {
    try {
      // Construct the endpoint dynamically based on model version
      const endpoint = this._getGeminiEndpoint(model, ':streamGenerateContent');
      this.logger.info(`Making Gemini API streaming request to: ${endpoint}`);

      // Gemini API uses API key as a query parameter
      const url = new URL(endpoint);
      url.searchParams.append('key', apiKey);

      // Format content according to Gemini requirements
      let formattedContent = text;
      let formattedRequest;

      // Handle conversation history if provided
      if (params.conversationHistory && params.conversationHistory.length > 0) {
        formattedRequest = this._formatGeminiRequestWithHistory(
          params.conversationHistory,
          text,
          params.systemPrompt
        );
      } else {
        // Note: Gemini doesn't support system prompts natively in v1/v1beta generateContent
        if (params.systemPrompt) {
          // Prepending might work sometimes, but isn't officially supported structure
           this.logger.warn('Gemini does not officially support system prompts via this API structure, prepending to user text.');
           formattedContent = `${params.systemPrompt}\n\n${text}`;
        }

        formattedRequest = {
          contents: [
            {
              // Role 'user' is implicit for the first message if only one is sent
              parts: [
                { text: formattedContent }
              ]
            }
          ]
          // SystemInstruction could be added for v1beta if needed, but requires specific structure
          // if (params.systemPrompt && apiVersion === 'v1beta') {
          //  formattedRequest.systemInstruction = { parts: [{ text: params.systemPrompt }] };
          // }
        };
      }

      // Add generation configuration
      formattedRequest.generationConfig = {};

      // Add model-specific parameters
      if (params.tokenParameter) { // Use specific token parameter from config if defined
        formattedRequest.generationConfig[params.tokenParameter] = params.maxTokens;
      } else { // Default for Gemini
        formattedRequest.generationConfig.maxOutputTokens = params.maxTokens;
      }

      // Add temperature if supported
      if (params.supportsTemperature && typeof params.temperature === 'number') {
         formattedRequest.generationConfig.temperature = params.temperature;
      }

      // Add top_p if supported
      if (params.supportsTopP && typeof params.topP === 'number') {
         formattedRequest.generationConfig.topP = params.topP;
      }

      // *** Start of Streaming Fetch and Processing (identical to original) ***
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formattedRequest)
      });

      if (!response.ok) {
        let errorBody = await response.text(); // Get raw text first
        let errorMessage = response.statusText;
        try {
            const errorData = JSON.parse(errorBody); // Try parsing as JSON
            errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {
            // If JSON parsing fails, use the raw text if it's not too long
            if (errorBody.length < 500) { // Avoid logging huge HTML error pages
                errorMessage = errorBody;
            }
             this.logger.debug("Failed to parse error response as JSON:", errorBody);
        }
        throw new Error(
          `API error (${response.status}): ${errorMessage}`
        );
      }

      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulatedContent = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk and append to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete JSON arrays/objects in the buffer
          // Gemini stream sends an array of responses, potentially chunked
          // A simple approach: look for top-level JSON structures
          buffer = buffer.trimStart(); // Remove leading whitespace

          // Attempt to process buffer containing potentially multiple JSON objects/arrays
          let processAgain = true;
          while(processAgain && buffer.length > 0) {
              processAgain = false; // Assume we process only one structure per loop unless specified
              try {
                  // Find the end of the first complete JSON structure (array or object)
                  let openBrackets = 0;
                  let openBraces = 0;
                  let inString = false;
                  let escapeNext = false;
                  let endPos = -1;
                  let firstChar = buffer.charAt(0);

                  if (firstChar !== '[' && firstChar !== '{') {
                      this.logger.debug("Buffer doesn't start with expected JSON structure, skipping chunk:", buffer.substring(0, 100));
                      // If buffer doesn't start with JSON, we might have corrupt data.
                      // A simple recovery is to find the next '[' or '{' but this can lose data.
                      const nextJsonStart = buffer.search(/[\{\[]/);
                      if (nextJsonStart !== -1) {
                           buffer = buffer.substring(nextJsonStart);
                           firstChar = buffer.charAt(0); // Update firstChar
                      } else {
                           buffer = ""; // Clear buffer if no JSON start found
                           break; // Exit inner loop
                      }
                  }


                  for (let i = 0; i < buffer.length; i++) {
                      const char = buffer[i];

                      if (escapeNext) {
                          escapeNext = false;
                          continue;
                      }
                      if (char === '\\') {
                          escapeNext = true;
                          continue;
                      }
                      if (char === '"') {
                          inString = !inString;
                      }

                      if (!inString) {
                          if (char === '{') openBraces++;
                          else if (char === '}') openBraces--;
                          else if (char === '[') openBrackets++;
                          else if (char === ']') openBrackets--;
                      }

                      // Check if we've closed the initial structure
                       if (firstChar === '[' && openBrackets === 0 && i > 0) {
                           endPos = i + 1;
                           break;
                       } else if (firstChar === '{' && openBraces === 0 && i > 0) {
                           endPos = i + 1;
                           break;
                       } else if (openBrackets === 0 && openBraces === 0 && i > 0 && (firstChar === '[' || firstChar === '{')) {
                         // Closed initial structure, but could be nested
                         endPos = i + 1;
                         break;
                       }
                  }


                  if (endPos !== -1) {
                      const jsonStr = buffer.substring(0, endPos);
                      buffer = buffer.substring(endPos).trimStart(); // Remove processed part and trim

                      try {
                           const dataArray = JSON.parse(jsonStr); // Gemini often sends an array

                          // Process each item in the array (usually just one item per streamed chunk)
                          for(const data of (Array.isArray(dataArray) ? dataArray : [dataArray])) { // Handle both array and single object responses
                              // Extract content from Gemini's streaming format
                              if (data.candidates &&
                                  data.candidates[0].content &&
                                  data.candidates[0].content.parts &&
                                  data.candidates[0].content.parts.length > 0) {

                                  // Gemini may return different content part types
                                  const part = data.candidates[0].content.parts[0];
                                  let content = '';

                                  if (part.text) {
                                      content = part.text;
                                  }
                                  // Add other potential part types if needed

                                  if (content) {
                                      accumulatedContent += content;
                                      onChunk({
                                          chunk: content,
                                          done: false,
                                          model: model
                                      });
                                  }
                              } else if (data.error) {
                                // Handle potential errors within the stream
                                this.logger.error('Error message received in stream:', data.error);
                                // Decide if we should stop or continue
                                throw new Error(`API Error in stream: ${data.error.message || 'Unknown error'}`);
                              }
                          }
                          processAgain = true; // Indicate that we might have more data in the buffer to process immediately

                      } catch (parseError) {
                          this.logger.error('Failed to parse JSON chunk:', parseError, 'Chunk:', jsonStr);
                          // Skip this chunk and continue with the rest of the buffer? Or throw?
                          // For now, log and continue trying to process the rest of the buffer.
                           processAgain = true; // Try to process the rest of the buffer
                      }

                  } else {
                     // Incomplete JSON structure, wait for more data
                      break; // Exit the inner while loop, wait for next reader.read()
                  }

              } catch (e) {
                  this.logger.error('Error processing stream buffer:', e, "Buffer:", buffer.substring(0, 200));
                   // Clear buffer to prevent infinite loops on bad data?
                   buffer = "";
                   break; // Exit inner loop
              }
          } // end while(processAgain)
        } // end while(true) from reader.read()

        // Final decoding to get any remaining content
        // buffer += decoder.decode(); // Usually not needed with stream: true

        // Send final done signal
        onChunk({
          chunk: '',
          done: true,
          model: model,
          fullContent: accumulatedContent
        });

        return {
          success: true,
          content: accumulatedContent,
          model: model,
          platformId: this.platformId,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        this.logger.error('Stream processing error:', error);
        // Ensure final "done" signal is sent even on error
         onChunk({
           chunk: '',
           done: true,
           model: model,
           fullContent: accumulatedContent, // Send what we got
           error: error.message // Optionally include error info
         });
        throw error;
      } finally {
         if (reader && typeof reader.releaseLock === 'function') {
             reader.releaseLock();
         }
      }
      // *** End of Streaming Fetch and Processing ***

    } catch (error) {
      this.logger.error('API streaming processing error:', error);
       // Ensure error is propagated or handled
        onChunk({
           chunk: '',
           done: true,
           model: model,
           fullContent: '', // No content if error happened early
           error: error.message
         });
      throw error;
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
      this.logger.debug(`Validation endpoint: ${endpoint}`);

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
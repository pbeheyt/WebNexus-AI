// src/api/api-base.js
const ApiInterface = require('./api-interface');
const { extractApiErrorMessage } = require('../shared/utils/error-utils');
const ConfigService = require('../services/ConfigService');

/**
 * Base class with shared API functionality
 */
class BaseApiService extends ApiInterface {
  constructor(platformId) {
    super();
    this.platformId = platformId;
    this.logger = this._createLogger();
    this.credentials = null;
    this.config = null;
  }

  async initialize(credentials) {
    this.credentials = credentials;
    this.config = await ConfigService.getPlatformApiConfig(this.platformId);
    this.logger.info('API service initialized');
  }

  async processRequest(requestConfig) {
    const { prompt, resolvedParams, formattedContent, onChunk, abortSignal } = requestConfig;
    const { apiKey } = this.credentials;
    const model = resolvedParams?.model;

    try {
      if (!requestConfig || !resolvedParams || !prompt || !onChunk) {
        throw new Error('Invalid requestConfig provided to BaseApiService.processRequest');
      }
      if (!apiKey) {
        throw new Error('API key not available in BaseApiService');
      }

      const structuredPrompt = this._createStructuredPrompt(prompt, formattedContent);
      this.logger.info(`Processing request for model ${model} with${formattedContent ? ' included' : 'out'} content.`);
      const fetchOptions = await this._buildApiRequest(structuredPrompt, resolvedParams, apiKey);
      await this._executeStreamingRequest(fetchOptions, onChunk, abortSignal, model);

      this.logger.info(`Streaming request for model ${model} completed.`);
      return { success: true, model: model };

    } catch (error) {
      this.logger.error(`Error in BaseApiService.processRequest for model ${model}:`, error);
      if (onChunk && typeof onChunk === 'function') {
        onChunk({
          done: true,
          error: `API Request Setup Error: ${error.message}`,
          model: model || 'unknown'
        });
      }
      return {
        success: false,
        error: `API Request Setup Error: ${error.message}`,
        model: model || 'unknown'
      };
    }
  }

  _createStructuredPrompt(prompt, formattedContent) {
    if (typeof formattedContent === 'string' && formattedContent.trim().length > 0) {
      return `# INSTRUCTION\n${prompt}\n# EXTRACTED CONTENT\n${formattedContent}`;
    } else {
      return prompt;
    }
  }

  async validateCredentials() {
    try {
      const { apiKey } = this.credentials;
      if (!apiKey) {
        this.logger.warn('No API key provided for validation');
        return false;
      }
      const isValid = await this._validateApiKey(apiKey);
      return isValid;
    } catch (error) {
      this.logger.error('Error validating credentials:', error);
      return false;
    }
  }

  async _validateApiKey(apiKey) {
    try {
      const defaultModel = this.config?.defaultModel;
      if (!defaultModel) {
        this.logger.warn('No default model found in configuration');
        return false;
      }
      return await this._validateWithModel(apiKey, defaultModel);
    } catch (error) {
      this.logger.error('Error validating API key:', error);
      return false;
    }
  }

  async _validateWithModel(apiKey, model) {
    try {
      this.logger.info(`Attempting API key validation for model ${model}...`);
      const fetchOptions = await this._buildValidationRequest(apiKey, model);
      const response = await fetch(fetchOptions.url, {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body,
      });

      if (response.ok) {
        this.logger.info(`API key validation successful for model ${model} (Status: ${response.status})`);
        return true;
      } else {
        const errorMessage = await extractApiErrorMessage(response);
        this.logger.warn(`API key validation failed for model ${model} (Status: ${response.status}): ${errorMessage}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`API key validation error for model ${model}:`, error);
      return false;
    }
  }

  async _buildValidationRequest(apiKey, model) {
    throw new Error('_buildValidationRequest must be implemented by subclasses');
  }

  async _buildApiRequest(prompt, params, apiKey) {
    throw new Error('_buildApiRequest must be implemented by subclasses');
  }

  _parseStreamChunk(line) {
    throw new Error('_parseStreamChunk must be implemented by subclasses');
  }

  _resetStreamState() {
    // Base implementation does nothing. Subclasses can override.
  }

  /**
   * Processes a parsed result from _parseStreamChunk, handling single or multiple chunks.
   * @param {Object} parsedResult - The result from _parseStreamChunk.
   * @param {Function} onChunk - The callback to send data to.
   * @param {string} model - The model being used.
   * @param {string} accumulatedContent - The current accumulated content string (will be updated).
   * @returns {string} The updated accumulatedContent.
   * @private
   */
  _handleParsedChunk(parsedResult, onChunk, model, accumulatedContent) {
    if (parsedResult.type === 'content') {
      if (Array.isArray(parsedResult.chunks)) {
        // <<< NEW: Handle array of chunks
        this.logger.info(`Handling ${parsedResult.chunks.length} sub-chunks from parser.`);
        for (const subChunk of parsedResult.chunks) {
          if (subChunk && subChunk.length > 0) {
            accumulatedContent += subChunk;
            onChunk({ chunk: subChunk, done: false, model });
          }
        }
      } else if (parsedResult.chunk) {
        // Handle single chunk (standard case for other APIs)
        accumulatedContent += parsedResult.chunk;
        onChunk({ chunk: parsedResult.chunk, done: false, model });
      }
    }
    return accumulatedContent;
  }


  async _executeStreamingRequest(fetchOptions, onChunk, abortSignal, model) {
    let reader;
    let accumulatedContent = "";
    const decoder = new TextDecoder("utf-8");
    let buffer = ""; // Buffer for non-Gemini platforms

    if (typeof this._resetStreamState === 'function') {
      this.logger.info(`Resetting stream state for ${this.platformId}`);
      this._resetStreamState();
    }

    try {
      this.logger.info(`Executing streaming request to ${fetchOptions.url} for model ${model}`);
      const response = await fetch(fetchOptions.url, {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body,
        signal: abortSignal
      });

      if (!response.ok) {
        const errorMessage = await extractApiErrorMessage(response);
        this.logger.error(`API Error (${response.status}) for model ${model}: ${errorMessage}`, response);
        onChunk({ done: true, error: errorMessage, model });
        throw new Error(`API request failed with status ${response.status}: ${errorMessage}`);
      }
      if (!response.body) throw new Error('Response body is null or undefined.');

      reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.logger.info(`Stream finished for model ${model}.`);
          // --- Final buffer processing ---
          if (this.platformId === 'gemini') {
              // Final call to Gemini parser for its internal buffer
              try {
                  const parsedResult = this._parseStreamChunk(""); // Process internal buffer
                  accumulatedContent = this._handleParsedChunk(parsedResult, onChunk, model, accumulatedContent); // <<< USE HANDLER
                   if (parsedResult.type === 'error') { // Check for error from final parse
                       onChunk({ done: true, error: parsedResult.error, model });
                       return false;
                   }
              } catch (parseError) {
                   this.logger.error(`Error parsing final Gemini internal buffer chunk for model ${model}:`, parseError);
                   onChunk({ done: true, error: `Error parsing final stream data: ${parseError.message}`, model });
                   return false;
              }
          } else if (buffer.trim()) {
             // Final buffer processing for non-Gemini
             this.logger.warn(`Processing remaining buffer content after stream end for model ${model}: "${buffer}"`);
             try {
                const parsedResult = this._parseStreamChunk(buffer.trim());
                accumulatedContent = this._handleParsedChunk(parsedResult, onChunk, model, accumulatedContent); // <<< USE HANDLER
                if (parsedResult.type === 'error') { // Check for error from final parse
                    onChunk({ done: true, error: parsedResult.error, model });
                    return false;
                }
             } catch (parseError) {
                 this.logger.error(`Error parsing final buffer chunk for model ${model}:`, parseError, 'Buffer:', buffer);
                 onChunk({ done: true, error: `Error parsing final stream data: ${parseError.message}`, model });
                 return false;
             }
          }
          // --- End Final buffer processing ---
          onChunk({ chunk: '', done: true, model, fullContent: accumulatedContent });
          break; // Exit the loop
        }

        const decodedChunk = decoder.decode(value, { stream: true });

        // --- Platform-Specific Handling ---
        if (this.platformId === 'gemini') {
          try {
            const parsedResult = this._parseStreamChunk(decodedChunk); // Pass NEW data
            accumulatedContent = this._handleParsedChunk(parsedResult, onChunk, model, accumulatedContent); // <<< USE HANDLER

            if (parsedResult.type === 'error') {
              this.logger.error(`Parsed stream error (Gemini direct) for model ${model}: ${parsedResult.error}`);
              onChunk({ done: true, error: parsedResult.error, model });
              return false; // Stop processing loop
            }
            // Ignore 'done' and 'ignore' types here, let reader handle stream end
          } catch (parseError) {
            this.logger.error(`Error parsing stream chunk (Gemini direct) for model ${model}:`, parseError, 'Chunk:', decodedChunk);
            onChunk({ done: true, error: `Error parsing stream data: ${parseError.message}`, model });
            return false; // Stop processing loop
          }
        } else {
          // Original logic for other platforms (newline splitting)
          buffer += decodedChunk;
          let lineEnd;
          while ((lineEnd = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, lineEnd).trim();
            buffer = buffer.substring(lineEnd + 1);
            if (!line) continue;

            try {
              const parsedResult = this._parseStreamChunk(line);
              accumulatedContent = this._handleParsedChunk(parsedResult, onChunk, model, accumulatedContent); // <<< USE HANDLER

              if (parsedResult.type === 'error') {
                this.logger.error(`Parsed stream error for model ${model}: ${parsedResult.error}`);
                onChunk({ done: true, error: parsedResult.error, model });
                return false; // Stop processing loop
              }
              // Ignore 'done' and 'ignore' types here
            } catch (parseError) {
              this.logger.error(`Error parsing stream chunk for model ${model}:`, parseError, 'Line:', line);
              onChunk({ done: true, error: `Error parsing stream data: ${parseError.message}`, model });
              return false; // Stop processing loop
            }
          } // end while(lineEnd)
        } // --- End Platform-Specific Handling ---

      } // end while(true)

      return true; // Signal successful completion

    } catch (error) {
      if (error.name === 'AbortError') {
        this.logger.info(`API request cancelled by user for model ${model}.`);
        onChunk({ done: true, error: 'Cancelled by user', model });
      } else {
        this.logger.error(`Unhandled streaming error for model ${model}:`, error);
        onChunk({ done: true, error: error.message || 'An unknown streaming error occurred', model });
      }
      if (error.name !== 'AbortError') {
          throw error; // Propagate unexpected errors
      }
      return false; // Indicate handled error (AbortError)
    } finally {
      if (reader) {
        try {
          await reader.cancel();
          reader.releaseLock();
        } catch (releaseError) {
          this.logger.error(`Error releasing stream reader lock for model ${model}:`, releaseError);
        }
      }
    }
  }

  _createLogger() {
    return {
      info: (message, data = null) => console.log(`[${this.platformId}-api] INFO: ${message}`, data ?? ''),
      warn: (message, data = null) => console.warn(`[${this.platformId}-api] WARN: ${message}`, data ?? ''),
      error: (message, data = null) => console.error(`[${this.platformId}-api] ERROR: ${message}`, data ?? '')
    };
  }
}

module.exports = BaseApiService;
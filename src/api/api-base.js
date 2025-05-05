// src/api/api-base.js
import { extractApiErrorMessage } from '../shared/utils/error-utils.js';
import ConfigService from '../services/ConfigService.js';
import { logger } from '../shared/logger.js';

import ApiInterface from './api-interface.js';

/**
 * Base class with shared API functionality
 */
class BaseApiService extends ApiInterface {
  constructor(platformId) {
    super();
    this.platformId = platformId;
    // Assign the shared logger directlylog
    this.logger = logger.api;
    this.credentials = null;
    this.config = null;
  }

  async initialize(credentials) {
    this.credentials = credentials;
    this.config = await ConfigService.getPlatformApiConfig(this.platformId);
    this.logger.info(`[${this.platformId}] API service initialized`);
  }

  async processRequest(requestConfig) {
    const { prompt, resolvedParams, formattedContent, onChunk, abortSignal } =
      requestConfig;
    const { apiKey } = this.credentials;
    const model = resolvedParams?.model;

    try {
      if (!requestConfig || !resolvedParams || !prompt || !onChunk) {
        throw new Error(`Invalid requestConfig provided`);
      }
      if (!apiKey) {
        throw new Error(`API key not available for ${this.platformId}`);
      }

      const structuredPrompt = this._createStructuredPrompt(
        prompt,
        formattedContent
      );
      this.logger.info(
        `[${this.platformId}] Processing request for model ${model} with${formattedContent ? ' included' : 'out'} content.`
      );
      const fetchOptions = await this._buildApiRequest(
        structuredPrompt,
        resolvedParams,
        apiKey
      );
      const streamSuccess = await this._executeStreamingRequest(
        fetchOptions,
        onChunk,
        abortSignal,
        model
      );

      if (streamSuccess) {
       this.logger.info(
          `[${this.platformId}] Streaming request for model ${model} completed successfully.`
        );
        return { success: true, model: model };
      } else {
        // Error was already handled by onChunk within _executeStreamingRequest
       this.logger.warn(
          `[${this.platformId}] Streaming request for model ${model} failed (error handled via onChunk).`
        );
        // Return a failure object, but the specific error is already in the chat via onChunk.
        return {
          success: false,
          error: 'Streaming failed (see chat for details)',
          model: model || 'unknown',
        };
      }
    } catch (error) {
      // This catch block now primarily handles SETUP errors before the fetch call
      const setupErrorMsg = `Setup Error: ${error.message}`;
      this.logger.error(
        `[${this.platformId}] Error during API request setup for model ${model}:`,
        error
      );
      // Ensure onChunk is only called if it's a valid function
      if (onChunk && typeof onChunk === 'function') {
        onChunk({
          done: true,
          error: setupErrorMsg, // Send the specific setup error
          model: model || 'unknown',
        });
      }
      // Return a failure object indicating a setup error
      return {
        success: false,
        error: setupErrorMsg, // Return the setup error
        model: model || 'unknown',
      };
    }
  }

  _createStructuredPrompt(prompt, formattedContent) {
    if (
      typeof formattedContent === 'string' &&
      formattedContent.trim().length > 0
    ) {
      return `# INSTRUCTION\n${prompt}\n# EXTRACTED CONTENT\n${formattedContent}`;
    } else {
      return prompt;
    }
  }

  async validateCredentials() {
    try {
      const { apiKey } = this.credentials;
      if (!apiKey) {
        this.logger.warn(
          `[${this.platformId}] No API key provided for validation`
        );
        return false;
      }
      const isValid = await this._validateApiKey(apiKey);
      return isValid;
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Error validating credentials:`,
        error
      );
      return false;
    }
  }

  async _validateApiKey(apiKey) {
    try {
      const defaultModel = this.config?.defaultModel;
      if (!defaultModel) {
        this.logger.warn(
          `[${this.platformId}] No default model found in configuration`
        );
        return false;
      }
      return await this._validateWithModel(apiKey, defaultModel);
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] Error validating API key:`,
        error
      );
      return false;
    }
  }

  async _validateWithModel(_apiKey, _model) {
    try {
      this.logger.info(
        `[${this.platformId}] Attempting API key validation for model ${_model}...`
      );
      const fetchOptions = await this._buildValidationRequest(_apiKey, _model);
      const response = await fetch(fetchOptions.url, {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body,
      });

      if (response.ok) {
        this.logger.info(
          `[${this.platformId}] API key validation successful for model ${_model} (Status: ${response.status})`
        );
        return true;
      } else {
        const errorMessage = await extractApiErrorMessage(response);
        this.logger.warn(
          `[${this.platformId}] API key validation failed for model ${_model} (Status: ${response.status}): ${errorMessage}`
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `[${this.platformId}] API key validation error for model ${_model}:`,
        error
      );
      return false;
    }
  }

  async _buildValidationRequest(_apiKey, _model) {
    throw new Error(
      '_buildValidationRequest must be implemented by subclasses'
    );
  }

  async _buildApiRequest(_prompt, _params, _apiKey) {
    throw new Error('_buildApiRequest must be implemented by subclasses');
  }

  _parseStreamChunk(_line) {
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
    if (parsedResult.type === 'thinking') {
      // Handle thinking chunks separately
      if (parsedResult.chunk && parsedResult.chunk.length > 0) {
        onChunk({ thinkingChunk: parsedResult.chunk, done: false, model });
      }
      // Do NOT modify accumulatedContent for thinking chunks
    } else if (parsedResult.type === 'content') {
      // Handle regular content chunks (existing logic)
      if (Array.isArray(parsedResult.chunks)) {
        for (const subChunk of parsedResult.chunks) {
          if (subChunk && subChunk.length > 0) {
            accumulatedContent += subChunk; // Only update for content
            onChunk({ chunk: subChunk, done: false, model });
          }
        }
      } else if (parsedResult.chunk) {
        accumulatedContent += parsedResult.chunk; // Only update for content
        onChunk({ chunk: parsedResult.chunk, done: false, model });
      }
    }
    return accumulatedContent;
  }

  async _executeStreamingRequest(fetchOptions, onChunk, abortSignal, model) {
    let reader;
    let accumulatedContent = '';
    const decoder = new TextDecoder('utf-8');
    let buffer = ''; // Buffer for non-Gemini platforms

    if (typeof this._resetStreamState === 'function') {
      this.logger.info(`[${this.platformId}] Resetting stream state`);
      this._resetStreamState();
    }

    try {
      this.logger.info(
        `[${this.platformId}] Executing streaming request to ${fetchOptions.url} for model ${model}`
      );
      const response = await fetch(fetchOptions.url, {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body,
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorMessage = await extractApiErrorMessage(response);
        this.logger.error(
          `[${this.platformId}] API Error (${response.status}) for model ${model}: ${errorMessage}`,
          response
        );
        onChunk({ done: true, error: errorMessage, model });
        return false; // Indicate failure to the caller
      }
      if (!response.body)
        throw new Error('Response body is null or undefined.');

      reader = response.body.getReader();

        // Disable rule because this is a standard pattern for reading streams
        // until done or an error occurs, with explicit break conditions inside.
        // eslint-disable-next-line no-constant-condition
        while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.logger.info(
            `[${this.platformId}] Stream finished naturally for model ${model}.`
          );
          // Final buffer processing for all platforms
          if (buffer.trim()) {
            this.logger.warn(
              `[${this.platformId}] Processing remaining buffer content after stream end for model ${model}: "${buffer}"`
            );
            try {
              const parsedResult = this._parseStreamChunk(buffer.trim());
              accumulatedContent = this._handleParsedChunk(
                parsedResult,
                onChunk,
                model,
                accumulatedContent
              );
              if (parsedResult.type === 'error') {
                onChunk({ done: true, error: parsedResult.error, model });
                return false;
              }
            } catch (parseError) {
              this.logger.error(
                `[${this.platformId}] Error parsing final buffer chunk for model ${model}:`,
                parseError,
                'Buffer:',
                buffer
              );
              onChunk({
                done: true,
                error: `Error parsing final stream data: ${parseError.message}`,
                model,
              });
              return false;
            }
          }
          onChunk({
            chunk: '',
            done: true,
            model,
            fullContent: accumulatedContent,
          });
          break; // Exit the loop
        }

        const decodedChunk = decoder.decode(value, { stream: true });

        // Standard SSE handling for all platforms
        buffer += decodedChunk;
        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, lineEnd).trim();
          buffer = buffer.substring(lineEnd + 1);
          if (!line) continue;

          try {
            const parsedResult = this._parseStreamChunk(line);
            accumulatedContent = this._handleParsedChunk(
              parsedResult,
              onChunk,
              model,
              accumulatedContent
            );

            if (parsedResult.type === 'error') {
              this.logger.error(
                `[${this.platformId}] Parsed stream error for model ${model}: ${parsedResult.error}`
              );
              onChunk({ done: true, error: parsedResult.error, model });
              return false; // Stop processing loop
            }
            // Ignore 'done' and 'ignore' types here
          } catch (parseError) {
            this.logger.error(
              `[${this.platformId}] Error parsing stream chunk for model ${model}:`,
              parseError,
              'Line:',
              line
            );
            onChunk({
              done: true,
              error: `Error parsing stream data: ${parseError.message}`,
              model,
            });
            return false; // Stop processing loop
          }
        }
      }

      return true; // Signal successful completion
    } catch (error) {
      // Handle AbortError specifically
      if (error.name === 'AbortError') {
        this.logger.info(
          `[${this.platformId}] API request cancelled by user (AbortError) for model ${model}.`
        );
        // Send a specific 'Cancelled by user' message via onChunk
        onChunk({ done: true, error: 'Cancelled by user', model });
        // No need to re-throw AbortError, it's handled.
      } else {
        // Handle other errors during fetch or reading
        const networkOrStreamErrorMsg = `Network/Stream Error: ${error.message || 'An unknown streaming error occurred'}`;
        this.logger.error(
          `[${this.platformId}] Unhandled streaming error for model ${model}:`,
          error
        );
        onChunk({ done: true, error: networkOrStreamErrorMsg, model });
        // Don't re-throw - error is already handled via onChunk
      }
      return false; // Indicate handled error (AbortError) or that an error occurred
    } finally {
      // Cleanup: Attempt to cancel the reader if it exists.
      if (reader) {
        try {
          // Attempt to cancel the reader. This also releases the lock.
          await reader.cancel();
          this.logger.info(
            `[${this.platformId}] Stream reader cancelled successfully for model ${model}.`
          );
        } catch (cancelError) {
          if (cancelError.name === 'AbortError') {
            this.logger.info(
              `[${this.platformId}] Stream reader cancellation failed as expected after abort for model ${model}: ${cancelError.message}`
            );
          } else {
            this.logger.warn(
              `[${this.platformId}] Unexpected error cancelling stream reader for model ${model}:`,
              cancelError
            );
          }
        }
        // No need for releaseLock() as cancel() handles it.
      } else {
        this.logger.info(
          `[${this.platformId}] No active reader found in finally block for model ${model}.`
        );
      }
    }
  }
}

export default BaseApiService;

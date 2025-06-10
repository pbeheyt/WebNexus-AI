// src/background/api/api-coordinator.js ---
import ApiServiceManager from '../../services/ApiServiceManager.js';
import ModelParameterService from '../../services/ModelParameterService.js';
import ContentFormatter from '../../services/ContentFormatter.js';
import { extractContent } from '../services/content-extraction.js';
import {
  determineContentType,
  isInjectablePage,
} from '../../shared/utils/content-utils.js';
import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants.js';
import {
  resetExtractionState,
  initializeStreamResponse,
  getExtractedContent,
  setApiProcessingError,
  completeStreamResponse,
} from '../core/state-manager.js';
import { logger } from '../../shared/logger.js';

const activeAbortControllers = new Map();

/**
 * Handle API model requests
 * @param {string} requestType - Type of request
 * @param {Object} message - Message object
 * @param {Function} sendResponse - Response function
 */
export async function handleApiModelRequest(
  requestType,
  message,
  sendResponse
) {
  try {
    switch (requestType) {
      case 'getApiModels': {
        const platformId = message.platformId;
        if (!platformId) {
          sendResponse({
            success: false,
            error: 'Platform ID is required to get models',
          });
          return true; // Important: return true to indicate async response handled
        }
        const models = await ApiServiceManager.getAvailableModels(platformId);

        sendResponse({
          success: true,
          models,
          platformId,
        });
        break;
      }

      case 'getApiResponse': {
        const result = await chrome.storage.local.get([
          STORAGE_KEYS.API_RESPONSE,
          STORAGE_KEYS.API_PROCESSING_STATUS,
          STORAGE_KEYS.API_RESPONSE_TIMESTAMP,
        ]);

        sendResponse({
          success: true,
          response: result[STORAGE_KEYS.API_RESPONSE] || null,
          status: result[STORAGE_KEYS.API_PROCESSING_STATUS] || 'unknown',
          timestamp: result[STORAGE_KEYS.API_RESPONSE_TIMESTAMP] || null,
        });
        break;
      }

      case 'cancelStream': {
        const { streamId } = message; // Ensure streamId is received
        if (!streamId) {
          logger.background.warn(
            'cancelStream message received without streamId.'
          );
          sendResponse({ success: false, error: 'Missing streamId' });
          break; // Exit case if no streamId
        }
        const controller = activeAbortControllers.get(streamId);
        if (controller) {
          try {
            controller.abort();
            activeAbortControllers.delete(streamId); // Remove immediately after aborting
            logger.background.info(`Abort signal sent for stream: ${streamId}`);
            sendResponse({ success: true });
          } catch (abortError) {
            logger.background.error(
              `Error aborting controller for stream ${streamId}:`,
              abortError
            );
            sendResponse({ success: false, error: 'Failed to abort stream' });
          }
        } else {
          logger.background.warn(
            `No active AbortController found for stream: ${streamId}`
          );
          sendResponse({
            success: false,
            error: 'Stream not found or already completed/cancelled',
          });
        }
        break; // Ensure case exits
      }

      default:
        throw new Error(`Unknown API model request type: ${requestType}`);
    }
  } catch (error) {
    logger.background.error(
      `Error handling API model request (${requestType}):`,
      error
    );
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Process content via API with streaming support
 * @param {Object} params - Parameters for content processing
 * @returns {Promise<Object>} Result information
 */
export async function processContentViaApi(params) {
  const {
    tabId,
    url,
    promptId = null,
    platformId,
    modelId,
    source = INTERFACE_SOURCES.POPUP, // Default to POPUP if source not specified
    customPrompt = null,
    conversationHistory = [],
    isContentExtractionEnabled,
    isThinkingModeEnabled,
  } = params;

  let contentSuccessfullyIncluded = false;

  if (!platformId || !modelId) {
    const missing = [];
    if (!platformId) missing.push('Platform ID');
    if (!modelId) missing.push('Model ID');
    throw new Error(`${missing.join(' and ')} are required for API processing`);
  }

  try {
    logger.background.info(
      `Starting API-based content processing from ${source}`,
      {
        tabId,
        url,
        promptId,
        platformId,
        modelId,
        isContentExtractionEnabled,
      }
    );

    let newlyFormattedContent = null;
    const contentType = determineContentType(url);
    const canInject = isInjectablePage(url);

    // 1. Decide whether to extract content
    // Always re-extract if isContentExtractionEnabled is true and page is injectable
    const shouldExtract = isContentExtractionEnabled && canInject;

    if (isContentExtractionEnabled && !canInject) {
      logger.background.info(
        `Content extraction requested but page is not injectable: ${url}. Skipping extraction.`
      );
    }

    if (shouldExtract) {
      logger.background.info(
        `Extraction enabled and page injectable: Fresh extraction will proceed for tab ${tabId}.`
      );
      await resetExtractionState(); // Reset before fresh extraction
      logger.background.info(`Content type determined: ${contentType}`);
      await extractContent(tabId, url); // Perform fresh extraction
      const extractedContent = await getExtractedContent();

      if (!extractedContent) {
        logger.background.warn(
          `Failed to extract fresh content for tab ${tabId}, proceeding without it.`
        );
        newlyFormattedContent = null;
      } else {
        logger.background.info('Fresh content extraction completed.');
        newlyFormattedContent = ContentFormatter.formatContent(
          extractedContent,
          contentType
        );
        contentSuccessfullyIncluded = true; // Mark content as successfully included for this call
      }
    } else {
      if (!isContentExtractionEnabled) {
        logger.background.info(
          `Extraction skipped for tab ${tabId}: Toggle is OFF.`
        );
      } else if (!canInject) {
        // This case is handled above, but for clarity.
        logger.background.info(
          `Extraction skipped for tab ${tabId}: Page is not injectable (${url}).`
        );
      }
      // No content included, contentSuccessfullyIncluded remains false.
    }

    let promptContent;
    if (customPrompt) {
      promptContent = customPrompt;
    } else {
      throw new Error('No prompt content provided');
    }

    let resolvedParams = await ModelParameterService.resolveParameters(
      platformId,
      modelId,
      {
        tabId,
        source,
        conversationHistory,
        useThinkingMode: isThinkingModeEnabled,
      }
    );
    resolvedParams.conversationHistory = conversationHistory;
    logger.background.info(`Resolved parameters:`, resolvedParams);

    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await initializeStreamResponse(streamId, platformId, resolvedParams.model);

    // `formattedContentForRequest` will be the `newlyFormattedContent` if extraction occurred
    const formattedContentForRequest = newlyFormattedContent;



    if (contentSuccessfullyIncluded) {
      logger.background.info(
        `Content was included in this request for tab ${tabId}.`
      );
    }

    const requestConfig = {
      prompt: promptContent,
      resolvedParams: resolvedParams,
      formattedContent: formattedContentForRequest, // This will be the newly extracted content or null
      streaming: true,
      onChunk: createStreamHandler(
        streamId,
        source,
        tabId,
        platformId,
        resolvedParams
      ),
    };

    const controller = new AbortController();
    activeAbortControllers.set(streamId, controller);
    requestConfig.abortSignal = controller.signal;

    try {
      logger.background.info(
        'Calling ApiServiceManager.processWithUnifiedConfig with config:',
        requestConfig
      );
      const apiResponse = await ApiServiceManager.processWithUnifiedConfig(
        platformId,
        requestConfig
      );

      // Handle pre-stream errors (e.g., missing credentials)
      if (apiResponse.success === false) {
        logger.background.error(
          `Pre-stream error from ApiServiceManager: ${apiResponse.error}`
        );
        // Manually trigger the 'done' chunk with the error to notify the UI
        requestConfig.onChunk({
          done: true,
          error: apiResponse.error,
          model: resolvedParams.model,
        });
        // Return a failure object to the caller
        return {
          success: false,
          error: apiResponse.error,
          streamId,
        };
      }

      return {
        success: true,
        streamId,
        response: apiResponse,
        contentType: contentType,
        contentSuccessfullyIncluded,
        extractedPageContent: contentSuccessfullyIncluded ? formattedContentForRequest : null,
        systemPromptUsed: resolvedParams.systemPrompt || null,
      };
    } catch (processingError) {
      await setApiProcessingError(processingError.message);
      // Construct a return object instead of just throwing
      return {
        success: false,
        error: processingError.message,
        contentSuccessfullyIncluded: false,
        extractedPageContent: null,
        systemPromptUsed: resolvedParams?.systemPrompt || null,
      };
    } finally {
      activeAbortControllers.delete(streamId);
      logger.background.info(`Removed AbortController for stream: ${streamId}`);
    }
  } catch (error) {
    logger.background.error('API content processing error:', error);
    await setApiProcessingError(error.message);
    return {
      success: false,
      error: error.message,
      contentSuccessfullyIncluded: false,
      extractedPageContent: null,
      systemPromptUsed: null,
    };
  }
}

/**
 * Create a stream handler function
 * @param {string} streamId - Stream identifier
 * @param {string} source - Interface source
 * @param {number} tabId - Tab ID for sidepanel integration
 * @param {string} platformId - Platform identifier
 * @param {Object} resolvedParams - Resolved parameters including the model
 * @returns {Function} Chunk handler function
 */
function createStreamHandler(
  streamId,
  source,
  tabId,
  platformId,
  resolvedParams
) {
  let fullContent = '';
  const modelToUse = resolvedParams.model;

  return async function handleChunk(chunkData) {
    if (!chunkData) return;

    const chunk = typeof chunkData.chunk === 'string' ? chunkData.chunk : '';
    const thinkingChunk =
      typeof chunkData.thinkingChunk === 'string'
        ? chunkData.thinkingChunk
        : '';
    const done = !!chunkData.done;

    if (chunkData.model && chunkData.model !== modelToUse) {
      logger.background.warn(
        `Stream chunk reported model ${chunkData.model}, but expected ${modelToUse}`
      );
    }

    if (!done && (chunk || thinkingChunk)) {
      fullContent += chunk; // Only append regular chunk to fullContent for completion

      if (source === INTERFACE_SOURCES.SIDEPANEL && tabId) {
        try {
          const chunkDataPayload = {
            done: false,
            model: modelToUse,
          };
          if (chunk) {
            chunkDataPayload.chunk = chunk;
          }
          if (thinkingChunk) {
            chunkDataPayload.thinkingChunk = thinkingChunk;
          }

          const messagePayload = {
            action: 'streamChunk',
            streamId,
            chunkData: chunkDataPayload,
          };
          chrome.runtime.sendMessage(messagePayload);
        } catch (err) {
          logger.background.warn('Error sending stream chunk:', err);
        }
      }
    }

    if (done) {
      const finalFullContent = chunkData.fullContent || fullContent;
      const finalChunkData = {
        chunk: '', // No more partial chunks
        done: true,
        model: modelToUse,
        fullContent: finalFullContent, // Use the full content from the chunk if available
        thinkingChunk: null, // No more thinking chunks
      };

      if (
        chunkData.error === 'Cancelled by user' ||
        (chunkData.error instanceof Error &&
          chunkData.error.name === 'AbortError')
      ) {
        logger.background.info(
          `Stream ${streamId} cancelled by user. Processing partial content.`
        );
        // Use the content accumulated so far
        await completeStreamResponse(finalFullContent, modelToUse, platformId);
        finalChunkData.cancelled = true;
      } else if (chunkData.error) {
        const errorMessage = chunkData.error;
        logger.background.error(`Stream ended with error: ${errorMessage}`);
        await setApiProcessingError(errorMessage);
        // Use the content accumulated so far, plus the error
        await completeStreamResponse(
          finalFullContent,
          modelToUse,
          platformId,
          errorMessage
        );
        finalChunkData.error = errorMessage;
      } else {
        logger.background.info(`Stream ${streamId} completed successfully.`);
        await completeStreamResponse(finalFullContent, modelToUse, platformId);
      }

      if (source === INTERFACE_SOURCES.SIDEPANEL && tabId) {
        try {
          const finalMessagePayload = {
            action: 'streamChunk',
            streamId,
            chunkData: finalChunkData,
          };
          chrome.runtime.sendMessage(finalMessagePayload);
        } catch (err) {
          logger.background.warn(
            'Error sending stream completion/error message:',
            err
          );
        }
      }
    }
  };
}

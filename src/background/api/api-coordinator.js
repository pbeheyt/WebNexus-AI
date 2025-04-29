// src/background/api/api-coordinator.js - API model request handling

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
  hasFormattedContentForTab,
  storeFormattedContentForTab,
  getFormattedContentForTab,
  storeSystemPromptForTab,
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
      case 'checkApiModeAvailable': {
        const platformId =
          message.platformId || (await getPreferredAiPlatform());
        const isAvailable =
          await ApiServiceManager.isApiModeAvailable(platformId);

        sendResponse({
          success: true,
          isAvailable,
          platformId,
        });
        break;
      }

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
    source = INTERFACE_SOURCES.POPUP,
    customPrompt = null,
    // streaming = false, // Note: streaming is forced to true later (Keep this comment or remove if desired)
    conversationHistory = [],
    isContentExtractionEnabled, // <-- ADD THIS
    // Remove skipInitialExtraction parameter if present (It wasn't here, but ensuring it's not added)
    preTruncationCost,
    preTruncationOutput,
  } = params;

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
      }
    );

    let extractedContent = null;
    let newlyFormattedContent = null; // To hold content formatted in this run
    const contentType = determineContentType(url);
    const skipExtractionRequested = params.skipInitialExtraction === true;
    const isFirstUserMessage = conversationHistory.length === 0;
    logger.background.info(
      `Is this the first user message (history empty)? ${isFirstUserMessage}`
    );

    // 1. Decide whether to extract content based on existence, user request, and message history
    const initialFormattedContentExists =
      await hasFormattedContentForTab(tabId);
    // Extraction depends on toggle state, content existence, and injectability.
    const canInject = isInjectablePage(url); // Check if page allows injection
    // NEW:
    const shouldExtract =
      isContentExtractionEnabled && !initialFormattedContentExists && canInject;

    // Log if extraction is skipped specifically due to non-injectable URL (even if toggle is on)
    if (
      isContentExtractionEnabled &&
      !initialFormattedContentExists &&
      !canInject
    ) {
      logger.background.info(
        `First message: Skipping extraction for tab ${tabId} because URL (${url}) is not injectable.`
      );
      // Return immediately indicating context was skipped, preventing further processing for this message
      return {
        success: true, // The operation itself didn't fail, it just skipped context
        skippedContext: true,
        reason: 'Content extraction not supported on this page type.',
        contentType: contentType, // Pass content type back if needed by UI
      };
    }

    // Example log update:
    if (shouldExtract) {
      logger.background.info(
        `Extraction enabled and content needed: Extraction will proceed for tab ${tabId} (injectable: ${canInject}, exists: ${initialFormattedContentExists}).`
      );
      // Reset previous extraction state (ensure this happens ONLY if extracting)
      await resetExtractionState();

      // Extract content
      logger.background.info(`Content type determined: ${contentType}`);
      await extractContent(tabId, url); // url should be available here
      extractedContent = await getExtractedContent(); // Assign to the outer scope variable

      if (!extractedContent) {
        logger.background.warn(
          `Failed to extract content for tab ${tabId}, proceeding without it.`
        );
        newlyFormattedContent = null; // Ensure null if extraction failed
      } else {
        logger.background.info('Content extraction completed.');
        // Format and Store Content
        logger.background.info(
          `Formatting extracted content (type: ${contentType})...`
        );
        newlyFormattedContent = ContentFormatter.formatContent(
          extractedContent,
          contentType
        );
        await storeFormattedContentForTab(tabId, newlyFormattedContent);
        logger.background.info(
          `Formatted and stored content for tab ${tabId}.`
        );
      }
      // Ensure these are null if extraction happened but failed
      if (!newlyFormattedContent) {
        extractedContent = null;
      }
    } else {
      // Log the reason why extraction was skipped based on the new logic
      if (!isContentExtractionEnabled) {
        logger.background.info(
          `Extraction skipped for tab ${tabId}: Toggle is OFF.`
        );
      } else if (initialFormattedContentExists) {
        logger.background.info(
          `Extraction skipped for tab ${tabId}: Formatted content already exists.`
        );
      } else if (!canInject) {
        logger.background.info(
          `Extraction skipped for tab ${tabId}: Page is not injectable (${url}).`
        );
      } else {
        logger.background.warn(
          `Extraction skipped for tab ${tabId} for unknown reason. Conditions: enabled=${isContentExtractionEnabled}, exists=${initialFormattedContentExists}, canInject=${canInject}`
        );
      }
      // Ensure these are null if extraction didn't happen
      extractedContent = null;
      newlyFormattedContent = null;
    }

    // 4. Get the prompt
    let promptContent;

    if (customPrompt) {
      promptContent = customPrompt;
    } else {
      throw new Error('No prompt content provided');
    }

    // 5. Parameter Resolution (Centralized) - Use platformId and modelId from params
    logger.background.info(
      `Resolving parameters for platform: ${platformId}, model: ${modelId}`
    );
    let resolvedParams = await ModelParameterService.resolveParameters(
      platformId,
      modelId,
      { tabId, source, conversationHistory }
    );
    resolvedParams.conversationHistory = conversationHistory;
    logger.background.info(`Resolved parameters:`, resolvedParams);

    // 6. Generate a unique stream ID for this request
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 7. Initialize streaming response (using platformId from params)
    await initializeStreamResponse(streamId, platformId, resolvedParams.model); // Include model

    // 8. Determine the formatted content to include in the request based on the toggle state and content availability
    // --- Start Replacement ---
    let formattedContentForRequest = null;

    if (!isContentExtractionEnabled) {
      logger.background.info(`Content inclusion skipped: Toggle is OFF.`);
      formattedContentForRequest = null;
    } else {
      // Toggle is ON, check if content is available
      if (shouldExtract && newlyFormattedContent) {
        // Extraction happened now and succeeded
        formattedContentForRequest = newlyFormattedContent;
        logger.background.info(
          `Including newly extracted/formatted content for tab ${tabId}.`
        );
      } else if (initialFormattedContentExists) {
        // Content existed before this run
        formattedContentForRequest = await getFormattedContentForTab(tabId);
        logger.background.info(
          `Including pre-existing formatted content for tab ${tabId}.`
        );
      } else {
        // Toggle ON, but no content available (extraction didn't run, failed, or page not injectable)
        logger.background.info(
          `Content inclusion skipped: Toggle is ON, but no content available for tab ${tabId}.`
        );
        formattedContentForRequest = null;
      }
    }
    // --- End Replacement ---

    if (tabId) {
      try {
        const promptToStoreOrClear = resolvedParams.systemPrompt;
        logger.background.info(
          `Updating system prompt state for tab ${tabId}. Prompt is ${promptToStoreOrClear ? 'present' : 'absent/empty'}.`
        );
        await storeSystemPromptForTab(tabId, promptToStoreOrClear);
      } catch (storeError) {
        logger.background.error(
          `Failed to update system prompt state for tab ${tabId}:`,
          storeError
        );
      }
    }

    // 10. Create unified request configuration
    const requestConfig = {
      prompt: promptContent,
      resolvedParams: resolvedParams, // Pass the whole resolved params object ( includes history)
      formattedContent: formattedContentForRequest, // Pass the formatted content string or null
      streaming: true, // Always true for this function
      onChunk: createStreamHandler(
        streamId,
        source,
        tabId,
        platformId,
        resolvedParams
      ),
    };

    // 11. Process with API (using platformId from params)
    const controller = new AbortController();
    activeAbortControllers.set(streamId, controller);
    requestConfig.abortSignal = controller.signal; // Add signal to request config

    try {
      logger.background.info(
        'Calling ApiServiceManager.processWithUnifiedConfig with config:',
        requestConfig
      );
      // Pass platformId from params directly
      const apiResponse = await ApiServiceManager.processWithUnifiedConfig(
        platformId,
        requestConfig
      );

      // If we get here without an error, streaming completed successfully
      return {
        success: true,
        streamId,
        response: apiResponse,
        contentType: contentType, // Use the variable determined earlier
      };
    } catch (processingError) {
      // Handle API processing errors
      await setApiProcessingError(processingError.message);
      throw processingError; // Re-throw to be caught by the outer catch
    } finally {
      activeAbortControllers.delete(streamId);
      logger.background.info(`Removed AbortController for stream: ${streamId}`);
    }
  } catch (error) {
    // This outer catch handles errors from setup (extraction, param resolution) AND re-thrown processing errors
    logger.background.error('API content processing error:', error);
    await setApiProcessingError(error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Create a stream handler function
 * @param {string} streamId - Stream identifier
 * @param {string} source - Interface source
 * @param {number} tabId - Tab ID for sidebar integration
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
  // Use the resolved model from the start
  const modelToUse = resolvedParams.model;

  return async function handleChunk(chunkData) {
    if (!chunkData) return;

    const chunk = typeof chunkData.chunk === 'string' ? chunkData.chunk : '';
    const done = !!chunkData.done;

    // Model should be consistent, but log if chunkData provides a different one
    if (chunkData.model && chunkData.model !== modelToUse) {
      logger.background.warn(
        `Stream chunk reported model ${chunkData.model}, but expected ${modelToUse}`
      );
    }

    if (chunk) {
      fullContent += chunk;

      // Send to content script for sidebar
      if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
        try {
          // Use runtime API for sidebar communication
          chrome.runtime.sendMessage({
            action: 'streamChunk',
            streamId,
            chunkData: {
              chunk,
              done: false,
              model: modelToUse,
            },
          });
        } catch (err) {
          logger.background.warn('Error sending stream chunk:', err);
        }
      }
    }

    // Handle stream completion or error
    if (done) {
      const finalChunkData = {
        chunk: '',
        done: true,
        model: modelToUse,
        fullContent: chunkData.fullContent || fullContent,
      };

      // Check for user cancellation first
      if (
        chunkData.error === 'Cancelled by user' ||
        (chunkData.error instanceof Error &&
          chunkData.error.name === 'AbortError')
      ) {
        logger.background.info(
          `Stream ${streamId} cancelled by user. Processing partial content.`
        );
        // Complete successfully to save partial state, but mark as cancelled for UI
        await completeStreamResponse(fullContent, modelToUse, platformId); // No error passed
        finalChunkData.cancelled = true; // Add cancellation flag
        // Do NOT add finalChunkData.error
      } else if (chunkData.error) {
        // Handle other errors
        // chunkData.error should now be the pre-formatted string from extractApiErrorMessage
        const errorMessage = chunkData.error;
        logger.background.error(`Stream ended with error: ${errorMessage}`);
        await setApiProcessingError(errorMessage);
        // Pass modelToUse and error to completeStreamResponse
        await completeStreamResponse(
          fullContent,
          modelToUse,
          platformId,
          errorMessage
        );
        finalChunkData.error = errorMessage;
      } else {
        // Handle successful completion
        logger.background.info(`Stream ${streamId} completed successfully.`);
        // Pass modelToUse to completeStreamResponse
        await completeStreamResponse(fullContent, modelToUse, platformId);
      }

      // Ensure the final message (success, error, or cancelled) is sent for sidebar
      if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
        try {
          // Use runtime API for sidebar communication
          chrome.runtime.sendMessage({
            action: 'streamChunk',
            streamId,
            chunkData: finalChunkData,
          });
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

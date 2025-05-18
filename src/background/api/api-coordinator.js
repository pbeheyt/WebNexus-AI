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
import SidePanelStateManager from '../../services/SidePanelStateManager.js';
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
    // logger.background.info(
    //   `Is this the first user message (history empty)? ${isFirstUserMessage}`
    // );

    // 1. Decide whether to extract content based on existence, user request, and injectability
    const initialFormattedContentExists = await SidePanelStateManager.hasFormattedContentForTab(tabId);
    const canInject = isInjectablePage(url);
    const shouldExtract =
      isContentExtractionEnabled && !initialFormattedContentExists && canInject;

    if (
      isContentExtractionEnabled &&
      !initialFormattedContentExists &&
      !canInject
    ) {
      logger.background.info(
        `First message: Skipping extraction for tab ${tabId} because URL (${url}) is not injectable.`
      );
      return {
        success: true,
        skippedContext: true,
        reason: 'Content extraction not supported on this page type.',
        contentType: contentType,
      };
    }

    if (shouldExtract) {
      logger.background.info(
        `Extraction enabled and content needed: Extraction will proceed for tab ${tabId} (injectable: ${canInject}, exists: ${initialFormattedContentExists}).`
      );
      await resetExtractionState();
      logger.background.info(`Content type determined: ${contentType}`);
      await extractContent(tabId, url);
      extractedContent = await getExtractedContent();

      if (!extractedContent) {
        logger.background.warn(
          `Failed to extract content for tab ${tabId}, proceeding without it.`
        );
        newlyFormattedContent = null;
      } else {
        logger.background.info('Content extraction completed.');
        newlyFormattedContent = ContentFormatter.formatContent(
          extractedContent,
          contentType
        );
        await SidePanelStateManager.storeFormattedContentForTab(tabId, newlyFormattedContent);
        logger.background.info(
          `Formatted and stored content for tab ${tabId}.`
        );
      }
      if (!newlyFormattedContent) {
        extractedContent = null;
      }
    } else {
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
      }
      extractedContent = null;
      newlyFormattedContent = null;
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
      { tabId, source, conversationHistory, useThinkingMode: isThinkingModeEnabled }
    );
    resolvedParams.conversationHistory = conversationHistory;
    logger.background.info(`Resolved parameters:`, resolvedParams);

    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await initializeStreamResponse(streamId, platformId, resolvedParams.model);

    let formattedContentForRequest = null;
    const contextAlreadySent = await SidePanelStateManager.getTabContextSentFlag(tabId);

    if (!isContentExtractionEnabled) {
      logger.background.info(`Content inclusion skipped: Toggle is OFF.`);
    } else if (contextAlreadySent) {
      logger.background.info(
        `Content inclusion skipped: Context already sent for tab ${tabId}.`
      );
    } else {
      if (shouldExtract && newlyFormattedContent) {
        formattedContentForRequest = newlyFormattedContent;
        logger.background.info(
          `Including newly extracted/formatted content for tab ${tabId}.`
        );
      } else if (initialFormattedContentExists) {
        formattedContentForRequest = await SidePanelStateManager.getFormattedContentForTab(tabId);
        logger.background.info(
          `Including pre-existing formatted content for tab ${tabId}.`
        );
      } else {
        logger.background.info(
          `Content inclusion skipped: Toggle is ON, but no content available for tab ${tabId}.`
        );
      }
    }

    if (tabId) {
      try {
        const promptToStoreOrClear = resolvedParams.systemPrompt;
        logger.background.info(
          `Updating system prompt state for tab ${tabId}. Prompt is ${promptToStoreOrClear ? 'present' : 'absent/empty'}.`
        );
        await SidePanelStateManager.storeSystemPromptForTab(tabId, promptToStoreOrClear);
      } catch (storeError) {
        logger.background.error(
          `Failed to update system prompt state for tab ${tabId}:`,
          storeError
        );
      }
    }

    if (formattedContentForRequest !== null) {
      await SidePanelStateManager.setTabContextSentFlag(tabId, true);
      logger.background.info(`Context included in this request. Set context sent flag for tab ${tabId}.`);
    }

    const requestConfig = {
      prompt: promptContent,
      resolvedParams: resolvedParams,
      formattedContent: formattedContentForRequest,
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

      return {
        success: true,
        streamId,
        response: apiResponse,
        contentType: contentType,
      };
    } catch (processingError) {
      await setApiProcessingError(processingError.message);
      throw processingError;
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
    const thinkingChunk = typeof chunkData.thinkingChunk === 'string' ? chunkData.thinkingChunk : '';
    const done = !!chunkData.done;

    if (chunkData.model && chunkData.model !== modelToUse) {
      logger.background.warn(
        `Stream chunk reported model ${chunkData.model}, but expected ${modelToUse}`
      );
    }

    if (!done && (chunk || thinkingChunk)) {
      fullContent += chunk;

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
      const finalChunkData = {
        chunk: '',
        done: true,
        model: modelToUse,
        fullContent: chunkData.fullContent || fullContent,
        thinkingChunk: null,
      };

      if (
        chunkData.error === 'Cancelled by user' ||
        (chunkData.error instanceof Error &&
          chunkData.error.name === 'AbortError')
      ) {
        logger.background.info(
          `Stream ${streamId} cancelled by user. Processing partial content.`
        );
        await completeStreamResponse(fullContent, modelToUse, platformId);
        finalChunkData.cancelled = true;
      } else if (chunkData.error) {
        const errorMessage = chunkData.error;
        logger.background.error(`Stream ended with error: ${errorMessage}`);
        await setApiProcessingError(errorMessage);
        await completeStreamResponse(
          fullContent,
          modelToUse,
          platformId,
          errorMessage
        );
        finalChunkData.error = errorMessage;
      } else {
        logger.background.info(`Stream ${streamId} completed successfully.`);
        await completeStreamResponse(fullContent, modelToUse, platformId);
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

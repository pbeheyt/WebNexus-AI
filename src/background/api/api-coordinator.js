// src/background/api/api-coordinator.js - API model request handling

import ApiServiceManager from '../../services/ApiServiceManager.js';
import ModelParameterService from '../../services/ModelParameterService.js';
import ContentFormatter from '../../services/ContentFormatter.js';
import { extractContent } from '../services/content-extraction.js';
import { determineContentType, isInjectablePage } from '../../shared/utils/content-utils.js';
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
  storeSystemPromptForTab
} from '../core/state-manager.js';
import logger from '../../shared/logger.js';

const activeAbortControllers = new Map();

/**
 * Handle API model requests
 * @param {string} requestType - Type of request
 * @param {Object} message - Message object
 * @param {Function} sendResponse - Response function
 */
export async function handleApiModelRequest(requestType, message, sendResponse) {
  try {
    switch (requestType) {
      case 'checkApiModeAvailable': {
        const platformId = message.platformId || await getPreferredAiPlatform();
        const isAvailable = await ApiServiceManager.isApiModeAvailable(platformId);

        sendResponse({
          success: true,
          isAvailable,
          platformId
        });
        break;
      }

      case 'getApiModels': {
        const platformId = message.platformId;
        if (!platformId) {
          sendResponse({ success: false, error: 'Platform ID is required to get models' });
          return true; // Important: return true to indicate async response handled
        }
        const models = await ApiServiceManager.getAvailableModels(platformId);

        sendResponse({
          success: true,
          models,
          platformId
        });
        break;
      }

      case 'getApiResponse': {
        const result = await chrome.storage.local.get([
          STORAGE_KEYS.API_RESPONSE, 
          STORAGE_KEYS.API_PROCESSING_STATUS, 
          STORAGE_KEYS.API_RESPONSE_TIMESTAMP
        ]);
        
        sendResponse({
          success: true,
          response: result[STORAGE_KEYS.API_RESPONSE] || null,
          status: result[STORAGE_KEYS.API_PROCESSING_STATUS] || 'unknown',
          timestamp: result[STORAGE_KEYS.API_RESPONSE_TIMESTAMP] || null
        });
        break;
      }

      case 'cancelStream': {
            const { streamId } = message; // Ensure streamId is received
            if (!streamId) {
              logger.background.warn('cancelStream message received without streamId.');
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
                logger.background.error(`Error aborting controller for stream ${streamId}:`, abortError);
                sendResponse({ success: false, error: 'Failed to abort stream' });
              }
            } else {
              logger.background.warn(`No active AbortController found for stream: ${streamId}`);
              sendResponse({ success: false, error: 'Stream not found or already completed/cancelled' });
            }
            break; // Ensure case exits
          }

      default:
        throw new Error(`Unknown API model request type: ${requestType}`);
    }
  } catch (error) {
    logger.background.error(`Error handling API model request (${requestType}):`, error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Process content via API with streaming support
 * @param {Object} params - Parameters for content processing
 * @returns {Promise<Object>} Result information (initial setup result)
 */
export async function processContentViaApi(params) {
  let streamId; // Declare streamId in the outer scope

  const {
    tabId,
    url,
    promptId = null,
    platformId,
    modelId,
    source = INTERFACE_SOURCES.POPUP,
    customPrompt = null,
    streaming = false, // Note: streaming is forced to true later
    conversationHistory = []
  } = params;

  // Outer try-catch for setup errors
  try {
    // --- Start of Synchronous Setup ---
    if (!platformId || !modelId) {
      const missing = [];
      if (!platformId) missing.push('Platform ID');
      if (!modelId) missing.push('Model ID');
      throw new Error(`${missing.join(' and ')} are required for API processing`);
    }

    logger.background.info(`Starting API-based content processing setup from ${source}`, {
      tabId, url, promptId, platformId, modelId, streaming
    });

    const contentType = determineContentType(url);
    const isPageInjectable = isInjectablePage(url); // Determine injectability early
    const isFirstUserMessage = conversationHistory.length === 0;
    const skipInitialExtractionRequested = params.skipInitialExtraction === true;

    // Parameter Resolution (Centralized)
    logger.background.info(`Resolving parameters for platform: ${platformId}, model: ${modelId}`);
    let resolvedParams = await ModelParameterService.resolveParameters(
      platformId,
      modelId,
      { tabId, source, conversationHistory } // Pass necessary context
    );
    resolvedParams.conversationHistory = conversationHistory; // Ensure history is attached
    logger.background.info(`Resolved parameters:`, resolvedParams);

    // Generate a unique stream ID for this request
    streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Initialize streaming response state
    await initializeStreamResponse(streamId, platformId, resolvedParams.model);

    // Store system prompt state if applicable
    if (tabId && resolvedParams.systemPrompt) {
      try {
        logger.background.info(`Updating system prompt state for tab ${tabId}.`);
        await storeSystemPromptForTab(tabId, resolvedParams.systemPrompt);
      } catch (storeError) {
        logger.background.error(`Failed to update system prompt state for tab ${tabId}:`, storeError);
        // Decide if this is fatal or just a warning
      }
    } else if (tabId) {
        // Clear if no system prompt resolved
        await storeSystemPromptForTab(tabId, null);
    }

    // Notify the content script about streaming start (only if injectable and from sidebar)
    if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
      if (isPageInjectable) {
        try {
          // Use runtime.sendMessage for sidebar communication
          chrome.runtime.sendMessage({
            action: 'streamStart',
            streamId,
            platformId: platformId,
            model: resolvedParams.model
          });
          logger.background.info(`Sent streamStart notification via runtime API for stream ${streamId}.`);
        } catch (err) {
          // Log errors but don't necessarily stop the process
          logger.background.error(`Error sending streamStart notification via runtime API for stream ${streamId}:`, err);
        }
      } else {
        logger.background.info(`Skipped sending streamStart notification for stream ${streamId} (tab ${tabId}, URL: ${url}) as page is not injectable.`);
      }
    }

    // Calculate skippedContext flag
    const skippedContext = isFirstUserMessage && !isPageInjectable;
    const skipReason = skippedContext ? 'Content extraction not supported on this page type.' : undefined;

    // --- End of Synchronous Setup ---

    // Define the asynchronous API call function
    async function startApiCall() {
      try {
        logger.background.info(`Starting asynchronous API call for stream: ${streamId}`);
        let extractedContent = null;
        let newlyFormattedContent = null;
        let formattedContentForRequest = null;

        // 1. Content Extraction/Formatting Logic (moved inside async function)
        const initialFormattedContentExists = await hasFormattedContentForTab(tabId);
        // Extraction only happens on the first message, if not skipped, if content doesn't already exist, and if page is injectable.
        const shouldExtract = isFirstUserMessage && !initialFormattedContentExists && !skipInitialExtractionRequested && isPageInjectable;

        if (shouldExtract) {
            logger.background.info(`Stream ${streamId}: First message, extraction will proceed for tab ${tabId}.`);
            await resetExtractionState(); // Reset only if extracting
            await extractContent(tabId, url);
            extractedContent = await getExtractedContent();

            if (!extractedContent) {
                logger.background.warn(`Stream ${streamId}: Failed to extract content for tab ${tabId}, proceeding without it.`);
                newlyFormattedContent = null;
            } else {
                logger.background.info(`Stream ${streamId}: Content extraction completed.`);
                newlyFormattedContent = ContentFormatter.formatContent(extractedContent, contentType);
                await storeFormattedContentForTab(tabId, newlyFormattedContent);
                logger.background.info(`Stream ${streamId}: Formatted and stored content for tab ${tabId}.`);
            }
            if (!newlyFormattedContent) extractedContent = null; // Ensure consistency
        } else {
            // Log reasons for skipping extraction (similar to original logic)
            if (!isFirstUserMessage) logger.background.info(`Stream ${streamId}: Not first message, skipping extraction.`);
            else if (skipInitialExtractionRequested) logger.background.info(`Stream ${streamId}: Extraction skipped by user request.`);
            else if (initialFormattedContentExists) logger.background.info(`Stream ${streamId}: Formatted content already exists.`);
            else if (!isPageInjectable) logger.background.info(`Stream ${streamId}: Page not injectable, extraction skipped.`);
            else logger.background.warn(`Stream ${streamId}: Extraction skipped for unknown reason.`);
            extractedContent = null;
            newlyFormattedContent = null;
        }

        // Determine the formatted content to include in the request
        if (isFirstUserMessage) {
            if (!skipInitialExtractionRequested && isPageInjectable) { // Check injectability again here
                if (shouldExtract && newlyFormattedContent) {
                    formattedContentForRequest = newlyFormattedContent;
                    logger.background.info(`Stream ${streamId}: Using newly extracted/formatted content.`);
                } else if (initialFormattedContentExists) {
                    formattedContentForRequest = await getFormattedContentForTab(tabId);
                    logger.background.info(`Stream ${streamId}: Using pre-existing formatted content.`);
                } else {
                    logger.background.info(`Stream ${streamId}: No content available (extraction allowed but failed, or content didn't exist).`);
                }
            } else if (skipInitialExtractionRequested) {
                logger.background.info(`Stream ${streamId}: Extraction skipped by user request. No content included.`);
            } else { // Case: !isPageInjectable
                 logger.background.info(`Stream ${streamId}: Page not injectable. No content included.`);
            }
        } else {
            logger.background.info(`Stream ${streamId}: Not the first user message. Skipping content inclusion.`);
        }

        // Get the prompt content
        let promptContent;
        if (customPrompt) {
          promptContent = customPrompt;
        } else {
          // This should ideally not happen if validation is done earlier, but handle defensively
          throw new Error(`Stream ${streamId}: No prompt content provided for API call.`);
        }

        // Create unified request configuration
        const requestConfig = {
          prompt: promptContent,
          resolvedParams: resolvedParams, // Includes history
          formattedContent: formattedContentForRequest,
          streaming: true,
          onChunk: createStreamHandler(streamId, source, tabId, platformId, resolvedParams) // Pass streamId
        };

        // Process with API
        const controller = new AbortController();
        activeAbortControllers.set(streamId, controller);
        requestConfig.abortSignal = controller.signal;

        logger.background.info(`Stream ${streamId}: Calling ApiServiceManager.processWithUnifiedConfig`);
        await ApiServiceManager.processWithUnifiedConfig(
          platformId,
          requestConfig
        );
        // Success is handled by the stream handler sending done: true without error

      } catch (processingError) {
        // Handle API processing errors specifically within the async call
        logger.background.error(`Stream ${streamId}: API processing error inside startApiCall:`, processingError);
        // Use the stream handler to report the error
        const streamHandler = createStreamHandler(streamId, source, tabId, platformId, resolvedParams);
        streamHandler({ done: true, error: processingError.message || 'An unknown error occurred during API processing.' });
        // No need to call setApiProcessingError here, stream handler does it
      } finally {
        // Ensure controller is removed even if errors occur during the API call
        activeAbortControllers.delete(streamId);
        logger.background.info(`Stream ${streamId}: Removed AbortController in startApiCall finally block.`);
      }
    }

    // --- Initiate the Asynchronous API Call (Fire and Forget) ---
    startApiCall(); // Call without await

    // --- Return Initial Success Response Immediately ---
    logger.background.info(`Stream ${streamId}: Setup complete. Returning initial response.`);
    return {
      success: true,
      streamId,
      contentType: contentType,
      skippedContext: skippedContext,
      reason: skipReason
    };

  } catch (setupError) {
    // This outer catch handles errors ONLY from the synchronous setup phase
    logger.background.error('API content processing setup error:', setupError);
    // If streamId was generated before error, try to report error via stream state if possible
    if (streamId) {
        try {
            await setApiProcessingError(setupError.message);
            // Optionally, try to send an error chunk if handler can be created, though risky
             const streamHandler = createStreamHandler(streamId, source, tabId, platformId, {}); // May need dummy params
             streamHandler({ done: true, error: setupError.message });
        } catch (reportError) {
            logger.background.error('Failed to report setup error via stream state:', reportError);
        }
    }
    return {
      success: false,
      error: setupError.message // Return setup error details
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
function createStreamHandler(streamId, source, tabId, platformId, resolvedParams) {
  let fullContent = '';
  // Use the resolved model from the start
  const modelToUse = resolvedParams.model;

  return async function handleChunk(chunkData) {
    if (!chunkData) return;

    const chunk = typeof chunkData.chunk === 'string' ? chunkData.chunk : '';
    const done = !!chunkData.done;

    // Model should be consistent, but log if chunkData provides a different one
    if (chunkData.model && chunkData.model !== modelToUse) {
       logger.background.warn(`Stream chunk reported model ${chunkData.model}, but expected ${modelToUse}`);
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
              model: modelToUse
            }
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
        fullContent: chunkData.fullContent || fullContent
      };

      // Check for user cancellation first
      if (chunkData.error === 'Cancelled by user' || (chunkData.error instanceof Error && chunkData.error.name === 'AbortError')) {
        logger.background.info(`Stream ${streamId} cancelled by user. Processing partial content.`);
        // Complete successfully to save partial state, but mark as cancelled for UI
        await completeStreamResponse(fullContent, modelToUse, platformId); // No error passed
        finalChunkData.cancelled = true; // Add cancellation flag
        // Do NOT add finalChunkData.error
      } else if (chunkData.error) { // Handle other errors
        // chunkData.error should now be the pre-formatted string from extractApiErrorMessage
        const errorMessage = chunkData.error; 
        logger.background.error(`Stream ended with error: ${errorMessage}`);
        await setApiProcessingError(errorMessage);
        // Pass modelToUse and error to completeStreamResponse
        await completeStreamResponse(fullContent, modelToUse, platformId, errorMessage);
        finalChunkData.error = errorMessage;
      } else { // Handle successful completion
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
            chunkData: finalChunkData
          });
        } catch (err) {
          logger.background.warn('Error sending stream completion/error message:', err);
        }
      }
    }
  };
}

// src/background/api/api-coordinator.js

import ApiServiceManager from '../../services/ApiServiceManager.js';
import ModelParameterService from '../../services/ModelParameterService.js';
import ContentFormatter from '../../services/ContentFormatter.js';
import { extractContent } from '../services/content-extraction.js';
// Removed: import { getPreferredAiPlatform } from '../services/platform-integration.js';
// Removed: import { verifyApiCredentials } from '../services/credential-manager.js';
import { determineContentType, isInjectablePage } from '../../shared/utils/content-utils.js';
import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants.js';
import { 
  resetExtractionState, 
  updateApiProcessingStatus, 
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
        // Removed fallback: const platformId = message.platformId || await getPreferredAiPlatform();
        const platformId = message.platformId;
        // Add check for platformId
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
 * @returns {Promise<Object>} Result information
 */
export async function processContentViaApi(params) {
  // Destructure platformId and modelId directly and add checks
  const {
    tabId,
    url,
    promptId = null,
    platformId, // No longer optional or defaulted
    modelId,    // No longer optional or defaulted
    source = INTERFACE_SOURCES.POPUP,
    customPrompt = null,
    streaming = false, // Note: streaming is forced to true later
    conversationHistory = []
  } = params;

  // Add check for required platformId and modelId
  if (!platformId || !modelId) {
    const missing = [];
    if (!platformId) missing.push('Platform ID');
    if (!modelId) missing.push('Model ID');
    throw new Error(`${missing.join(' and ')} are required for API processing`);
  }

  try {
    logger.background.info(`Starting API-based content processing from ${source}`, {
      tabId, url, promptId, platformId, modelId, streaming // Log modelId too
    });

    let extractedContent = null;
    let newlyFormattedContent = null; // To hold content formatted in this run
    const contentType = determineContentType(url);
    const skipExtractionRequested = params.skipInitialExtraction === true; // Retrieve the flag
    const isFirstUserMessage = conversationHistory.length === 0; // Calculate earlier
    logger.background.info(`Is this the first user message (history empty)? ${isFirstUserMessage}`);

    // 1. Decide whether to extract content based on existence, user request, and message history
    const initialFormattedContentExists = await hasFormattedContentForTab(tabId);
    // Extraction only happens on the first message, if not skipped, if content doesn't already exist, and if page is injectable.
    const canInject = isInjectablePage(url); // Check if page allows injection
    const shouldExtract = isFirstUserMessage && !initialFormattedContentExists && !skipExtractionRequested && canInject;

    // Log if extraction is skipped specifically due to non-injectable URL on first message
    if (isFirstUserMessage && !initialFormattedContentExists && !skipExtractionRequested && !canInject) {
        logger.background.info(`First message: Skipping extraction for tab ${tabId} because URL (${url}) is not injectable.`);
        // Return immediately indicating context was skipped, preventing further processing for this message
        return {
          success: true, // The operation itself didn't fail, it just skipped context
          skippedContext: true,
          reason: 'Content extraction not supported on this page type.',
          contentType: contentType // Pass content type back if needed by UI
        };
    }

    if (shouldExtract) {
        logger.background.info(`First message: Extraction will proceed for tab ${tabId} (no existing content, not skipped).`);
        // Reset previous extraction state (ensure this happens ONLY if extracting)
        await resetExtractionState();
        // Use the explicitly passed platformId
        await updateApiProcessingStatus('extracting', platformId);

        // Extract content
        logger.background.info(`Content type determined: ${contentType}`);
        await extractContent(tabId, url); // url should be available here
        extractedContent = await getExtractedContent(); // Assign to the outer scope variable

        if (!extractedContent) {
            // Handle extraction failure more gracefully if needed, maybe log and continue?
            logger.background.warn(`Failed to extract content for tab ${tabId}, proceeding without it.`);
            newlyFormattedContent = null; // Ensure null if extraction failed
        } else {
            logger.background.info('Content extraction completed.');
            // Format and Store Content
            logger.background.info(`Formatting extracted content (type: ${contentType})...`);
            newlyFormattedContent = ContentFormatter.formatContent(extractedContent, contentType); // Assign to outer scope variable
            await storeFormattedContentForTab(tabId, newlyFormattedContent);
            logger.background.info(`Formatted and stored content for tab ${tabId}.`);
        }
        // Ensure these are null if extraction happened but failed
        if (!newlyFormattedContent) {
             extractedContent = null;
        }
    } else {
        // Log the reason why extraction was skipped
        if (!isFirstUserMessage) {
            logger.background.info(`Not first message: Skipping extraction for tab ${tabId}.`);
        } else if (skipExtractionRequested) {
            logger.background.info(`First message: Extraction skipped for tab ${tabId} by user request.`);
        } else if (initialFormattedContentExists) {
            logger.background.info(`First message: Formatted content already exists for tab ${tabId}, skipping extraction.`);
        } else if (isFirstUserMessage && !canInject) {
            // This case is already logged above where shouldExtract is calculated.
        } else {
             // Should not happen based on shouldExtract logic, but log just in case
             logger.background.warn(`Extraction skipped for unknown reason for tab ${tabId}. Conditions: isFirst=${isFirstUserMessage}, skipped=${skipExtractionRequested}, exists=${initialFormattedContentExists}, canInject=${canInject}`);
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

    // 5. Platform Determination - REMOVED. Use platformId directly from params.
    // let effectivePlatformId = ... // REMOVED

    // 6. Verify Credentials - REMOVED. Should be handled UI-side or implicitly by API call failure.
    // await verifyApiCredentials(effectivePlatformId); // REMOVED

    // 7. Parameter Resolution (Centralized) - Use platformId and modelId from params
    logger.background.info(`Resolving parameters for platform: ${platformId}, model: ${modelId}`);
    let resolvedParams = await ModelParameterService.resolveParameters(
      platformId, // Use directly from params
      modelId,    // Use directly from params
      { tabId, source, conversationHistory } // Pass context including history
    );
    logger.background.info(`Resolved parameters:`, resolvedParams);

    // Add conversation history to resolvedParams - Now done inside resolveParameters
    // resolvedParams.conversationHistory = conversationHistory; // REMOVED
    // logger.background.info(`Added conversation history to resolvedParams. History length: ${conversationHistory.length}`); // REMOVED

    // Add conversation history to resolvedParams
    resolvedParams.conversationHistory = conversationHistory;
    logger.background.info(`Added conversation history to resolvedParams. History length: ${conversationHistory.length}`);


    // 8. Update processing status (using platformId from params and resolved model)
    await updateApiProcessingStatus('processing', platformId, resolvedParams.model);

    // 9. Generate a unique stream ID for this request
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 10. Initialize streaming response (using platformId from params)
    await initializeStreamResponse(streamId, platformId, resolvedParams.model); // Include model

    // 11. Determine the formatted content to include in the request (only for the first message under specific conditions)
    let formattedContentForRequest = null;

    if (isFirstUserMessage) {
        logger.background.info(`Processing first user message for content inclusion.`);
        if (!skipExtractionRequested) {
            logger.background.info(`Extraction was allowed for this first message.`);
            if (shouldExtract && newlyFormattedContent) {
                // Extraction was triggered now and succeeded
                formattedContentForRequest = newlyFormattedContent;
                logger.background.info(`Using newly extracted/formatted content for tab ${tabId}.`);
            } else if (initialFormattedContentExists) {
                // Extraction wasn't triggered now (because content existed), but it was allowed and content exists
                formattedContentForRequest = await getFormattedContentForTab(tabId);
                logger.background.info(`Using pre-existing formatted content for tab ${tabId}.`);
            } else {
                // Extraction was allowed, but either failed or wasn't triggered (and no pre-existing content)
                logger.background.info(`No content available (extraction allowed but failed, or content didn't exist) for tab ${tabId}.`);
                formattedContentForRequest = null;
            }
        } else {
            // Extraction was explicitly skipped by the user for the first message
            logger.background.info(`Extraction was skipped by user request for this first message. No content included.`);
            formattedContentForRequest = null;
        }
    } else {
        // Not the first message, never include content
        logger.background.info(`Not the first user message: Skipping content inclusion.`);
        formattedContentForRequest = null;
    }

    if (tabId) {
      try {
        const promptToStoreOrClear = resolvedParams.systemPrompt;
        logger.background.info(`Updating system prompt state for tab ${tabId}. Prompt is ${promptToStoreOrClear ? 'present' : 'absent/empty'}.`);
        await storeSystemPromptForTab(tabId, promptToStoreOrClear);
      } catch (storeError) {
        logger.background.error(`Failed to update system prompt state for tab ${tabId}:`, storeError);
      }
    }

    // 12. Notify the content script about streaming start ONLY if possible and from sidebar
    if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
      if (isInjectablePage(url)) { // Check if the page allows content scripts
        try {
          chrome.tabs.sendMessage(tabId, { // Keep using tabs.sendMessage
            action: 'streamStart',
            streamId,
            platformId: platformId, // Use platformId from params
            model: resolvedParams.model // Send resolved model
          });
          logger.background.info(`Sent streamStart notification to content script in tab ${tabId}.`);
        } catch (err) {
          // Log specific error types differently
          if (err.message && (err.message.includes('Could not establish connection') || err.message.includes('Receiving end does not exist'))) {
             logger.background.warn(`Failed to send streamStart to tab ${tabId}: Content script likely not running or injected.`);
          } else {
             logger.background.error('Error notifying content script about stream start:', err);
          }
        }
      } else {
        logger.background.info(`Skipped sending streamStart notification to tab ${tabId} (URL: ${url}) as it's not an injectable page.`);
      }
    }

    // 13. Create unified request configuration
    const requestConfig = {
      prompt: promptContent,
      resolvedParams: resolvedParams, // Pass the whole resolved params object (now includes history)
      formattedContent: formattedContentForRequest, // Pass the formatted content string or null
      // conversationHistory, // Removed: Now part of resolvedParams
      streaming: true, // Always true for this function
      // Pass platformId from params to stream handler
      onChunk: createStreamHandler(streamId, source, tabId, platformId, resolvedParams)
    };

    // 14. Process with API (using platformId from params)
    const controller = new AbortController();
    activeAbortControllers.set(streamId, controller);
    requestConfig.abortSignal = controller.signal; // Add signal to request config

    try {
      logger.background.info('Calling ApiServiceManager.processWithUnifiedConfig with config:', requestConfig);
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
        contentType: contentType // Use the variable determined earlier
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
      error: error.message
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
      
      // Update storage with latest content
      await chrome.storage.local.set({
        [STORAGE_KEYS.STREAM_CONTENT]: fullContent
      });
      
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
              model: modelToUse // Use the consistent resolved model
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
        model: modelToUse, // Use the consistent resolved model
        fullContent: chunkData.fullContent || fullContent // Use fullContent from chunk if available
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

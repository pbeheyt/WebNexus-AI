// src/background/api/api-coordinator.js

import ApiServiceManager from '../../services/ApiServiceManager.js';
import ModelParameterService from '../../services/ModelParameterService.js';
import ContentFormatter from '../../services/ContentFormatter.js'; // Added
import { extractContent } from '../services/content-extraction.js';
import { getPreferredAiPlatform } from '../services/platform-integration.js';
import { verifyApiCredentials } from '../services/credential-manager.js';
import { determineContentType } from '../../shared/utils/content-utils.js';
import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants.js';
import { 
  resetExtractionState, 
  updateApiProcessingStatus, 
  initializeStreamResponse,
  getExtractedContent,
  setApiProcessingError,
  completeStreamResponse,
  hasFormattedContentForTab,
  storeFormattedContentForTab, // Added
  getFormattedContentForTab   // Added
} from '../core/state-manager.js';
import logger from '../../shared/logger.js';

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
        const platformId = message.platformId || await getPreferredAiPlatform();
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
        const { streamId } = message;
        // Simply acknowledge the cancellation; cleanup is handled by the component
        sendResponse({ success: true });
        break;
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
  const {
    tabId,
    url,
    promptId = null,
    platformId = null,
    modelId = null, // Added modelId override possibility
    source = INTERFACE_SOURCES.POPUP,
    customPrompt = null,
    streaming = false, // Note: streaming is forced to true later
    conversationHistory = []
  } = params;

  try {
    logger.background.info(`Starting API-based content processing from ${source}`, {
      tabId, url, promptId, platformId, streaming
    });

    let extractedContent = null;
    let newlyFormattedContent = null; // To hold content formatted in this run
    const contentType = determineContentType(url);
    const skipExtractionRequested = params.skipInitialExtraction === true; // Retrieve the flag

    // 1. Decide whether to extract content based on existence and user request
    const initialFormattedContentExists = await hasFormattedContentForTab(tabId);
    const shouldExtract = !initialFormattedContentExists && !skipExtractionRequested; // New condition

    if (shouldExtract) {
        logger.background.info(`Content extraction will proceed for tab ${tabId}.`);
        // Reset previous extraction state (ensure this happens ONLY if extracting)
        await resetExtractionState();
        // Determine effectivePlatformId *before* using it here
        let tempEffectivePlatformId = platformId || await getPreferredAiPlatform(source); // Resolve temporarily if needed
        await updateApiProcessingStatus('extracting', tempEffectivePlatformId); // Use resolved platform

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
    } else if (initialFormattedContentExists) {
        logger.background.info(`Formatted content already exists for tab ${tabId}, skipping extraction.`);
        // Ensure these are null if not extracting now
        extractedContent = null;
        newlyFormattedContent = null;
    } else { // Content doesn't exist AND skipExtractionRequested is true
        logger.background.info(`Content extraction skipped for tab ${tabId} by user request.`);
        extractedContent = null; // Ensure null if skipped
        newlyFormattedContent = null; // Ensure null if skipped
    }

    // 4. Get the prompt
    let promptContent;

    if (customPrompt) {
      promptContent = customPrompt;
    } else {
      throw new Error('No prompt content provided');
    }

    if (!promptContent) {
      throw new Error('No prompt content provided');
    }

    // 5. Determine platform to use - tab-aware resolution
    let effectivePlatformId = platformId; // Use provided platformId first

    if (!effectivePlatformId && tabId) {
      try {
        // Try to get tab-specific platform preference first
        const tabPreferences = await chrome.storage.local.get(STORAGE_KEYS.TAB_PLATFORM_PREFERENCES);
        const tabPlatformPrefs = tabPreferences[STORAGE_KEYS.TAB_PLATFORM_PREFERENCES] || {};

        if (tabPlatformPrefs[tabId]) {
          effectivePlatformId = tabPlatformPrefs[tabId];
          logger.background.info(`Using tab-specific platform for tab ${tabId}: ${effectivePlatformId}`);
        } else {
          // Fall back to standard preference resolution
          effectivePlatformId = await getPreferredAiPlatform(source);
        }
      } catch (error) {
        logger.background.error('Error resolving tab-specific platform:', error);
        effectivePlatformId = await getPreferredAiPlatform(source);
      }
    }
    // If still no effectivePlatformId, resolve normally
    if (!effectivePlatformId) {
       effectivePlatformId = await getPreferredAiPlatform(source);
    }


    // 6. Verify credentials (using the final effectivePlatformId)
    await verifyApiCredentials(effectivePlatformId);

    // 7. Parameter Resolution (Centralized)
    logger.background.info(`Resolving parameters for platform: ${effectivePlatformId}, model override: ${modelId}`);
    let resolvedParams = await ModelParameterService.resolveParameters( // Changed const to let
      effectivePlatformId,
      modelId || null, // Use the passed modelId override
      { tabId, source } // Context for resolution
    );
    logger.background.info(`Resolved parameters:`, resolvedParams);

    // Add conversation history to resolvedParams
    resolvedParams.conversationHistory = conversationHistory;
    logger.background.info(`Added conversation history to resolvedParams. History length: ${conversationHistory.length}`);


    // 8. Update processing status (using resolved platform and model)
    await updateApiProcessingStatus('processing', effectivePlatformId, resolvedParams.model);

    // 9. Generate a unique stream ID for this request
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 10. Initialize streaming response
    await initializeStreamResponse(streamId, effectivePlatformId, resolvedParams.model); // Include model

    // 11. Determine the formatted content to use for the request based on the extraction outcome and message history
    let formattedContentForRequest = null;
    const isFirstUserMessage = conversationHistory.length === 0; // Ensure conversationHistory is correctly passed/available
    logger.background.info(`Is this the first user message (history empty)? ${isFirstUserMessage}`);

    if (isFirstUserMessage) {
        if (shouldExtract && newlyFormattedContent) { // Use the content just formatted
            formattedContentForRequest = newlyFormattedContent;
            logger.background.info(`First user message: Using newly extracted/formatted content for tab ${tabId}.`);
        } else if (initialFormattedContentExists) { // Use previously stored content
            formattedContentForRequest = await getFormattedContentForTab(tabId);
            logger.background.info(`First user message: Using pre-existing formatted content for tab ${tabId}.`);
        } else { // No content exists and extraction was skipped or failed
            logger.background.info(`First user message: No content available (extraction skipped or failed) for tab ${tabId}.`);
            formattedContentForRequest = null;
        }
    } else { // Not the first message
        logger.background.info(`Not the first user message: Skipping formatted content retrieval.`);
        formattedContentForRequest = null;
    }


    // 12. Notify the content script about streaming start if this is from sidebar
    if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
      try {
        chrome.tabs.sendMessage(tabId, {
          action: 'streamStart',
          streamId,
          platformId: effectivePlatformId,
          model: resolvedParams.model // Send resolved model
        });
      } catch (err) {
        logger.background.warn('Error notifying content script about stream start:', err);
      }
    }

    // 13. Create unified request configuration
    const requestConfig = {
      prompt: promptContent,
      resolvedParams: resolvedParams, // Pass the whole resolved params object (now includes history)
      formattedContent: formattedContentForRequest, // Pass the formatted content string or null
      // conversationHistory, // Removed: Now part of resolvedParams
      streaming: true, // Always true for this function
      // Pass resolvedParams to stream handler for model info
      onChunk: createStreamHandler(streamId, source, tabId, effectivePlatformId, resolvedParams)
    };

    // 14. Process with API
    try {
      logger.background.info('Calling ApiServiceManager.processWithUnifiedConfig with config:', requestConfig);
      // Pass only platformId and requestConfig. tabId is within resolvedParams if needed.
      const apiResponse = await ApiServiceManager.processWithUnifiedConfig(
        effectivePlatformId,
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
      throw processingError;
    }
  } catch (error) {
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

      if (chunkData.error) {
        logger.background.error(`Stream ended with error: ${chunkData.error}`);
        await setApiProcessingError(chunkData.error);
        // Pass modelToUse to completeStreamResponse
        await completeStreamResponse(fullContent, modelToUse, platformId, chunkData.error);
        finalChunkData.error = chunkData.error;
      } else {
        // Pass modelToUse to completeStreamResponse
        await completeStreamResponse(fullContent, modelToUse, platformId);
      }

      // Ensure the final message (success or error) is sent for sidebar
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

// src/background/api/api-coordinator.js

import ApiServiceManager from '../../services/ApiServiceManager.js';
import ModelParameterService from '../../services/ModelParameterService.js';
import { extractContent, checkYouTubeTranscriptAvailability } from '../services/content-extraction.js';
import { getPreferredPromptId, getPromptContentById } from '../services/prompt-resolver.js';
import { getPreferredAiPlatform } from '../services/platform-integration.js';
import { verifyApiCredentials } from '../services/credential-manager.js';
import { determineContentType } from '../../shared/content-utils.js';
import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants.js';
import {
  resetExtractionState,
  updateApiProcessingStatus,
  initializeStreamResponse,
  getExtractedContent,
  setApiProcessingError,
  completeStreamResponse
} from '../core/state-manager.js';
import logger from '../../utils/logger.js';
// Updated import: Use the specific function from the renamed file
import { getExtractionPreference } from '../services/tab-extraction-preference.js';

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
        // This might need adjustment depending on how streaming state is managed
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
        const { streamId, platformId, tabId } = message; // Get platformId and tabId
        logger.background.info(`Cancel stream request received for ${streamId}`);
        // TODO: Implement actual cancellation logic if possible for the specific API
        // For now, just acknowledge and let the frontend handle UI state
        sendResponse({ success: true, message: 'Cancellation acknowledged' });
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
    hasSelection = false, // Keep for consistency, but ignore for extraction toggle
    promptId = null,
    platformId = null,
    source = INTERFACE_SOURCES.POPUP,
    customPrompt = null,
    streaming = false,
    conversationHistory = []
  } = params;

  try {
    logger.background.info(`Starting API-based content processing from ${source}`, {
      tabId, url, hasSelection, promptId, platformId, streaming
    });

    // 1. Reset previous state
    await resetExtractionState();
    await updateApiProcessingStatus('extracting', platformId || await getPreferredAiPlatform());

    // 2. Check extraction preference using the imported function
    const isExtractionEnabled = await getExtractionPreference(tabId);
    const contentType = determineContentType(url, false); // Ignore selection for extraction toggle
    logger.background.info(`Extraction enabled for tab ${tabId}: ${isExtractionEnabled}`);

    let extractedContent = null;
    if (isExtractionEnabled) {
        logger.background.info(`Content type determined: ${contentType}`);
        await extractContent(tabId, url, false); // Pass false for hasSelection
        extractedContent = await getExtractedContent();

        if (!extractedContent) {
            // Don't throw error here, allow processing with just the prompt
            logger.background.warn('Content extraction was enabled but failed or returned no content.');
        } else {
             // YouTube transcript error check only if content was extracted
            const transcriptError = checkYouTubeTranscriptAvailability(extractedContent);
            if (transcriptError) {
                return {
                    success: false,
                    ...transcriptError
                };
            }
        }
    } else {
        logger.background.info('Content extraction skipped by user preference.');
        // Ensure extractedContent is null if extraction disabled
        await chrome.storage.local.set({ [STORAGE_KEYS.EXTRACTED_CONTENT]: null });
        extractedContent = null;
    }

    // 3. Get the prompt
    let promptContent;
    let effectivePromptId;

    if (customPrompt) {
      promptContent = customPrompt;
    } else {
      effectivePromptId = promptId || await getPreferredPromptId(contentType);
      promptContent = await getPromptContentById(effectivePromptId, contentType);
    }

    if (!promptContent) {
      throw new Error(`Prompt not found for ID: ${effectivePromptId || 'custom'}`);
    }

    // 4. Determine platform to use - tab-aware resolution
    let effectivePlatformId = platformId;

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
    } else {
      effectivePlatformId = platformId || await getPreferredAiPlatform(source);
    }

    // 5. Verify credentials
    await verifyApiCredentials(effectivePlatformId);

    // 6. Model resolution - Now uses centralized ModelParameterService
    const effectiveModelId = await ModelParameterService.resolveModel(
      effectivePlatformId,
      {
        tabId,
        source
      }
    );

    // 7. Update processing status
    await updateApiProcessingStatus('processing', effectivePlatformId);

    // 8. Generate a unique stream ID for this request
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 9. Initialize streaming response state in storage
    await initializeStreamResponse(streamId, effectivePlatformId);

    // 10. Notify the content script about streaming start if this is from sidebar
    if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
      try {
        chrome.tabs.sendMessage(tabId, {
          action: 'streamStart',
          streamId,
          platformId: effectivePlatformId
        });
      } catch (err) {
        logger.background.warn('Error notifying content script about stream start:', err);
      }
    }

    // 11. Create unified request configuration
    const requestConfig = {
      contentData: extractedContent, // This will be null if extraction was disabled
      prompt: promptContent,
      model: effectiveModelId,
      conversationHistory,
      streaming: true, // Always use streaming for API path now
      onChunk: createStreamHandler(streamId, source, tabId, effectivePlatformId),
      tabId: tabId // Pass tabId for API base
    };

    // 12. Process with API
    try {
      const apiResponseMetadata = await ApiServiceManager.processWithUnifiedConfig(
        effectivePlatformId,
        requestConfig,
        tabId // Pass tabId explicitly
      );

      // If we get here without an error, streaming completed successfully via callbacks
      // The response here might just be metadata, full content handled by stream handler
      return {
        success: true,
        streamId,
        response: apiResponseMetadata, // This might just contain metadata like model used
        contentType: contentType // Return original content type
      };
    } catch (processingError) {
      // Handle API processing errors specifically during the processing call
      logger.background.error('Error during API processing call:', processingError);
      await setApiProcessingError(processingError.message);
       // Send error chunk via handler
      const handler = requestConfig.onChunk;
      if (handler) {
          handler({ error: processingError, done: true });
      }
      // Rethrow or return error structure
      throw processingError; // Rethrow to be caught by the outer catch block
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
 * @returns {Function} Chunk handler function
 */
function createStreamHandler(streamId, source, tabId, platformId) {
  let fullContent = '';
  let modelToUse = null;

  return async function handleChunk(chunkData) {
    if (!chunkData) return;

    // Handle potential errors propagated through the chunk handler
    if (chunkData.error) {
        logger.background.error(`Stream error for ${streamId}:`, chunkData.error);
        await setApiProcessingError(chunkData.error.message || 'Unknown streaming error');
        // Send error to content script if applicable
        if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
            try {
                chrome.tabs.sendMessage(tabId, {
                    action: 'streamChunk',
                    streamId,
                    chunkData: {
                        error: chunkData.error.message || 'Unknown streaming error',
                        done: true,
                        model: modelToUse
                    }
                });
            } catch (err) {
                logger.background.warn('Error sending stream error chunk:', err);
            }
        }
        return; // Stop processing further chunks on error
    }


    const chunk = typeof chunkData.chunk === 'string' ? chunkData.chunk : '';
    const done = !!chunkData.done;

    // Capture or update model information
    if (chunkData.model) {
      modelToUse = chunkData.model;
    }

    if (chunk) {
      fullContent += chunk;

      // Update storage with latest content (optional, maybe only on done?)
      // Consider performance impact if updating too frequently
      // await chrome.storage.local.set({
      //   [STORAGE_KEYS.STREAM_CONTENT]: fullContent
      // });

      // Send to content script for sidebar
      if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
        try {
          chrome.tabs.sendMessage(tabId, {
            action: 'streamChunk',
            streamId,
            chunkData: {
              chunk,
              done: false,
              model: chunkData.model || modelToUse
            }
          });
        } catch (err) {
          logger.background.warn('Error sending stream chunk:', err);
        }
      }
    }

    // Always send a final message when done
    if (done) {
      await completeStreamResponse(fullContent, modelToUse, platformId);

      // Ensure the completion message is sent for sidebar
      if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
        try {
          chrome.tabs.sendMessage(tabId, {
            action: 'streamChunk',
            streamId,
            chunkData: {
              chunk: '',
              done: true,
              model: chunkData.model || modelToUse,
              fullContent // Include full content in final message
            }
          });
        } catch (err) {
          logger.background.warn('Error sending stream completion:', err);
        }
      }
    }
  };
}
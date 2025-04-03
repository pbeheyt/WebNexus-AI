// src/background/api/api-coordinator.js

import ApiServiceManager from '../../services/ApiServiceManager.js';
import ModelParameterService from '../../services/ModelParameterService.js';
import { extractContent, checkYouTubeTranscriptAvailability } from '../services/content-extraction.js';
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
  completeStreamResponse
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
    source = INTERFACE_SOURCES.POPUP,
    customPrompt = null,
    streaming = false,
    conversationHistory = []
  } = params;

  try {
    logger.background.info(`Starting API-based content processing from ${source}`, {
      tabId, url, promptId, platformId, streaming
    });

    // 1. Reset previous state
    await resetExtractionState();
    await updateApiProcessingStatus('extracting', platformId || await getPreferredAiPlatform());

    // 2. Extract content
    const contentType = determineContentType(url);
    logger.background.info(`Content type determined: ${contentType}`);

    await extractContent(tabId, url);
    const extractedContent = await getExtractedContent();

    if (!extractedContent) {
      throw new Error('Failed to extract content');
    }

    // 3. YouTube transcript error check
    const transcriptError = checkYouTubeTranscriptAvailability(extractedContent);
    if (transcriptError) {
      return {
        success: false,
        ...transcriptError
      };
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

    // 6. Verify credentials
    await verifyApiCredentials(effectivePlatformId);

    // 7. Model resolution - Now uses centralized ModelParameterService
    const effectiveModelId = await ModelParameterService.resolveModel(
      effectivePlatformId, 
      { 
        tabId, 
        source 
      }
    );

    // 8. Update processing status
    await updateApiProcessingStatus('processing', effectivePlatformId);

    // 9. Generate a unique stream ID for this request
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 10. Initialize streaming response
    await initializeStreamResponse(streamId, effectivePlatformId);

    // 11. Notify the content script about streaming start if this is from sidebar
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

    // 12. Create unified request configuration
    const requestConfig = {
      contentData: extractedContent,
      prompt: promptContent,
      model: effectiveModelId,
      conversationHistory,
      streaming: true,
      onChunk: createStreamHandler(streamId, source, tabId, effectivePlatformId)
    };

    // 13. Process with API
    try {
      const apiResponse = await ApiServiceManager.processWithUnifiedConfig(
        effectivePlatformId,
        requestConfig,
        tabId
      );

      // If we get here without an error, streaming completed successfully
      return {
        success: true,
        streamId,
        response: apiResponse,
        contentType: extractedContent.contentType
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
 * @returns {Function} Chunk handler function
 */
function createStreamHandler(streamId, source, tabId, platformId) {
  let fullContent = '';
  let modelToUse = null;
  
  return async function handleChunk(chunkData) {
    if (!chunkData) return;
    
    const chunk = typeof chunkData.chunk === 'string' ? chunkData.chunk : '';
    const done = !!chunkData.done;
    
    // Capture or update model information
    if (chunkData.model) {
      modelToUse = chunkData.model;
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
              fullContent
            }
          });
        } catch (err) {
          logger.background.warn('Error sending stream completion:', err);
        }
      }
    }
  };
}

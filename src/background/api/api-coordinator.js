// src/background/api/api-coordinator.js

import ApiServiceManager from '../../services/ApiServiceManager.js';
import { extractContent, checkYouTubeTranscriptAvailability } from '../services/content-extraction.js';
import { getPreferredPromptId, getPromptContentById } from '../services/prompt-resolver.js';
import { getPreferredAiPlatform } from '../services/platform-integration.js';
import { verifyApiCredentials } from '../services/credential-manager.js';
import { determineContentType } from '../../shared/content-utils.js';
import { INTERFACE_SOURCES, STORAGE_KEYS } from '../../shared/constants.js';
import { resetExtractionState, updateApiProcessingStatus, initializeStreamResponse,
         getExtractedContent, setApiProcessingError } from '../core/state-manager.js';
import { setupStreamHandler } from './streaming-handler.js';
import logger from '../../utils/logger.js';

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
        const result = await chrome.storage.local.get(['apiResponse', 'apiProcessingStatus', 'apiResponseTimestamp']);
        sendResponse({
          success: true,
          response: result.apiResponse || null,
          status: result.apiProcessingStatus || 'unknown',
          timestamp: result.apiResponseTimestamp || null
        });
        break;
      }

      case 'cancelStream': {
        const { streamId } = message;
        // Cancel stream in background state
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
    hasSelection = false,
    promptId = null,
    platformId = null,
    source = INTERFACE_SOURCES.POPUP,
    customPrompt = null,
    conversationHistory = [] // Add conversation history parameter
  } = params;

  try {
    logger.background.info(`Starting API-based content processing with streaming from ${source}`, params);

    // 1. Reset previous state
    await resetExtractionState();
    await updateApiProcessingStatus('extracting', platformId || await getPreferredAiPlatform());

    let extractedContent;

    // Normal extraction for real tabs
    const contentType = determineContentType(url, hasSelection);
    logger.background.info(`Content type determined: ${contentType}, hasSelection: ${hasSelection}`);

    const extractionResult = await extractContent(tabId, url, hasSelection);

    if (!extractionResult) {
      logger.background.warn('Content extraction completed with warnings');
    }

    // Get the extracted content
    extractedContent = await getExtractedContent();

    if (!extractedContent) {
      throw new Error('Failed to extract content');
    }

    // YouTube transcript error check
    const transcriptError = checkYouTubeTranscriptAvailability(extractedContent);
    if (transcriptError) {
      return {
        success: false,
        ...transcriptError
      };
    }

    // 4. Get the prompt
    let promptContent;
    let effectivePromptId;

    logger.background.info('Prompt content', { customPrompt, promptId, contentType: extractedContent.contentType });

    if (customPrompt) {
      promptContent = customPrompt;
    } else {
      effectivePromptId = promptId || await getPreferredPromptId(extractedContent.contentType);
      promptContent = await getPromptContentById(effectivePromptId, extractedContent.contentType);
    }

    if (!promptContent) {
      throw new Error(`Prompt not found for ID: ${effectivePromptId || 'custom'}`);
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

    // Model resolution
    let effectiveModelId = null;

    if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
      try {
        // Try to get tab-specific model preference first
        const tabModelPreferences = await chrome.storage.local.get(STORAGE_KEYS.TAB_MODEL_PREFERENCES);
        const tabModelPrefs = tabModelPreferences[STORAGE_KEYS.TAB_MODEL_PREFERENCES] || {};
        const tabPlatformModels = tabModelPrefs[tabId] || {};

        if (tabPlatformModels[effectivePlatformId]) {
          effectiveModelId = tabPlatformModels[effectivePlatformId];
          logger.background.info(`Using tab-specific model for tab ${tabId}: ${effectiveModelId}`);
        } else {
          // Fall back to global model preference
          const globalModelPreferences = await chrome.storage.sync.get(STORAGE_KEYS.SIDEBAR_MODEL);
          const globalModelPrefs = globalModelPreferences[STORAGE_KEYS.SIDEBAR_MODEL] || {};

          effectiveModelId = globalModelPrefs[effectivePlatformId];
          logger.background.info(`Using global model preference: ${effectiveModelId}`);
        }
      } catch (error) {
        logger.background.error('Error resolving tab-specific model:', error);
      }
    }

    // 7. Update processing status
    await updateApiProcessingStatus('processing', effectivePlatformId);

    logger.background.info(`Using prompt ID: ${promptId || 'custom'}, platform: ${effectivePlatformId}`);

    // Generate a unique stream ID for this request
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Initialize streaming response
    await initializeStreamResponse(streamId, effectivePlatformId);

    // Notify the content script about streaming start if this is from the sidebar
    if (source === INTERFACE_SOURCES.SIDEBAR && tabId) {
      try {
        chrome.tabs.sendMessage(tabId, {
          action: 'streamStart',
          streamId,
          platformId: effectivePlatformId
        });
      } catch (err) {
        // Ignore if content script isn't available
        logger.background.warn('Error notifying content script about stream start:', err);
      }
    }

    // 8. Set up the stream handler
    const streamHandler = setupStreamHandler(streamId, source, tabId, effectivePlatformId);

    // 9. Process with API using streaming
    try {
      // Pass the resolved model ID to the API Service Manager
      const apiResponse = await ApiServiceManager.processContent(
        effectivePlatformId,
        extractedContent,
        promptContent,
        streamHandler,
        conversationHistory,
        effectiveModelId // Pass the tab-specific model ID
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

    // Ensure error state is set
    await setApiProcessingError(error.message);

    return {
      success: false,
      error: error.message
    };
  }
}

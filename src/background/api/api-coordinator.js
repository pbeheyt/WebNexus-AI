// src/background/api/api-coordinator.js - API-mode operations

import ApiServiceManager from '../../services/ApiServiceManager.js';
import { extractContent, checkYouTubeTranscriptAvailability } from '../services/content-extraction.js';
import { getPreferredPromptId, getPromptContentById } from '../services/prompt-resolver.js';
import { getPreferredAiPlatform } from '../services/platform-integration.js';
import { verifyApiCredentials } from '../services/credential-manager.js';
import { determineContentType } from '../../shared/content-utils.js';
import { INTERFACE_SOURCES } from '../../shared/constants.js';
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
      
      case 'sidebarApiProcess': {
        // Extract all required parameters for API processing
        const {
          platformId,
          prompt,
          extractedContent,
          url,
          tabId
        } = message;
        
        logger.background.info(`Processing sidebar API request: platform=${platformId}`);
        
        // Call API function with sidebar source
        const result = await summarizeContentViaApi({
          tabId,
          url,
          platformId,
          testMode: !!extractedContent,
          testContent: extractedContent,
          useApi: true,
          source: INTERFACE_SOURCES.SIDEBAR,
          customPrompt: prompt
        });
        
        sendResponse(result);
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
 * Summarize content via API with streaming support
 * @param {Object} params - Parameters for summarization
 * @returns {Promise<Object>} Result information
 */
export async function summarizeContentViaApi(params) {
  const {
    tabId,
    url,
    hasSelection = false,
    promptId = null,
    platformId = null,
    testMode = false,
    testContent = null,
    source = INTERFACE_SOURCES.POPUP,
    customPrompt = null
  } = params;

  try {
    logger.background.info(`Starting API-based summarization with streaming from ${source}`, params);

    // 1. Reset previous state
    await resetExtractionState();
    await updateApiProcessingStatus('extracting', platformId || await getPreferredAiPlatform());

    let extractedContent;

    // If in test mode, use the provided test content or get mock data
    if (testMode) {
      logger.background.info('Using test mode with mock data');

      // Use provided test content or generate from mockDataFactory
      if (testContent) {
        extractedContent = testContent;
        logger.background.info('extractedContent type for API testing', { extractedContent });
      } else {
        // Import your test harness or access it from a global
        const apiTestHarness = require('../../api/api-test-utils');
        const contentType = determineContentType(url, hasSelection);
        logger.background.info('content type for API testing', { contentType });
        extractedContent = apiTestHarness.mockDataFactory[contentType] ||
                          apiTestHarness.mockDataFactory.general;
      }

      // Store mock content in local storage to mimic normal flow
      await chrome.storage.local.set({
        extractedContent,
        contentReady: true
      });

      logger.background.info('Mock content ready for API testing', {
        contentType: extractedContent.contentType
      });
    } else {
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
    
    if (customPrompt) {
      promptContent = customPrompt;
    } else {
      effectivePromptId = promptId || await getPreferredPromptId(extractedContent.contentType);
      promptContent = await getPromptContentById(effectivePromptId, extractedContent.contentType);
    }

    if (!promptContent) {
      throw new Error(`Prompt not found for ID: ${effectivePromptId || 'custom'}`);
    }

    // 5. Determine platform to use - source-aware
    const effectivePlatformId = platformId || await getPreferredAiPlatform(source);

    // 6. Verify credentials
    await verifyApiCredentials(effectivePlatformId);

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
      const apiResponse = await ApiServiceManager.processContent(
        effectivePlatformId,
        extractedContent,
        promptContent,
        streamHandler
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
    logger.background.error('API summarization error:', error);

    // Ensure error state is set
    await setApiProcessingError(error.message);

    return {
      success: false,
      error: error.message
    };
  }
}
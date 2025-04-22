// src/background/services/content-processing.js - Content processing

import { determineContentType, isInjectablePage } from '../../shared/utils/content-utils.js';
import { extractContent } from './content-extraction.js';
import { openAiPlatformWithContent } from './platform-integration.js';
import { resetExtractionState, savePlatformTabInfo } from '../core/state-manager.js';
import { processContentViaApi } from '../api/api-coordinator.js';
import logger from '../../shared/logger.js';
import { STORAGE_KEYS } from '../../shared/constants.js';
import ContentFormatter from '../../services/ContentFormatter.js';

/**
 * Process content using web AI interface (non-API path)
 * Used by popup to extract content and send to web UI
 * @param {Object} params - Processing parameters
 * @returns {Promise<Object>} Result information { success: boolean, aiPlatformTabId?: number, contentType?: string, error?: string, code?: string }
 */
export async function processContent(params) {
  const { 
    tabId, 
    url, 
    platformId = null,
    promptContent = null,
    useApi = false
  } = params;
  
  try {
    logger.background.info('Starting web UI content processing', {
      tabId, url, platformId
    });
    
    // If API mode requested, use API path
    if (useApi) {
      return await processContentViaApi(params);
    }

    // Check if page is injectable BEFORE attempting extraction
    if (!isInjectablePage(url)) {
      logger.background.warn(`processContent: Page is not injectable (${url}). Skipping extraction.`);
      return {
        success: false,
        error: 'Content extraction not supported on this page.',
        code: 'EXTRACTION_NOT_SUPPORTED'
      };
    }
    
    // Check for prompt content
    if (!promptContent) {
      logger.background.warn('processContent: No prompt content provided.');
      return {
        success: false,
        error: 'No prompt content provided.' // Consistent error message
      };
    }
    
    // 1. Reset previous state
    await resetExtractionState();
    
    // 2. Extract content
    const contentType = determineContentType(url);
    logger.background.info(`Content type determined: ${contentType}`);
    
    const extractionResult = await extractContent(tabId, url);
    if (!extractionResult) {
      logger.background.warn('Content extraction completed with issues');
    }

    // 3. Get extracted content and check for specific errors
    const { extractedContent } = await chrome.storage.local.get(STORAGE_KEYS.EXTRACTED_CONTENT);

    if (!extractedContent) {
      logger.background.error('processContent: Failed to retrieve extracted content from storage.');
      // Return failure object directly instead of throwing
      return {
        success: false,
        error: 'Failed to extract content from the page.'
      };
    }

    // 4. Format content
    const formattedContentString = ContentFormatter.formatContent(extractedContent, contentType);
    
    // 5. Get platform and open it with content
    const effectivePlatformId = platformId;
    
    const aiPlatformTabId = await openAiPlatformWithContent(effectivePlatformId);
    
    if (!aiPlatformTabId) {
      logger.background.error(`processContent: Failed to open AI platform tab for ${effectivePlatformId}.`);
      // Return failure object directly
      return {
        success: false,
        error: `Failed to open the ${effectivePlatformId} platform tab.`
      };
    }
    
    // Save tab information for later, including the formatted content
    await savePlatformTabInfo(aiPlatformTabId, effectivePlatformId, promptContent, formattedContentString);
    
    return {
      success: true,
      aiPlatformTabId,
      contentType
    };
  } catch (error) {
    logger.background.error('Error during web UI content processing:', error);
    // Ensure consistent failure object structure
    return {
      success: false,
      error: error.message || 'An unknown error occurred during content processing.'
    };
  }
}

/**
 * Handle process content request from message
 * @param {Object} message - Message object
 * @param {Function} sendResponse - Response function
 */
export async function handleProcessContentRequest(message, sendResponse) {
  try {
    const { tabId, platformId, url, promptContent, useApi } = message;
    logger.background.info(`Process content request for tab ${tabId}`, {
      platformId, useApi
    });

    // Call appropriate processing function based on API flag
    if (useApi) {
      const result = await processContentViaApi(message);
      sendResponse(result);
    } else {
      // Await the result and send it back
      const result = await processContent(message);
      sendResponse(result);
    }
  } catch (error) {
    logger.background.error('Error handling process content request:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to handle process content request.' // Provide default message
    });
  }
  // Return true to keep the message channel open for the asynchronous sendResponse
  return true;
}

/**
 * Handle API content processing request from message
 * @param {Object} message - Message object
 * @param {Function} sendResponse - Response function
 */
export async function handleProcessContentViaApiRequest(message, sendResponse) {
  try {
    const result = await processContentViaApi(message);
    sendResponse(result);
  } catch (error) {
    logger.background.error('Error in API content processing:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

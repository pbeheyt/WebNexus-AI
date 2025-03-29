// src/background/services/content-processing.js

import { determineContentType } from '../../shared/content-utils.js';
import { extractContent, checkYouTubeCommentsStatus, checkYouTubeTranscriptAvailability } from './content-extraction.js';
import { getPreferredPromptId, getPromptContentById } from './prompt-resolver.js';
import { getPreferredAiPlatform, openAiPlatformWithContent } from './platform-integration.js';
import { resetExtractionState, savePlatformTabInfo, trackQuickPromptUsage } from '../core/state-manager.js';
import { processContentViaApi } from '../api/api-coordinator.js';
import logger from '../../utils/logger.js';
import { STORAGE_KEYS } from '../../shared/constants.js';

/**
 * Process content using web AI interface (non-API path)
 * Used by popup to extract content and send to web UI
 * @param {Object} params - Processing parameters
 * @returns {Promise<Object>} Result information
 */
export async function processContent(params) {
  const { 
    tabId, 
    url, 
    promptId = null, 
    platformId = null, 
    commentAnalysisRequired = false,
    useApi = false
  } = params;
  
  try {
    logger.background.info('Starting web UI content processing', {
      tabId, url, promptId, platformId
    });
    
    // If API mode requested, use API path
    if (useApi) {
      return await processContentViaApi(params);
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
      
    // YouTube comments check (only if required by the prompt)
    const commentsError = checkYouTubeCommentsStatus(extractedContent, commentAnalysisRequired);
    if (commentsError) {
      return {
        success: false,
        ...commentsError
      };
    }
    
    // 4. Handle prompt resolution
    const effectivePromptId = promptId || await getPreferredPromptId(contentType);
    const promptContent = await getPromptContentById(effectivePromptId, contentType);
    
    if (!promptContent) {
      throw new Error(`Could not load prompt content for ID: ${effectivePromptId}`);
    }
    
    // Track quick prompt usage if needed
    if (effectivePromptId === 'quick') {
      await trackQuickPromptUsage(contentType);
    }
    
    // 5. Open AI platform with the content
    const effectivePlatformId = platformId || await getPreferredAiPlatform();
    
    const aiPlatformTabId = await openAiPlatformWithContent(contentType, effectivePromptId, effectivePlatformId);
    
    if (!aiPlatformTabId) {
      return {
        success: false,
        error: 'Failed to open AI platform tab'
      };
    }
    
    // Save tab information for later
    await savePlatformTabInfo(aiPlatformTabId, effectivePlatformId, promptContent);
    
    return {
      success: true,
      aiPlatformTabId,
      contentType
    };
  } catch (error) {
    logger.background.error('Error in processContent:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
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
    const { tabId, contentType, promptId, platformId, url, commentAnalysisRequired, useApi } = message;
    logger.background.info(`Process content request for tab ${tabId}`, {
      contentType, promptId, platformId, useApi
    });

    // Call appropriate processing function based on API flag
    const result = useApi
      ? await processContentViaApi(message)
      : await processContent(message);

    sendResponse(result);
  } catch (error) {
    logger.background.error('Error handling process content request:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
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

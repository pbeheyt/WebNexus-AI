// src/background/services/summarization.js - Core summarization logic

import { determineContentType } from '../../shared/content-utils.js';
import { extractContent, checkYouTubeCommentsStatus, checkYouTubeTranscriptAvailability } from './content-extraction.js';
import { getPreferredPromptId, getPromptContentById } from './prompt-resolver.js';
import { getPreferredAiPlatform, openAiPlatformWithContent } from './platform-integration.js';
import { resetExtractionState, savePlatformTabInfo, trackQuickPromptUsage } from '../core/state-manager.js';
import { summarizeContentViaApi } from '../api/api-coordinator.js';
import logger from '../../utils/logger.js';

/**
 * Centralized function to handle content summarization
 * @param {Object} params - Parameters object containing all necessary info for summarization
 * @returns {Promise<Object>} Result object with success/error information
 */
export async function summarizeContent(params) {
  const { 
    tabId, 
    url, 
    hasSelection = false, 
    promptId = null, 
    platformId = null, 
    commentAnalysisRequired = false,
    useApi = false
  } = params;
  
  try {
    logger.background.info('Starting centralized content summarization process', { ...params, useApi });
    
    // Check if we should use API mode
    if (useApi) {
      return await summarizeContentViaApi(params);
    }
    
    // 1. Reset previous state
    await resetExtractionState();
    logger.background.info('Cleared previous extracted content and tab state');
    
    // 2. Extract content
    const contentType = determineContentType(url, hasSelection);
    logger.background.info(`Content type determined: ${contentType}, hasSelection: ${hasSelection}`);
    
    const extractionResult = await extractContent(tabId, url, hasSelection);
    if (!extractionResult) {
      logger.background.warn('Content extraction completed with issues');
    }

    // 3. Get extracted content and check for specific errors
    const { extractedContent } = await chrome.storage.local.get('extractedContent');
    
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
    // If no promptId provided, use the preferred prompt for this content type
    const effectivePromptId = promptId || await getPreferredPromptId(contentType);
    
    // Get prompt content
    const promptContent = await getPromptContentById(effectivePromptId, contentType);
    
    if (!promptContent) {
      throw new Error(`Could not load prompt content for ID: ${effectivePromptId}`);
    }
    
    // Track quick prompt usage if needed
    if (effectivePromptId === 'quick') {
      await trackQuickPromptUsage(contentType);
    }
    
    // 5. Open AI platform with the content
    // If no platformId provided, use the preferred platform
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
    logger.background.error('Error in summarizeContent:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Handle summarize content request from message
 * @param {Object} message - Message object
 * @param {Function} sendResponse - Response function
 */
export async function handleSummarizeContentRequest(message, sendResponse) {
  try {
    const { tabId, contentType, promptId, platformId, url, hasSelection, commentAnalysisRequired, useApi } = message;
    logger.background.info(`Summarize content request from popup for tab ${tabId}, type: ${contentType}, promptId: ${promptId}, platform: ${platformId}, hasSelection: ${hasSelection}, useApi: ${useApi}`);

    // Call centralized summarization function with API mode parameter
    const result = await summarizeContent({
      tabId,
      url,
      hasSelection,
      promptId,
      platformId,
      commentAnalysisRequired,
      useApi // Pass through API mode flag
    });

    sendResponse(result);
  } catch (error) {
    logger.background.error('Error handling summarize content request:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle API summarization request from message
 * @param {Object} message - Message object
 * @param {Function} sendResponse - Response function
 */
export async function handleSummarizeContentViaApiRequest(message, sendResponse) {
  try {
    const result = await summarizeContentViaApi(message);
    sendResponse(result);
  } catch (error) {
    logger.background.error('Error in API summarization:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}
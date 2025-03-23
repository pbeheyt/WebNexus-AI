// src/background/services/content-extraction.js - Content extraction coordination

import { determineContentType } from '../../shared/content-utils.js';
import { STORAGE_KEYS } from '../../shared/constants.js';
import logger from '../../utils/logger.js';

/**
 * Extract content from a tab
 * @param {number} tabId - Tab ID to extract content from
 * @param {string} url - URL of the page
 * @param {boolean} hasSelection - Whether text is selected
 * @returns {Promise<boolean>} Success indicator
 */
export async function extractContent(tabId, url, hasSelection = false) {
  const contentType = determineContentType(url, hasSelection);
  // Use a single content script for all types
  const scriptFile = 'dist/content-script.bundle.js';

  logger.background.info(`Extracting content from tab ${tabId}, type: ${contentType}, hasSelection: ${hasSelection}`);
  
  // Check if content script is loaded
  let isScriptLoaded = false;
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { action: 'ping' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 300))
    ]);
    isScriptLoaded = !!(response && response.ready);
  } catch (error) {
    logger.background.info('Content script not loaded, will inject');
  }
  
  // Inject if needed
  if (!isScriptLoaded) {
    const result = await injectContentScript(tabId, scriptFile);
    if (!result) {
      logger.background.error(`Failed to inject content script`);
      return false;
    }
  }

  // Always reset previous extraction state
  try {
    await chrome.tabs.sendMessage(tabId, { 
      action: 'resetExtractor',
      hasSelection: hasSelection
    });
    logger.background.info('Reset command sent to extractor');
  } catch (error) {
    logger.background.error('Error sending reset command:', error);
  }
  
  // Return promise that resolves when content extraction completes
  return new Promise((resolve) => {
    const storageListener = (changes, area) => {
      if (area === 'local' && changes[STORAGE_KEYS.CONTENT_READY]?.newValue === true) {
        chrome.storage.onChanged.removeListener(storageListener);
        resolve(true);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    // Send extraction command
    chrome.tabs.sendMessage(tabId, {
      action: 'extractContent',
      hasSelection: hasSelection,
      contentType: contentType
    });

    // Failsafe timeout
    setTimeout(() => {
      chrome.storage.onChanged.removeListener(storageListener);
      logger.background.warn(`Extraction timeout for ${contentType}, proceeding anyway`);
      resolve(false);
    }, 15000);
  });
}

/**
 * Inject content script into tab
 * @param {number} tabId - Tab ID to inject into
 * @param {string} scriptFile - Script file to inject
 * @returns {Promise<boolean>} Success flag
 */
export async function injectContentScript(tabId, scriptFile) {
  try {
    logger.background.info(`Injecting script: ${scriptFile} into tab: ${tabId}`);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [scriptFile]
    });
    logger.background.info(`Successfully injected script: ${scriptFile} into tab: ${tabId}`);
    return true;
  } catch (error) {
    logger.background.error(`Script injection error for tab ${tabId}:`, error);
    return false;
  }
}

/**
 * Detect text selection in a tab
 * @param {number} tabId - Tab ID to check
 * @returns {Promise<boolean>} Whether text is selected
 */
export async function detectTextSelection(tabId) {
  try {
    const injectionResult = await chrome.scripting.executeScript({
      target: { tabId },
      function: () => window.getSelection().toString().trim().length > 0
    });
    
    if (injectionResult && injectionResult[0]) {
      const hasSelection = injectionResult[0].result;
      logger.background.info(`Selection detection result: ${hasSelection}`);
      return hasSelection;
    }
    return false;
  } catch (error) {
    logger.background.error('Error detecting selection:', error);
    return false;
  }
}

/**
 * Check if YouTube transcript is available
 * @param {Object} extractedContent - Extracted content object
 * @returns {Object|null} Error object if transcript not available, null otherwise
 */
export function checkYouTubeTranscriptAvailability(extractedContent) {
  if (extractedContent?.contentType === 'youtube' && 
      extractedContent?.error &&
      extractedContent?.transcript &&
      typeof extractedContent.transcript === 'string' &&
      (extractedContent.transcript.includes('No transcript') ||
       extractedContent.transcript.includes('Transcript is not available'))) {
    
    logger.background.warn('YouTube transcript error detected');
    
    return {
      youtubeTranscriptError: true,
      errorMessage: extractedContent.message || 'Failed to retrieve YouTube transcript.'
    };
  }
  
  return null;
}

/**
 * Check if YouTube comments are loaded
 * @param {Object} extractedContent - Extracted content object
 * @param {boolean} commentAnalysisRequired - Whether comment analysis is required
 * @returns {Object|null} Error object if comments not loaded, null otherwise
 */
export function checkYouTubeCommentsStatus(extractedContent, commentAnalysisRequired) {
  if (extractedContent?.contentType === 'youtube' && 
      commentAnalysisRequired &&
      extractedContent?.commentStatus?.state === 'not_loaded' &&
      extractedContent?.commentStatus?.commentsExist) {
      
    logger.background.warn('YouTube comments required but not loaded');
    
    // Notify popup if it's open
    try {
      chrome.runtime.sendMessage({
        action: 'youtubeCommentsNotLoaded'
      });
    } catch (error) {
      // Ignore message sending error if popup isn't open
    }
    
    return {
      youtubeCommentsError: true,
      errorMessage: extractedContent.commentStatus.message ||
                  'Comments exist but are not loaded. Scroll down on YouTube to load comments.'
    };
  }
  
  return null;
}
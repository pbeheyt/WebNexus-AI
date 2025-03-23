// src/background/core/state-manager.js - Background state management

import { STORAGE_KEYS } from '../../shared/constants.js';
import logger from '../../utils/logger.js';

/**
 * Reset state to initial values
 * @returns {Promise<void>}
 */
export async function resetState() {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SCRIPT_INJECTED]: false,
      [STORAGE_KEYS.AI_PLATFORM_TAB_ID]: null,
      [STORAGE_KEYS.CONTENT_READY]: false,
      [STORAGE_KEYS.EXTRACTED_CONTENT]: null,
      apiProcessingStatus: null,
      apiResponse: null,
      currentContentProcessingMode: null
    });
  } catch (error) {
    logger.background.error('Error resetting state:', error);
    throw error;
  }
}

/**
 * Reset extraction state
 * @returns {Promise<void>}
 */
export async function resetExtractionState() {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CONTENT_READY]: false,
      [STORAGE_KEYS.EXTRACTED_CONTENT]: null
    });
    logger.background.info('Extraction state reset');
  } catch (error) {
    logger.background.error('Error resetting extraction state:', error);
    throw error;
  }
}

/**
 * Save platform tab information
 * @param {number} tabId - Tab ID of the AI platform tab
 * @param {string} platformId - Platform identifier
 * @param {string} promptContent - Prompt content to use
 * @returns {Promise<boolean>} Success flag
 */
export async function savePlatformTabInfo(tabId, platformId, promptContent) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.AI_PLATFORM_TAB_ID]: tabId,
      aiPlatform: platformId,
      [STORAGE_KEYS.SCRIPT_INJECTED]: false,
      [STORAGE_KEYS.PRE_PROMPT]: promptContent
    });
    
    // Verify the data was stored correctly
    const verifyData = await chrome.storage.local.get([STORAGE_KEYS.AI_PLATFORM_TAB_ID, 'aiPlatform', STORAGE_KEYS.SCRIPT_INJECTED]);
    logger.background.info(`Storage verification: aiPlatformTabId=${verifyData.aiPlatformTabId}, aiPlatform=${verifyData.aiPlatform}, scriptInjected=${verifyData.scriptInjected}`);
    
    return true;
  } catch (error) {
    logger.background.error('Error saving platform tab info:', error);
    return false;
  }
}

/**
 * Update script injection status
 * @param {boolean} injected - Whether script was injected
 * @returns {Promise<void>}
 */
export async function updateScriptInjectionStatus(injected) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.SCRIPT_INJECTED]: injected });
    logger.background.info(`Updated script injection status: ${injected}`);
  } catch (error) {
    logger.background.error('Error updating script injection status:', error);
  }
}

/**
 * Save extracted content
 * @param {Object} content - Extracted content object
 * @returns {Promise<void>}
 */
export async function saveExtractedContent(content) {
  try {
    await chrome.storage.local.set({ 
      [STORAGE_KEYS.EXTRACTED_CONTENT]: content,
      [STORAGE_KEYS.CONTENT_READY]: true
    });
    logger.background.info('Extracted content saved');
  } catch (error) {
    logger.background.error('Error saving extracted content:', error);
  }
}

/**
 * Update API processing status
 * @param {string} status - Processing status
 * @param {string} platformId - Platform identifier
 * @returns {Promise<void>}
 */
export async function updateApiProcessingStatus(status, platformId) {
  try {
    await chrome.storage.local.set({
      apiProcessingStatus: status,
      currentContentProcessingMode: 'api',
      apiContentProcessingPlatform: platformId,
      apiContentProcessingTimestamp: Date.now()
    });
    logger.background.info(`API processing status updated: ${status}`);
  } catch (error) {
    logger.background.error('Error updating API processing status:', error);
  }
}

/**
 * Save API streaming response
 * @param {string} streamId - Stream identifier
 * @param {string} platformId - Platform identifier
 * @returns {Promise<void>}
 */
export async function initializeStreamResponse(streamId, platformId) {
  try {
    const initialResponse = {
      success: true,
      streamId,
      status: 'streaming',
      platformId,
      timestamp: Date.now(),
      content: '' // Will be populated as streaming progresses
    };

    await chrome.storage.local.set({
      apiProcessingStatus: 'streaming',
      apiResponse: initialResponse,
      streamContent: '',
      streamId
    });
    logger.background.info(`Stream response initialized: ${streamId}`);
  } catch (error) {
    logger.background.error('Error initializing stream response:', error);
  }
}

/**
 * Update stream content
 * @param {string} fullContent - Complete content so far
 * @returns {Promise<void>}
 */
export async function updateStreamContent(fullContent) {
  try {
    await chrome.storage.local.set({
      streamContent: fullContent
    });
  } catch (error) {
    logger.background.error('Error updating stream content:', error);
  }
}

/**
 * Complete stream response
 * @param {string} fullContent - Complete final content
 * @param {string} model - Model used
 * @param {string} platformId - Platform identifier
 * @returns {Promise<void>}
 */
export async function completeStreamResponse(fullContent, model, platformId) {
  try {
    const finalResponse = {
      success: true,
      status: 'completed',
      content: fullContent,
      model,
      platformId,
      timestamp: Date.now()
    };
    
    await chrome.storage.local.set({
      apiProcessingStatus: 'completed',
      apiResponse: finalResponse,
      apiResponseTimestamp: Date.now()
    });
    logger.background.info('Stream response completed');
    
    // Notify the popup if open
    try {
      chrome.runtime.sendMessage({
        action: 'apiResponseReady',
        response: finalResponse
      });
    } catch (error) {
      // Ignore if popup isn't open
      logger.background.info('Could not notify popup of API response completion');
    }
  } catch (error) {
    logger.background.error('Error completing stream response:', error);
  }
}

/**
 * Set API processing error
 * @param {string} error - Error message
 * @returns {Promise<void>}
 */
export async function setApiProcessingError(error) {
  try {
    await chrome.storage.local.set({
      apiProcessingStatus: 'error',
      apiProcessingError: error
    });
    logger.background.error('API processing error set:', error);
    
    // Notify popup if open
    try {
      chrome.runtime.sendMessage({
        action: 'apiProcessingError',
        error
      });
    } catch (msgError) {
      // Ignore if popup isn't open
    }
  } catch (err) {
    logger.background.error('Error setting API processing error:', err);
  }
}

/**
 * Track quick prompt usage
 * @param {string} contentType - Content type
 * @returns {Promise<void>}
 */
export async function trackQuickPromptUsage(contentType) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.QUICK_PROMPTS]: {
        contentType,
        timestamp: Date.now()
      }
    });
    logger.background.info(`Quick prompt usage tracked for: ${contentType}`);
  } catch (error) {
    logger.background.error('Error tracking quick prompt usage:', error);
  }
}

/**
 * Get stored content extraction
 * @returns {Promise<Object>} Extracted content
 */
export async function getExtractedContent() {
  try {
    const { extractedContent } = await chrome.storage.local.get(STORAGE_KEYS.EXTRACTED_CONTENT);
    return extractedContent;
  } catch (error) {
    logger.background.error('Error getting extracted content:', error);
    return null;
  }
}

/**
 * Get current AI platform tab information
 * @returns {Promise<Object>} Platform tab info
 */
export async function getPlatformTabInfo() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.AI_PLATFORM_TAB_ID, 'aiPlatform', STORAGE_KEYS.SCRIPT_INJECTED]);
    return {
      tabId: result.aiPlatformTabId,
      platformId: result.aiPlatform,
      scriptInjected: result.scriptInjected
    };
  } catch (error) {
    logger.background.error('Error getting platform tab info:', error);
    return {
      tabId: null,
      platformId: null,
      scriptInjected: false
    };
  }
}
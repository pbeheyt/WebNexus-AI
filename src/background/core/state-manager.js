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
      [STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID]: null,
      [STORAGE_KEYS.CONTENT_READY]: false,
      [STORAGE_KEYS.EXTRACTED_CONTENT]: null,
      [STORAGE_KEYS.API_PROCESSING_STATUS]: null,
      [STORAGE_KEYS.API_RESPONSE]: null,
      [STORAGE_KEYS.CURRENT_CONTENT_PROCESSING_MODE]: null,
      // Explicitly clear tab-specific items on major reset if desired
      [STORAGE_KEYS.TAB_FORMATTED_CONTENT]: {},
      [STORAGE_KEYS.TAB_SYSTEM_PROMPTS]: {},
      [STORAGE_KEYS.TAB_CONTENT_EXTRACTION_PREFERENCE]: {},
    });
    logger.background.info('Initial state reset');
  } catch (error) {
    logger.background.error('Error resetting state:', error);
    throw error;
  }
}

/**
 * Reset extraction state specifically
 * @returns {Promise<void>}
 */
export async function resetExtractionState() {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CONTENT_READY]: false,
      [STORAGE_KEYS.EXTRACTED_CONTENT]: null,
      // Don't clear formatted content here, only on preference change or tab close
    });
    logger.background.info('Extraction state reset');
  } catch (error) {
    logger.background.error('Error resetting extraction state:', error);
    throw error;
  }
}

/**
 * Save platform tab information (for Web UI injection)
 * @param {number} tabId - Tab ID of the AI platform tab
 * @param {string} platformId - Platform identifier
 * @param {string} promptContent - Prompt content to use
 * @returns {Promise<boolean>} Success flag
 */
export async function savePlatformTabInfo(tabId, platformId, promptContent) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID]: tabId,
      [STORAGE_KEYS.INJECTION_PLATFORM]: platformId,
      [STORAGE_KEYS.SCRIPT_INJECTED]: false, // Reset injection status for the new tab
      [STORAGE_KEYS.PRE_PROMPT]: promptContent
    });

    // Verify the data was stored correctly (optional, for debugging)
    const verifyData = await chrome.storage.local.get([
        STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID,
        STORAGE_KEYS.INJECTION_PLATFORM,
        STORAGE_KEYS.SCRIPT_INJECTED
    ]);
    logger.background.info(`Storage verification: aiPlatformTabId=${verifyData[STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID]}, aiPlatform=${verifyData[STORAGE_KEYS.INJECTION_PLATFORM]}, scriptInjected=${verifyData[STORAGE_KEYS.SCRIPT_INJECTED]}`);

    return true;
  } catch (error) {
    logger.background.error('Error saving platform tab info:', error);
    return false;
  }
}

/**
 * Update script injection status (for Web UI injection)
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
 * Save extracted content to local storage
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
 * Update API processing status and related info
 * @param {string} status - Processing status ('extracting', 'processing', 'streaming', 'completed', 'error')
 * @param {string} platformId - Platform identifier being used
 * @returns {Promise<void>}
 */
export async function updateApiProcessingStatus(status, platformId) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.API_PROCESSING_STATUS]: status,
      [STORAGE_KEYS.CURRENT_CONTENT_PROCESSING_MODE]: 'api', // Mark as API mode
      [STORAGE_KEYS.API_CONTENT_PROCESSING_PLATFORM]: platformId,
      [STORAGE_KEYS.API_CONTENT_PROCESSING_TIMESTAMP]: Date.now()
    });
    logger.background.info(`API processing status updated: ${status}`);
  } catch (error) {
    logger.background.error('Error updating API processing status:', error);
  }
}

/**
 * Initialize API streaming response state in storage
 * @param {string} streamId - Unique stream identifier
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
      [STORAGE_KEYS.API_PROCESSING_STATUS]: 'streaming',
      [STORAGE_KEYS.API_RESPONSE]: initialResponse,
      [STORAGE_KEYS.STREAM_CONTENT]: '', // Store accumulating stream content separately
      [STORAGE_KEYS.STREAM_ID]: streamId
    });
    logger.background.info(`Stream response initialized: ${streamId}`);
  } catch (error) {
    logger.background.error('Error initializing stream response:', error);
  }
}

/**
 * Update stream content during streaming (optional, consider performance)
 * @param {string} fullContent - Complete content so far
 * @returns {Promise<void>}
 */
export async function updateStreamContent(fullContent) {
  try {
    // Note: Frequent updates might impact performance. Consider updating less often or only on done.
    await chrome.storage.local.set({
      [STORAGE_KEYS.STREAM_CONTENT]: fullContent
    });
  } catch (error) {
    logger.background.error('Error updating stream content:', error);
  }
}

/**
 * Complete stream response state in storage
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
      [STORAGE_KEYS.API_PROCESSING_STATUS]: 'completed',
      [STORAGE_KEYS.API_RESPONSE]: finalResponse,
      [STORAGE_KEYS.API_RESPONSE_TIMESTAMP]: Date.now(),
      [STORAGE_KEYS.STREAM_CONTENT]: null, // Clear stream content
      [STORAGE_KEYS.STREAM_ID]: null // Clear stream ID
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
      logger.background.debug('Could not notify popup of API response completion (popup likely closed)');
    }
  } catch (error) {
    logger.background.error('Error completing stream response:', error);
  }
}

/**
 * Set API processing error state in storage
 * @param {string} errorMsg - Error message
 * @returns {Promise<void>}
 */
export async function setApiProcessingError(errorMsg) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.API_PROCESSING_STATUS]: 'error',
      [STORAGE_KEYS.API_PROCESSING_ERROR]: errorMsg,
      [STORAGE_KEYS.STREAM_ID]: null // Clear stream ID on error
    });
    logger.background.error('API processing error set:', errorMsg);

    // Notify popup if open
    try {
      chrome.runtime.sendMessage({
        action: 'apiProcessingError',
        error: errorMsg
      });
    } catch (msgError) {
      // Ignore if popup isn't open
    }
  } catch (err) {
    logger.background.error('Error setting API processing error state:', err);
  }
}

/**
 * Track quick prompt usage (legacy, might be removable if not used)
 * @param {string} contentType - Content type
 * @returns {Promise<void>}
 */
export async function trackQuickPromptUsage(contentType) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.QUICK_PROMPTS]: { // Note: This seems incorrect, should likely use a different key for tracking vs content
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
 * Get stored extracted content from local storage
 * @returns {Promise<Object|null>} Extracted content or null
 */
export async function getExtractedContent() {
  try {
    // Use specific key for extracted content
    const result = await chrome.storage.local.get(STORAGE_KEYS.EXTRACTED_CONTENT);
    return result[STORAGE_KEYS.EXTRACTED_CONTENT] || null;
  } catch (error) {
    logger.background.error('Error getting extracted content:', error);
    return null;
  }
}

/**
 * Get current AI platform tab information (for Web UI injection)
 * @returns {Promise<Object>} Platform tab info {tabId, platformId, scriptInjected}
 */
export async function getPlatformTabInfo() {
  try {
    const result = await chrome.storage.local.get([
        STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID,
        STORAGE_KEYS.INJECTION_PLATFORM,
        STORAGE_KEYS.SCRIPT_INJECTED
    ]);
    return {
      tabId: result[STORAGE_KEYS.INJECTION_PLATFORM_TAB_ID] || null,
      platformId: result[STORAGE_KEYS.INJECTION_PLATFORM] || null,
      scriptInjected: result[STORAGE_KEYS.SCRIPT_INJECTED] || false
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

/**
 * Clear stored formatted content for a specific tab.
 * Called when the user toggles the extraction preference.
 * @param {number} tabId - The ID of the tab to clear content for.
 * @returns {Promise<void>}
 */
export async function clearStoredFormattedContentForTab(tabId) {
    if (!tabId) {
        logger.background.warn('clearStoredFormattedContentForTab called without tabId.');
        return;
    }
    try {
        const key = STORAGE_KEYS.TAB_FORMATTED_CONTENT;
        const result = await chrome.storage.local.get(key);
        const allFormattedContent = result[key] || {};

        if (allFormattedContent[tabId]) {
            delete allFormattedContent[tabId];
            await chrome.storage.local.set({ [key]: allFormattedContent });
            logger.background.info(`Cleared stored formatted content for tab ${tabId} due to preference change.`);
        } else {
            logger.background.info(`No stored formatted content to clear for tab ${tabId}.`);
        }
    } catch (error) {
        logger.background.error(`Error clearing stored formatted content for tab ${tabId}:`, error);
        // Don't throw, just log.
    }
}
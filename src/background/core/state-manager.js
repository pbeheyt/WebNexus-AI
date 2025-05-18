// src/background/core/state-manager.js - Background state management

import { STORAGE_KEYS } from '../../shared/constants.js';
import { logger } from '../../shared/logger.js';

/**
 * Reset state to initial values
 * @returns {Promise<void>}
 */
export async function resetState() {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG]: false,
      [STORAGE_KEYS.WEBUI_INJECTION_TARGET_TAB_ID]: null,
      [STORAGE_KEYS.CONTENT_READY_FLAG]: false,
      [STORAGE_KEYS.EXTRACTED_CONTENT]: null,
      [STORAGE_KEYS.API_PROCESSING_STATUS]: null,
      [STORAGE_KEYS.API_RESPONSE]: null,
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
      [STORAGE_KEYS.CONTENT_READY_FLAG]: false,
      [STORAGE_KEYS.EXTRACTED_CONTENT]: null,
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
 * @param {string} formattedContentString - The formatted content string to save for injection.
 * @returns {Promise<boolean>} Success flag
 */
export async function savePlatformTabInfo(
  tabId,
  platformId,
  promptContent,
  formattedContentString
) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.WEBUI_INJECTION_TARGET_TAB_ID]: tabId,
      [STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID]: platformId,
      [STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG]: false,
      [STORAGE_KEYS.WEBUI_INJECTION_PROMPT_CONTENT]: promptContent,
      [STORAGE_KEYS.WEBUI_INJECTION_FORMATTED_CONTENT]: formattedContentString,
    });

    // Verify the data was stored correctly
    const verifyData = await chrome.storage.local.get([
      STORAGE_KEYS.WEBUI_INJECTION_TARGET_TAB_ID,
      STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID,
      STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG,
    ]);
    logger.background.info(
      `Storage verification: aiPlatformTabId=${verifyData[STORAGE_KEYS.WEBUI_INJECTION_TARGET_TAB_ID]}, aiPlatform=${verifyData[STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID]}, scriptInjected=${verifyData[STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG]}`
    );

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
    await chrome.storage.local.set({
      [STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG]: injected,
    });
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
      [STORAGE_KEYS.CONTENT_READY_FLAG]: true,
    });
    logger.background.info('Extracted content saved');
  } catch (error) {
    logger.background.error('Error saving extracted content:', error);
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
      content: '', // Will be populated as streaming progresses
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.API_PROCESSING_STATUS]: 'streaming',
      [STORAGE_KEYS.API_RESPONSE]: initialResponse,
      [STORAGE_KEYS.API_STREAM_ID]: streamId,
    });
    logger.background.info(`Stream response initialized: ${streamId}`);
  } catch (error) {
    logger.background.error('Error initializing stream response:', error);
  }
}

/**
 * Complete stream response
 * @param {string} fullContent - Complete final content
 * @param {string} model - Model used
 * @param {string} platformId - Platform identifier
 * @param {string|null} [error=null] - Optional error message if the stream failed
 * @returns {Promise<void>}
 */
export async function completeStreamResponse(
  fullContent,
  model,
  platformId,
  error = null
) {
  try {
    let finalResponse;
    let storageUpdate = {};

    if (error) {
      // Handle error case
      finalResponse = {
        success: false,
        status: 'error',
        content: fullContent, // Include content received before error
        model,
        platformId,
        error: error, // Include the error message
        timestamp: Date.now(),
      };
      storageUpdate = {
        [STORAGE_KEYS.API_PROCESSING_STATUS]: 'error',
        [STORAGE_KEYS.API_PROCESSING_ERROR]: error,
        [STORAGE_KEYS.API_RESPONSE]: finalResponse,
        [STORAGE_KEYS.API_RESPONSE_TIMESTAMP]: Date.now(),
      };
      logger.background.error(`Stream response completed with error: ${error}`);
    } else {
      // Handle success case
      finalResponse = {
        success: true,
        status: 'completed',
        content: fullContent,
        model,
        platformId,
        timestamp: Date.now(),
      };
      storageUpdate = {
        [STORAGE_KEYS.API_PROCESSING_STATUS]: 'completed',
        [STORAGE_KEYS.API_RESPONSE]: finalResponse,
        [STORAGE_KEYS.API_RESPONSE_TIMESTAMP]: Date.now(),
        [STORAGE_KEYS.API_PROCESSING_ERROR]: null,
      };
      logger.background.info('Stream response completed successfully');
    }

    // Update storage
    await chrome.storage.local.set(storageUpdate);

    // Notify the popup and potentially other listeners
    try {
      // Send the final response object
      chrome.runtime.sendMessage({
        action: 'apiResponseReady',
        response: finalResponse,
      });
    } catch (msgError) {
      // Ignore if popup isn't open or other listeners fail
      logger.background.info(
        'Could not notify listeners of API response completion/error:',
        msgError.message
      );
    }
  } catch (catchError) {
    logger.background.error(
      'Error in completeStreamResponse function:',
      catchError
    );
    // Attempt to set a generic error state if something goes wrong here
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.API_PROCESSING_STATUS]: 'error',
        [STORAGE_KEYS.API_PROCESSING_ERROR]:
          'Internal error completing stream response',
      });
    } catch (fallbackError) {
      logger.background.error(
        'Failed to set fallback error state:',
        fallbackError
      );
    }
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
      [STORAGE_KEYS.API_PROCESSING_STATUS]: 'error',
      [STORAGE_KEYS.API_PROCESSING_ERROR]: error,
    });
    logger.background.error('API processing error set:', error);

    // Notify popup if open
    try {
      chrome.runtime.sendMessage({
        action: 'apiProcessingError',
        error,
      });
    } catch (msgError) {
      // Ignore if popup isn't open
    }
  } catch (err) {
    logger.background.error('Error setting API processing error:', err);
  }
}

/**
 * Get stored content extraction
 * @returns {Promise<Object>} Extracted content
 */
    export async function getExtractedContent() {
      try {
        const storageResult = await chrome.storage.local.get(
          STORAGE_KEYS.EXTRACTED_CONTENT // This key's value is 'extracted_content'
        );
        const extractedContent = storageResult[STORAGE_KEYS.EXTRACTED_CONTENT]; // Access using the actual key string
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
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.WEBUI_INJECTION_TARGET_TAB_ID,
      STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID,
      STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG,
    ]);
    return {
      tabId: result[STORAGE_KEYS.WEBUI_INJECTION_TARGET_TAB_ID],
      platformId: result[STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID],
      scriptInjected: result[STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG],
    };
  } catch (error) {
    logger.background.error('Error getting platform tab info:', error);
    return {
      tabId: null,
      platformId: null,
      scriptInjected: false,
    };
  }
}

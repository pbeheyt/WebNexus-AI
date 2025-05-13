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
      [STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID_TAB_ID]: null,
      [STORAGE_KEYS.CONTENT_READY]: false,
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
 * Store or remove the system prompt for a specific tab.
 * If systemPrompt is a non-empty string, it's stored.
 * If systemPrompt is null, undefined, or empty, the entry for the tab is removed.
 * @param {number} tabId - Tab ID to use as key.
 * @param {string | null | undefined} systemPrompt - The system prompt string to store, or null/undefined/empty to remove.
 * @returns {Promise<void>}
 */
export async function storeSystemPromptForTab(tabId, systemPrompt) {
  if (typeof tabId !== 'number') {
    logger.background.warn(
      'storeSystemPromptForTab called with invalid tabId:',
      tabId
    );
    return;
  }

  const key = String(tabId);
  try {
    const result = await chrome.storage.local.get(
      STORAGE_KEYS.TAB_SYSTEM_PROMPTS
    );
    // Ensure we always work with an object, even if storage is empty/corrupt
    const allTabSystemPrompts =
      result[STORAGE_KEYS.TAB_SYSTEM_PROMPTS] &&
      typeof result[STORAGE_KEYS.TAB_SYSTEM_PROMPTS] === 'object'
        ? { ...result[STORAGE_KEYS.TAB_SYSTEM_PROMPTS] } // Create a mutable copy
        : {};

    // Check if the provided prompt is a valid, non-empty string
    if (typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
      // Store the valid prompt
      if (allTabSystemPrompts[key] !== systemPrompt) {
        // Only update if changed
        allTabSystemPrompts[key] = systemPrompt;
        logger.background.info(
          `Stored/Updated system prompt for tab ${tabId}.`
        );
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_SYSTEM_PROMPTS]: allTabSystemPrompts,
        });
      } else {
        logger.background.info(
          `System prompt for tab ${tabId} is unchanged. No storage update needed.`
        );
      }
    } else {
      // If prompt is invalid (null, undefined, empty), remove the key if it exists
        if (Object.hasOwn(allTabSystemPrompts, key)) {
        delete allTabSystemPrompts[key];
        logger.background.info(
          `Removed system prompt entry for tab ${tabId} as new prompt is absent/empty.`
        );
        // Save the modified object back (only if a key was actually deleted)
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_SYSTEM_PROMPTS]: allTabSystemPrompts,
        });
      } else {
        // Key doesn't exist, nothing to remove, no storage update needed.
        logger.background.info(
          `No system prompt entry to remove for tab ${tabId}.`
        );
      }
    }
  } catch (error) {
    logger.background.error(
      `Error updating system prompt state for tab ${tabId}:`,
      error
    );
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
      [STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID_TAB_ID]: tabId,
      [STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID]: platformId,
      [STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG]: false,
      [STORAGE_KEYS.WEBUI_INJECTION_PROMPT_CONTENT]: promptContent,
      [STORAGE_KEYS.WEBUI_INJECTION_FORMATTED_CONTENT]: formattedContentString,
    });

    // Verify the data was stored correctly
    const verifyData = await chrome.storage.local.get([
      STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID_TAB_ID,
      STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID,
      STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG,
    ]);
    logger.background.info(
      `Storage verification: aiPlatformTabId=${verifyData[STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID_TAB_ID]}, aiPlatform=${verifyData[STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID]}, scriptInjected=${verifyData[STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG]}`
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
      [STORAGE_KEYS.CONTENT_READY]: true,
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
      [STORAGE_KEYS.STREAM_ID]: streamId,
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
 * Check if formatted content exists for a specific tab.
 * Assumes content is stored under STORAGE_KEYS.TAB_FORMATTED_CONTENT
 * with tab IDs as keys.
 * @param {number} tabId - The ID of the tab to check.
 * @returns {Promise<boolean>} True if formatted content exists, false otherwise.
 */
export async function hasFormattedContentForTab(tabId) {
  if (typeof tabId !== 'number') {
    logger.background.warn(
      'hasFormattedContentForTab called with invalid tabId:',
      tabId
    );
    return false;
  }
  const key = String(tabId); // Ensure key is a string if needed
  try {
    // Note: The original request mentioned STORAGE_KEYS.TAB_FORMATTED_CONTENT
    // Adjust this key if the actual storage key is different.
    const result = await chrome.storage.local.get(
      STORAGE_KEYS.TAB_FORMATTED_CONTENT
    );
    const allFormattedContent = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT];

    if (
      allFormattedContent &&
      typeof allFormattedContent === 'object' &&
        Object.hasOwn(allFormattedContent, key)
    ) {
      logger.background.info(`Formatted content found for tab ${tabId}.`);
      return true;
    } else {
      logger.background.info(`No formatted content found for tab ${tabId}.`);
      return false;
    }
  } catch (error) {
    logger.background.error(
      `Error checking formatted content for tab ${tabId}:`,
      error
    );
    return false; // Assume no content on error
  }
}

/**
 * Store formatted content in local storage by tab ID.
 * Assumes content is stored under STORAGE_KEYS.TAB_FORMATTED_CONTENT
 * with tab IDs as keys.
 * @param {number} tabId - Tab ID to use as key.
 * @param {string} formattedContent - The formatted content string to store.
 * @returns {Promise<void>}
 */
export async function storeFormattedContentForTab(tabId, formattedContent) {
  if (typeof tabId !== 'number') {
    logger.background.warn(
      'storeFormattedContentForTab called with invalid tabId:',
      tabId
    );
    return;
  }
  if (typeof formattedContent !== 'string') {
    logger.background.warn(
      'storeFormattedContentForTab called with non-string content for tabId:',
      tabId
    );
    return;
  }

  const key = String(tabId);
  try {
    const result = await chrome.storage.local.get(
      STORAGE_KEYS.TAB_FORMATTED_CONTENT
    );
    const allFormattedContent =
      result[STORAGE_KEYS.TAB_FORMATTED_CONTENT] || {};

    allFormattedContent[key] = formattedContent;

    await chrome.storage.local.set({
      [STORAGE_KEYS.TAB_FORMATTED_CONTENT]: allFormattedContent,
    });
    logger.background.info(`Stored formatted content for tab ${tabId}.`);
  } catch (error) {
    logger.background.error(
      `Error storing formatted content for tab ${tabId}:`,
      error
    );
    throw error; // Re-throw error for the caller to handle
  }
}

/**
 * Get formatted content for a specific tab.
 * Assumes content is stored under STORAGE_KEYS.TAB_FORMATTED_CONTENT
 * with tab IDs as keys.
 * @param {number} tabId - The ID of the tab to retrieve content for.
 * @returns {Promise<string|null>} The formatted content string, or null if not found or on error.
 */
/**
 * Set the context sent flag for a specific tab
 * @param {number} tabId - The tab ID to set the flag for
 * @param {boolean} sent - Whether context has been sent
 * @returns {Promise<void>}
 */
export async function setTabContextSentFlag(tabId, sent) {
  if (typeof tabId !== 'number') {
    logger.background.warn(
      'setTabContextSentFlag called with invalid tabId:',
      tabId
    );
    return;
  }

  const tabIdStr = String(tabId);
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG);
    const flags = result[STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG] || {};
    
    flags[tabIdStr] = sent;
    
    await chrome.storage.local.set({
      [STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG]: flags
    });
    logger.background.info(`Set context sent flag for tab ${tabId} to ${sent}`);
  } catch (error) {
    logger.background.error(
      `Error setting context sent flag for tab ${tabId}:`,
      error
    );
  }
}

/**
 * Get the context sent flag for a specific tab
 * @param {number} tabId - The tab ID to check
 * @returns {Promise<boolean>} Whether context has been sent for this tab
 */
export async function getTabContextSentFlag(tabId) {
  if (typeof tabId !== 'number') {
    logger.background.warn(
      'getTabContextSentFlag called with invalid tabId:',
      tabId
    );
    return false;
  }

  const tabIdStr = String(tabId);
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG);
    const flags = result[STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG];
    
    if (flags && typeof flags === 'object') {
      return Boolean(flags[tabIdStr]);
    }
    return false;
  } catch (error) {
    logger.background.error(
      `Error getting context sent flag for tab ${tabId}:`,
      error
    );
    return false;
  }
}

export async function getFormattedContentForTab(tabId) {
  if (typeof tabId !== 'number') {
    logger.background.warn(
      'getFormattedContentForTab called with invalid tabId:',
      tabId
    );
    return null;
  }
  const key = String(tabId);
  try {
    const result = await chrome.storage.local.get(
      STORAGE_KEYS.TAB_FORMATTED_CONTENT
    );
    const allFormattedContent = result[STORAGE_KEYS.TAB_FORMATTED_CONTENT];

    if (
      allFormattedContent &&
      typeof allFormattedContent === 'object' &&
        Object.hasOwn(allFormattedContent, key)
    ) {
      logger.background.info(`Retrieved formatted content for tab ${tabId}.`);
      return allFormattedContent[key]; // Return the stored string
    } else {
      logger.background.info(
        `No formatted content found for tab ${tabId} during retrieval.`
      );
      return null;
    }
  } catch (error) {
    logger.background.error(
      `Error retrieving formatted content for tab ${tabId}:`,
      error
    );
    return null; // Return null on error
  }
}

/**
 * Get stored content extraction
 * @returns {Promise<Object>} Extracted content
 */
export async function getExtractedContent() {
  try {
    const { extractedContent } = await chrome.storage.local.get(
      STORAGE_KEYS.EXTRACTED_CONTENT
    );
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
      STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID_TAB_ID,
      STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID,
      STORAGE_KEYS.WEBUI_INJECTION_SCRIPT_INJECTED_FLAG,
    ]);
    return {
      tabId: result[STORAGE_KEYS.WEBUI_INJECTION_PLATFORM_ID_TAB_ID],
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

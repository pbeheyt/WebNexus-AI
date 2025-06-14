// src/background/services/content-processing.js - Content processing

import {
  determineContentType,
  isInjectablePage,
} from '../../shared/utils/content-utils.js';
import {
  resetExtractionState,
  savePlatformTabInfo,
} from '../core/state-manager.js';
import { processContentViaApi } from '../api/api-coordinator.js';
import { logger } from '../../shared/logger.js';
import { STORAGE_KEYS, CONTENT_TYPE_LABELS } from '../../shared/constants.js';
import ContentFormatter from '../../services/ContentFormatter.js';

import { openAiPlatformWithContent } from './platform-integration.js';
import { extractContent } from './content-extraction.js';

/**
 * Internal function to handle all Web UI processing, including shortcuts and context menus.
 * Contains centralized logic for prompt resolution, platform selection, and user feedback via notifications.
 * This function is not exported.
 * @param {Object} tab - Browser tab object.
 * @param {string|null} [promptId=null] - The ID of a specific prompt to use. If null, the default prompt is used.
 * @returns {Promise<void>}
 */
async function _processViaWebUI(tab, promptId = null) {
  if (!tab || !tab.id || !tab.url) {
    logger.background.error('_processViaWebUI: Missing tab information.');
    return;
  }

  try {
    const selectionResult = await chrome.storage.local.get(
      STORAGE_KEYS.TAB_SELECTION_STATES
    );
    const selectionStates =
      selectionResult[STORAGE_KEYS.TAB_SELECTION_STATES] || {};
    const hasSelection = !!selectionStates[tab.id];

    const contentType = determineContentType(tab.url, hasSelection);
    logger.background.info(
      `Determined content type: ${contentType} for URL: ${tab.url}`
    );

    const promptsResult = await chrome.storage.local.get(
      STORAGE_KEYS.USER_CUSTOM_PROMPTS
    );
    const promptsByType =
      promptsResult[STORAGE_KEYS.USER_CUSTOM_PROMPTS] || {};
    const typeData = promptsByType[contentType] || {};

    let promptToUse = null;
    if (promptId) {
      // Use a specific prompt if an ID is provided
      promptToUse = typeData[promptId];
      logger.background.info(`Attempting to use specific prompt ID: ${promptId}`);
    } else {
      // Otherwise, find and use the default prompt for the content type
      const defaultPromptId = typeData['_defaultPromptId_'];
      if (defaultPromptId) {
        promptToUse = typeData[defaultPromptId];
        logger.background.info(`Found default prompt ID: ${defaultPromptId}`);
      }
    }

    if (!promptToUse || !promptToUse.content) {
      const contentTypeLabel =
        CONTENT_TYPE_LABELS[contentType] || 'this content';
      const errorMessage = promptId
        ? `Prompt with ID ${promptId} not found for "${contentTypeLabel}".`
        : `No default prompt is configured for "${contentTypeLabel}". Please set one in settings.`;

      logger.background.warn(errorMessage);

      // Provide user feedback via notification for the silent failure case
      chrome.notifications.create('prompt-config-error', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/logo_128.png'),
        title: 'WebNexus AI Action Failed',
        message: errorMessage,
      });
      return;
    }

    const promptContent = promptToUse.content;
    logger.background.info(
      `Found prompt content (length: ${promptContent.length}).`
    );

    const platformResult = await chrome.storage.sync.get(
      STORAGE_KEYS.POPUP_DEFAULT_PLATFORM_ID
    );
    const platformId =
      platformResult[STORAGE_KEYS.POPUP_DEFAULT_PLATFORM_ID] || 'chatgpt';
    logger.background.info(`Using platform: ${platformId} for Web UI flow.`);

    logger.background.info(
      `Calling processContent for tab ${tab.id} via _processViaWebUI.`
    );
    await processContent({
      tabId: tab.id,
      url: tab.url,
      platformId: platformId,
      promptContent: promptContent,
      useApi: false,
      includeContext: true,
      contentType: contentType,
    });
  } catch (error) {
    logger.background.error('Error in _processViaWebUI:', error);
    chrome.notifications.create('generic-processing-error', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/logo_128.png'),
      title: 'WebNexus AI Error',
      message:
        'An unexpected error occurred while processing your request. Please check the console for details.',
    });
  }
}

/**
 * Process content with default prompt in Web UI.
 * @param {Object} tab - Browser tab object
 * @returns {Promise<void>}
 */
export async function processWithDefaultPromptWebUI(tab) {
  await _processViaWebUI(tab, null); // Call the centralized function with no specific promptId
}

/**
 * Handle get content type request from message
 * @param {Object} message - Message object
 * @param {Object} sender - Sender of the message
 * @param {Function} sendResponse - Response function
 */
export function handleGetContentTypeRequest(message, _sender, sendResponse) {
  const contentType = determineContentType(message.url, message.hasSelection);
  sendResponse({ contentType });
  return false;
}

/**
 * Process content with a specific prompt from the context menu in Web UI.
 * @param {Object} tab - Browser tab object.
 * @param {string} promptId - The ID of the prompt to use.
 * @returns {Promise<void>}
 */
export async function processWithSpecificPromptWebUI(tab, promptId) {
  await _processViaWebUI(tab, promptId); // Call the centralized function with the specific promptId
}

/**
 * Process content using web AI interface (non-API path)
 * Used by popup to extract content and send to web UI
 * @param {Object} params - Processing parameters
 * @returns {Promise<Object>} Result information { success: boolean, aiPlatformTabId?: number, contentType?: string, error?: string, code?: string }
 */
export async function processContent(params) {
  const {
    tabId,
    platformId = null,
    promptContent = null,
    useApi = false,
    includeContext,
    contentType, // Receive contentType from params
  } = params;

  let formattedContentString = null; // Initialize to null

  try {
    logger.background.info('Starting web UI content processing', {
      tabId,
      url: params.url,
      platformId,
      includeContext,
      contentType, // Log received contentType
    });

    // If API mode requested, use API path
    if (useApi) {
      return await processContentViaApi(params); // API path handles context internally if needed
    }

    // --- Context Handling Logic ---
    if (includeContext) {
      logger.background.info(
        'Include context requested, proceeding with extraction.'
      );
      // Check if page is injectable BEFORE attempting extraction
      if (!isInjectablePage(params.url)) {
        logger.background.warn(
          `processContent: Page is not injectable (${params.url}). Skipping extraction despite request.`
        );
        // Return specific error if context was requested but page isn't injectable
        return {
          success: false,
          error:
            'Content extraction not supported on this page, but context was requested.',
          code: 'EXTRACTION_NOT_SUPPORTED',
        };
      }

      // 1. Reset previous state (Only if extracting)
      await resetExtractionState();

      // 2. Extract content (Only if extracting)
      logger.background.info(`Content type determined: ${contentType}`);
      const extractionResult = await extractContent(
        tabId,
        params.url,
        contentType
      );
      if (!extractionResult) {
        logger.background.warn('Content extraction completed with issues');
      }

      // 3. Get extracted content (Only if extracting)
      const storageResult = await chrome.storage.local.get(
        STORAGE_KEYS.EXTRACTED_CONTENT // This key's value is 'extracted_content'
      );
      const extractedContent =
        storageResult[STORAGE_KEYS.EXTRACTED_CONTENT]; // Access using the actual key string

      if (!extractedContent) {
        logger.background.error(
          'processContent: Failed to retrieve extracted content from storage after extraction attempt.'
        );
        // Consider returning error or proceeding with null content
        return {
          success: false,
          error: 'Failed to extract content from the page.',
        };
      }

      // 4. Format content (Only if extracting and content exists)
      // Assign to the outer scope variable
      formattedContentString = ContentFormatter.formatContent(
        extractedContent,
        contentType
      );
    } else {
      logger.background.info(
        'Include context not requested, skipping extraction.'
      );
      // formattedContentString is already null from initialization
    }

    // --- Continue with the rest of the function ---

    // Check for prompt content (should happen regardless of context)
    if (!promptContent) {
      logger.background.warn('processContent: No prompt content provided.');
      return {
        success: false,
        error: 'No prompt content provided.',
      };
    }

    // 5. Get platform and open it with content (or just prompt)
    const effectivePlatformId = platformId;

    const aiPlatformTabId =
      await openAiPlatformWithContent(effectivePlatformId);

    if (!aiPlatformTabId) {
      logger.background.error(
        `processContent: Failed to open AI platform tab for ${effectivePlatformId}.`
      );
      // Return failure object directly
      return {
        success: false,
        error: `Failed to open the ${effectivePlatformId} platform tab.`,
      };
    }

    // Save tab information for later, using the potentially null formattedContentString
    await savePlatformTabInfo(
      aiPlatformTabId,
      effectivePlatformId,
      promptContent,
      formattedContentString
    );

    // Determine contentType only if context was included, otherwise it's irrelevant
    const finalContentType = includeContext ? contentType : null;

    return {
      success: true,
      aiPlatformTabId,
      contentType: finalContentType, // Return null if context wasn't included
    };
  } catch (error) {
    logger.background.error('Error during web UI content processing:', error);
    // Ensure consistent failure object structure
    return {
      success: false,
      error:
        error.message || 'An unknown error occurred during content processing.',
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
    // Destructure includeContext along with other properties
    const { tabId, platformId, useApi, includeContext } = message;
    logger.background.info(`Process content request for tab ${tabId}`, {
      platformId,
      useApi,
      includeContext, // Log includeContext as well
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
      error: error.message || 'Failed to handle process content request.', // Provide default message
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
      error: error.message,
    });
  }
}

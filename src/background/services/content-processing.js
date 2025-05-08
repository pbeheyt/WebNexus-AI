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
import { STORAGE_KEYS } from '../../shared/constants.js';
import ContentFormatter from '../../services/ContentFormatter.js';

import { openAiPlatformWithContent } from './platform-integration.js';
import { extractContent } from './content-extraction.js';

/**
 * Process content with default prompt in Web UI
 * @param {Object} tab - Browser tab object
 * @returns {Promise<void>}
 */
export async function processWithDefaultPromptWebUI(tab) {
  if (!tab || !tab.id || !tab.url) {
    logger.background.error(
      'processWithDefaultPromptWebUI: Missing tab information.'
    );
    return;
  }

  try {
    const contentType = determineContentType(tab.url);
    logger.background.info(
      `Determined content type: ${contentType} for URL: ${tab.url}`
    );

    // 1. Get the default prompt ID for this content type
    const defaultsResult = await chrome.storage.local.get(
      STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE
    );
    const defaultPrompts =
      defaultsResult[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};
    const defaultPromptId = defaultPrompts[contentType];

    if (!defaultPromptId) {
      logger.background.warn(
        `No default prompt set for content type: ${contentType}. Aborting quick process.`
      );
      return;
    }
    logger.background.info(`Found default prompt ID: ${defaultPromptId}`);

    // 2. Get the actual prompt content
    const promptsResult = await chrome.storage.local.get(
      STORAGE_KEYS.CUSTOM_PROMPTS
    );
    const promptsByType = promptsResult[STORAGE_KEYS.CUSTOM_PROMPTS] || {};
        const promptObject = promptsByType[contentType]?.[defaultPromptId];

    if (!promptObject || !promptObject.content) {
      logger.background.error(
        `Default prompt object or content not found for ID: ${defaultPromptId} under type ${contentType}`
      );
      return;
    }
    const promptContent = promptObject.content;
    logger.background.info(
      `Found default prompt content (length: ${promptContent.length}).`
    );

    // 3. Get the last used popup platform
    const platformResult = await chrome.storage.sync.get(
      STORAGE_KEYS.POPUP_PLATFORM
    );
    const platformId = platformResult[STORAGE_KEYS.POPUP_PLATFORM] || 'chatgpt';
    logger.background.info(`Using platform: ${platformId} for popup flow.`);

    // 4. Call processContent
    logger.background.info(
      `Calling processContent for tab ${tab.id} with default prompt.`
    );
    await processContent({
      tabId: tab.id,
      url: tab.url,
      platformId: platformId,
      promptContent: promptContent,
      useApi: false, // Explicitly use the Web UI interaction flow
      includeContext: true, // Always include context for default processing
    });
    logger.background.info(
      `processContent call initiated via default prompt processing.`
    );
  } catch (error) {
    logger.background.error('Error in processWithDefaultPromptWebUI:', error);
    throw error; // Re-throw to allow callers to handle
  }
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
  } = params;

  let formattedContentString = null; // Initialize to null

  try {
    logger.background.info('Starting web UI content processing', {
      tabId,
      url: params.url,
      platformId,
      includeContext,
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
      const contentType = determineContentType(params.url);
      logger.background.info(`Content type determined: ${contentType}`);
      const extractionResult = await extractContent(tabId, params.url);
      if (!extractionResult) {
        logger.background.warn('Content extraction completed with issues');
      }

      // 3. Get extracted content (Only if extracting)
      const { extractedContent } = await chrome.storage.local.get(
        STORAGE_KEYS.EXTRACTED_CONTENT
      );

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
    const finalContentType = includeContext ? determineContentType(params.url) : null;

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

import logger from '../../shared/logger.js';
import { determineContentType } from '../../shared/utils/content-utils.js';
import { processContent } from '../services/content-processing.js';
import { STORAGE_KEYS } from '../../shared/constants.js';

/**
 * Handles clicks on the context menu item.
 */
async function handleContextMenuClick(info, tab) {
  if (info.menuItemId === 'nexusai-quick-process') {
    logger.background.info('Context menu clicked:', { menuItemId: info.menuItemId, tabId: tab?.id, url: tab?.url });
    if (!tab || !tab.id || !tab.url) {
      logger.background.error('Context menu click missing tab information.');
      return;
    }

    try {
      const contentType = determineContentType(tab.url);
      logger.background.info(`Determined content type: ${contentType} for URL: ${tab.url}`);

      // 1. Get the default prompt ID for this content type
      const defaultsResult = await chrome.storage.sync.get(STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE);
      const defaultPrompts = defaultsResult[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};
      const defaultPromptId = defaultPrompts[contentType];

      if (!defaultPromptId) {
        logger.background.warn(`No default prompt set for content type: ${contentType}. Aborting quick process.`);
        return;
      }
      logger.background.info(`Found default prompt ID: ${defaultPromptId}`);

      // 2. Get the actual prompt content
      const promptsResult = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
      const promptsByType = promptsResult[STORAGE_KEYS.CUSTOM_PROMPTS] || {};
      const promptObject = promptsByType[contentType]?.prompts?.[defaultPromptId];

      if (!promptObject || !promptObject.content) {
        logger.background.error(`Default prompt object or content not found for ID: ${defaultPromptId} under type ${contentType}`);
        return;
      }
      const promptContent = promptObject.content;
      logger.background.info(`Found default prompt content (length: ${promptContent.length}).`);

      // 3. Get the last used popup platform
      const platformResult = await chrome.storage.sync.get(STORAGE_KEYS.POPUP_PLATFORM);
      const platformId = platformResult[STORAGE_KEYS.POPUP_PLATFORM] || 'chatgpt'; // Ensure a default exists
      logger.background.info(`Using platform: ${platformId} for popup flow.`);

      // 4. Call processContent
      logger.background.info(`Calling processContent for tab ${tab.id} with default prompt.`);
      await processContent({
        tabId: tab.id,
        url: tab.url,
        platformId: platformId,
        promptContent: promptContent,
        useApi: false // Explicitly use the Web UI interaction flow
      });
      logger.background.info(`processContent call initiated via context menu.`);

    } catch (error) {
      logger.background.error('Error handling context menu action:', error);
    }
  }
}

/**
 * Sets up the listener for context menu item clicks.
 */
export function setupContextMenuListener() {
  // Ensure the contextMenus API is available before adding listener
  if (chrome.contextMenus && chrome.contextMenus.onClicked) {
    // Use the handleContextMenuClick function defined in this file
    chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
    logger.background.info('Context menu click listener registered.');
  } else {
    logger.background.error('Context Menus API not available, cannot register click listener.');
  }
}

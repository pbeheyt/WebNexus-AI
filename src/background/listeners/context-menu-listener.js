import { logger } from '../../shared/logger.js';
import {
  processWithSpecificPromptWebUI,
} from '../services/content-processing.js';

/**
 * Handles clicks on the context menu item.
 */
async function handleContextMenuClick(info, tab) {
  // Handle clicks on dynamically created prompt items
  if (info.menuItemId.startsWith('prompt-item-')) {
    const promptId = info.menuItemId.replace('prompt-item-', '');
    logger.background.info(`Context menu prompt [${promptId}] clicked:`, {
      tabId: tab?.id,
      url: tab?.url,
    });

    if (!tab || !tab.id || !tab.url) {
      logger.background.error('Context menu click missing tab information.');
      return;
    }

    try {
      await processWithSpecificPromptWebUI(tab, promptId);
    } catch (error) {
      logger.background.error(
        `Error handling context menu action for prompt ${promptId}:`,
        error
      );
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
    logger.background.error(
      'Context Menus API not available, cannot register click listener.'
    );
  }
}

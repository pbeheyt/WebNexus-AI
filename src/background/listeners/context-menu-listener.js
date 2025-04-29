import logger from '../../shared/logger.js';
import { processWithDefaultPromptWebUI } from '../services/content-processing.js';

/**
 * Handles clicks on the context menu item.
 */
async function handleContextMenuClick(info, tab) {
  if (info.menuItemId === 'menu-quick-process') {
    logger.background.info('Context menu clicked:', {
      menuItemId: info.menuItemId,
      tabId: tab?.id,
      url: tab?.url,
    });
    if (!tab || !tab.id || !tab.url) {
      logger.background.error('Context menu click missing tab information.');
      return;
    }

    try {
      await processWithDefaultPromptWebUI(tab);
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
    logger.background.error(
      'Context Menus API not available, cannot register click listener.'
    );
  }
}

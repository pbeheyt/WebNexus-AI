// src/background/listeners/contextmenu-listener.js - Context menu actions

import { toggleSidebar } from '../services/sidebar-manager.js';
import logger from '../../shared/logger.js';

const CONTEXT_MENU_ID = "open-sidebar-context";

/**
 * Handle context menu item clicks
 * @param {Object} info - Information about the clicked menu item
 * @param {Object} tab - The tab where the click occurred
 */
async function handleContextMenuClick(info, tab) {
  if (info.menuItemId === CONTEXT_MENU_ID) {
    logger.background.info(`Context menu "${CONTEXT_MENU_ID}" clicked for tab ${tab.id}`);
    try {
      // Construct message and sender objects similar to how toggleSidebar expects them
      const message = { tabId: tab.id, visible: true }; // Explicitly open
      const sender = { tab: tab };
      const sendResponse = (response) => {
        if (!response?.success) {
          logger.background.error('Context menu toggleSidebar failed:', response);
        } else {
           logger.background.info(`Context menu toggleSidebar succeeded for tab ${tab.id}`);
        }
      };

      // Call toggleSidebar to open the sidebar
      await toggleSidebar(message, sender, sendResponse);

    } catch (error) {
      logger.background.error(`Error handling context menu click for tab ${tab.id}:`, error);
    }
  }
}

/**
 * Set up the context menu listener
 */
export function setupContextMenuListener() {
  // Ensure listener is not added multiple times (optional safeguard)
  if (!chrome.contextMenus.onClicked.hasListener(handleContextMenuClick)) {
     chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
     logger.background.info('Context menu listener initialized');
  }
}

// src/background/listeners/contextmenu-listener.js - Context menu actions

import { toggleNativeSidePanel } from '../services/sidebar-manager.js'; // Updated import
import logger from '../../shared/logger.js';

const CONTEXT_MENU_ID = "open-sidebar-context"; // Keep the same ID for now

/**
 * Handle context menu item clicks
 * @param {Object} info - Information about the clicked menu item
 * @param {Object} tab - The tab where the click occurred
 */
async function handleContextMenuClick(info, tab) {
  if (info.menuItemId === CONTEXT_MENU_ID) {
    logger.background.info(`Context menu "${CONTEXT_MENU_ID}" clicked for tab ${tab.id}`);
    try {
      // Construct message and sender objects. Do not send 'visible'.
      const message = { tabId: tab.id };
      const sender = { tab: tab };
      const sendResponse = async (response) => { // Make callback async
        if (response && response.success) {
          logger.background.info(`Context menu toggleNativeSidePanel succeeded for tab ${tab.id}. State: ${response.visible}`);
          // If enabled, open it from the user gesture context
          if (response.visible) {
            try {
              await chrome.sidePanel.open({ tabId: tab.id });
              logger.background.info(`Opened side panel via context menu for tab ${tab.id}.`);
            } catch (openError) {
              logger.background.error(`Error opening side panel via context menu for tab ${tab.id}:`, openError);
            }
          }
        } else {
          logger.background.error('Context menu toggleNativeSidePanel failed:', response);
        }
      };

      // Call toggleNativeSidePanel to enable the side panel
      await toggleNativeSidePanel(message, sender, sendResponse);

    } catch (error) {
      logger.background.error(`Error handling native side panel context menu click for tab ${tab.id}:`, error);
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

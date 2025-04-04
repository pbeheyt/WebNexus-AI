// src/background/services/theme-service.js - Theme synchronization services

import { STORAGE_KEYS } from '../../shared/constants.js';
import logger from '../../shared/logger.js';

/**
 * Handle theme operation requests
 * @param {Object} message - Message with operation details
 * @param {Function} sendResponse - Response function
 */
export async function handleThemeOperation(message, sendResponse) {
  try {
    const { action, theme } = message;
    
    switch (action) {
      case 'getTheme':
        const result = await chrome.storage.sync.get(STORAGE_KEYS.THEME_PREFERENCE);
        sendResponse({
          success: true,
          theme: result[STORAGE_KEYS.THEME_PREFERENCE] || 'light'
        });
        break;
        
      case 'setTheme':
        if (!theme) {
          throw new Error('Theme value is required for setTheme operation');
        }
        
        await chrome.storage.sync.set({ [STORAGE_KEYS.THEME_PREFERENCE]: theme });
        
        // Notify only tabs with active sidebars about theme change
        const sidebarStateResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEBAR_STATES);
        const sidebarStates = sidebarStateResult[STORAGE_KEYS.TAB_SIDEBAR_STATES] || {};
        const targetTabIds = [];

        for (const [tabIdStr, isVisible] of Object.entries(sidebarStates)) {
          if (isVisible) {
            const tabId = parseInt(tabIdStr, 10);
            // Basic check if parsing was successful (tab IDs should always be numbers)
            if (!isNaN(tabId)) {
              targetTabIds.push(tabId);
            } else {
              logger.background.warn(`Invalid tab ID found in sidebar states: ${tabIdStr}`);
            }
          }
        }

        for (const tabId of targetTabIds) {
          try {
            await chrome.tabs.sendMessage(tabId, { action: 'themeUpdated', theme });
          } catch (error) {
            if (error.message && (error.message.includes('Could not establish connection') || error.message.includes('Receiving end does not exist'))) {
              logger.background.warn(`Could not send theme update to active sidebar tab ${tabId}: Receiving end does not exist.`);
            } else {
              logger.background.error(`Failed to send theme update to active sidebar tab ${tabId}:`, error);
            }
          }
        }
        
        sendResponse({
          success: true,
          theme
        });
        break;
        
      default:
        throw new Error(`Unknown theme operation: ${action}`);
    }
  } catch (error) {
    logger.background.error('Error in theme operation:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// src/background/services/theme-service.js - Theme synchronization services

import { STORAGE_KEYS } from '../../shared/constants.js';
import logger from '../../utils/logger.js';

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
        
        // Notify all tabs about theme change
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'themeUpdated',
              theme
            });
          } catch (error) {
            // Ignore errors for tabs without content scripts
            logger.background.debug(`Could not send theme update to tab ${tab.id}`);
          }
        });
        
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
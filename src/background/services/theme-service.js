// src/background/services/theme-service.js - Theme synchronization services

import { STORAGE_KEYS } from '../../shared/constants.js';
import { logger } from '../../shared/logger.js';

/**
 * Handle theme operation requests
 * @param {Object} message - Message with operation details
 * @param {Function} sendResponse - Response function
 */
export async function handleThemeOperation(message, _sender, sendResponse) {
  try {
    const { action, theme } = message;

    switch (action) {
      case 'getTheme': {
        const result = await chrome.storage.sync.get(
          STORAGE_KEYS.THEME_PREFERENCE
        );
        sendResponse({
          success: true,
          theme: result[STORAGE_KEYS.THEME_PREFERENCE] || 'light',
        });
        break;
      }
      case 'setTheme': {
        if (!theme) {
          throw new Error('Theme value is required for setTheme operation');
        }

        await chrome.storage.sync.set({
          [STORAGE_KEYS.THEME_PREFERENCE]: theme,
        });

        // The chrome.storage.onChanged event is the single source of truth for theme updates.
        // The UIService in each UI component (popup, sidepanel, settings) listens for this event
        // and updates the theme automatically.
        sendResponse({
          success: true,
          theme,
        });
        break;
      }
      default:
        throw new Error(`Unknown theme operation: ${action}`);
    }
  } catch (error) {
    logger.background.error('Error in theme operation:', error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

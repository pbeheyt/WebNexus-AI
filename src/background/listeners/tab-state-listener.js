// src/background/listeners/tab-state-listener.js
import { STORAGE_KEYS } from '../../shared/constants.js';
import SidebarStateManager from '../../services/SidebarStateManager.js';
import logger from '../../utils/logger.js';

// List of all storage keys that are tab-specific and need cleanup
const TAB_SPECIFIC_KEYS = [
  STORAGE_KEYS.TAB_FORMATTED_CONTENT,
  STORAGE_KEYS.TAB_PLATFORM_PREFERENCES, 
  STORAGE_KEYS.TAB_MODEL_PREFERENCES,
  STORAGE_KEYS.TAB_SIDEBAR_STATES,
  STORAGE_KEYS.TAB_CHAT_HISTORIES,
  STORAGE_KEYS.TAB_TOKEN_STATISTICS
];

/**
 * Clean up a specific tab-based storage item
 * @param {string} storageKey - The storage key to clean up
 * @param {number} tabId - Tab ID to remove (for single tab cleanup)
 * @param {Set<number>} [validTabIds] - Set of valid tab IDs (for periodic cleanup)
 * @returns {Promise<boolean>} - True if changes were made, false otherwise
 */
async function cleanupTabStorage(storageKey, tabId, validTabIds = null) {
  try {
    // Get the current storage data
    const storageData = await chrome.storage.local.get(storageKey);
    if (!storageData[storageKey]) {
      return false;
    }

    const updatedData = { ...storageData[storageKey] };
    let hasChanges = false;

    if (validTabIds) {
      // Periodic cleanup mode: Remove all invalid tabs
      for (const tabIdStr of Object.keys(updatedData)) {
        const currTabId = parseInt(tabIdStr, 10);
        if (!validTabIds.has(currTabId)) {
          delete updatedData[tabIdStr];
          hasChanges = true;
        }
      }
    } else {
      // Single tab cleanup mode: Remove specific tab
      if (updatedData[tabId]) {
        delete updatedData[tabId];
        hasChanges = true;
      }
    }

    // Save changes if needed
    if (hasChanges) {
      await chrome.storage.local.set({
        [storageKey]: updatedData
      });
      
      // Log what happened
      if (validTabIds) {
        logger.background.info(`Cleaned up stale data for ${storageKey}`);
      } else {
        logger.background.info(`Removed ${storageKey} data for tab ${tabId}`);
      }
    }

    return hasChanges;
  } catch (error) {
    logger.background.error(`Error cleaning up ${storageKey}:`, error);
    return false;
  }
}

/**
 * Set up tab state cleanup listeners
 */
export function setupTabStateListener() {
  // Clean up tab states when tabs are closed
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    logger.background.info(`Tab ${tabId} closed, cleaning up tab-specific state`);

    try {
      // Clean up all tab-specific storage keys
      for (const storageKey of TAB_SPECIFIC_KEYS) {
        await cleanupTabStorage(storageKey, tabId);
      }
    } catch (error) {
      logger.background.error('Error cleaning up tab-specific data:', error);
    }

    // Run existing sidebar state cleanup
    SidebarStateManager.cleanupTabStates();
  });

  // Periodically clean up tab states to prevent storage bloat
  setInterval(async () => {
    try {
      // Get all valid tabs
      const tabs = await chrome.tabs.query({});
      const validTabIds = new Set(tabs.map(tab => tab.id));

      // Clean up all tab-specific storage keys
      for (const storageKey of TAB_SPECIFIC_KEYS) {
        await cleanupTabStorage(storageKey, null, validTabIds);
      }

      // Run existing cleanup routine
      SidebarStateManager.cleanupTabStates();
    } catch (error) {
      logger.background.error('Error in periodic tab state cleanup:', error);
    }
  }, 3600000); // Every hour

  logger.background.info('Tab state listener initialized with comprehensive tab-specific cleanup');
}
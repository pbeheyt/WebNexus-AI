// src/background/listeners/tab-state-listener.js
import { STORAGE_KEYS } from '../../shared/constants.js';
import SidebarStateManager from '../../services/SidebarStateManager.js';
import logger from '../../shared/logger.js';

// List of tab-specific storage keys to clear on refresh (excluding sidebar visibility)
const TAB_SPECIFIC_DATA_KEYS_TO_CLEAR = [
  STORAGE_KEYS.TAB_CHAT_HISTORIES,
  STORAGE_KEYS.TAB_TOKEN_STATISTICS,
  STORAGE_KEYS.TAB_SYSTEM_PROMPTS,
  STORAGE_KEYS.TAB_MODEL_PREFERENCES,
  STORAGE_KEYS.TAB_PLATFORM_PREFERENCES,
  STORAGE_KEYS.TAB_FORMATTED_CONTENT,
  // Note: TAB_SIDEBAR_STATES is intentionally excluded to preserve visibility state.
];

// List of all storage keys that are tab-specific and need cleanup (used for onRemoved/periodic cleanup)
// Note: This includes TAB_SIDEBAR_STATES which is handled by SidebarStateManager.cleanupTabStates
const ALL_TAB_SPECIFIC_KEYS_FOR_CLEANUP = [
  STORAGE_KEYS.TAB_FORMATTED_CONTENT,
  STORAGE_KEYS.TAB_PLATFORM_PREFERENCES,
  STORAGE_KEYS.TAB_MODEL_PREFERENCES,
  STORAGE_KEYS.TAB_SIDEBAR_STATES,
  STORAGE_KEYS.TAB_CHAT_HISTORIES,
  STORAGE_KEYS.TAB_TOKEN_STATISTICS,
  STORAGE_KEYS.TAB_SYSTEM_PROMPTS
];

/**
 * Clears specified storage data for a single tab.
 * Used for the manual refresh action.
 * @param {number} tabId - The ID of the tab to clear data for.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function clearSingleTabData(tabId) {
  if (typeof tabId !== 'number') {
    logger.background.error('clearSingleTabData called with invalid tabId:', tabId);
    return false;
  }
  const tabIdStr = tabId.toString();
  logger.background.info(`Clearing specific data for tab ${tabIdStr}...`);

  try {
    for (const storageKey of TAB_SPECIFIC_DATA_KEYS_TO_CLEAR) {
      const result = await chrome.storage.local.get(storageKey);
      const data = result[storageKey];

      if (data && typeof data === 'object' && data[tabIdStr] !== undefined) {
        logger.background.info(`Found data for key ${storageKey} for tab ${tabIdStr}. Deleting...`);
        delete data[tabIdStr];
        await chrome.storage.local.set({ [storageKey]: data });
        logger.background.info(`Cleared ${storageKey} for tab ${tabIdStr}.`);
      } else {
         logger.background.info(`No data found for key ${storageKey} for tab ${tabIdStr}. Skipping.`);
      }
    }
    logger.background.info(`Successfully cleared specified data for tab ${tabIdStr}.`);
    return true;
  } catch (error) {
    logger.background.error(`Error clearing data for tab ${tabIdStr}:`, error);
    return false;
  }
}

/**
 * Handles the 'clearTabData' message request.
 * @param {object} message - The message object containing the tabId.
 * @param {chrome.runtime.MessageSender} sender - The sender of the message.
 * @param {function} sendResponse - Function to call to send the response.
 * @returns {boolean} - True to indicate an asynchronous response.
 */
export function handleClearTabDataRequest(message, sender, sendResponse) {
  if (!message.tabId) {
    logger.background.error('handleClearTabDataRequest called without tabId');
    sendResponse({ success: false, error: 'Missing tabId' });
    return false; // Return false as sendResponse is called synchronously here
  }

  // Call the async function and handle the promise explicitly
  clearSingleTabData(message.tabId)
    .then(success => {
      if (success) {
        logger.background.info(`handleClearTabDataRequest successful for tab ${message.tabId}, sending success response.`);
        sendResponse({ success: true });
      } else {
        logger.background.warn(`handleClearTabDataRequest failed for tab ${message.tabId}, sending failure response.`);
        sendResponse({ success: false, error: 'Failed to clear tab data in background' });
      }
    })
    .catch(error => {
      logger.background.error('Error during clearSingleTabData execution in handler:', error);
      sendResponse({ success: false, error: 'Internal error during tab data clearing' });
    });

  return true; // Keep channel open for async response
}

/**
 * Clean up a specific tab-based storage item (used for automatic cleanup)
 * @param {string} storageKey - The storage key to clean up
 * @param {number} tabId - Tab ID to remove (for single tab cleanup on close)
 * @param {Set<number>} [validTabIds] - Set of valid tab IDs (for periodic cleanup)
 * @returns {Promise<boolean>} - True if changes were made, false otherwise
 */
async function cleanupTabStorage(storageKey, tabId, validTabIds = null) {
  try {
    // Get the current storage data
    const storageData = await chrome.storage.local.get(storageKey);
    if (!storageData[storageKey]) {
      return false; // No data for this key, no changes needed
    }

    const currentData = storageData[storageKey];
    let updatedData = { ...currentData }; // Create a mutable copy
    let hasChanges = false;

    if (validTabIds) {
      // Periodic cleanup mode (onStartup/initialLoad): Remove all invalid tabs
      for (const tabIdStr of Object.keys(updatedData)) {
        const currTabId = parseInt(tabIdStr, 10);
        if (isNaN(currTabId) || !validTabIds.has(currTabId)) { // Also handle potential NaN keys
          delete updatedData[tabIdStr];
          hasChanges = true;
        }
      }
    } else if (tabId) {
      // Single tab cleanup mode (onRemoved): Remove specific tab
      const tabIdStr = tabId.toString();
      if (updatedData.hasOwnProperty(tabIdStr)) {
        delete updatedData[tabIdStr];
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
        logger.background.info(`Cleaned up stale data for ${storageKey}.`);
      } else {
        logger.background.info(`Removed ${storageKey} data for tab ${tabId}.`);
      }
    }

    return hasChanges;
  } catch (error) {
    logger.background.error(`Error cleaning up ${storageKey}:`, error);
    return false;
  }
}


/**
 * Set up tab state cleanup listeners (Handles onRemoved)
 */
export function setupTabStateListener() {
  // Clean up tab states when tabs are closed
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    logger.background.info(`Tab ${tabId} closed, cleaning up tab-specific state via onRemoved.`);

    try {
      // Clean up all tab-specific storage keys using the broader list
      for (const storageKey of ALL_TAB_SPECIFIC_KEYS_FOR_CLEANUP) {
         // Don't let the general cleanup function handle sidebar state directly here,
         // SidebarStateManager.cleanupTabStates() below handles it more robustly.
         if (storageKey !== STORAGE_KEYS.TAB_SIDEBAR_STATES) {
            await cleanupTabStorage(storageKey, tabId); // Pass tabId for single removal
         }
      }
    } catch (error) {
      logger.background.error('Error cleaning up tab-specific data on tab removal:', error);
    }

    // Use SidebarStateManager to specifically clean its state for the removed tab
    SidebarStateManager.cleanupTabStates([tabId]); // Pass removed tabId for targeted cleanup

    // Also disable the side panel for the closed tab, if it was enabled
    logger.background.info(`Attempting to disable side panel for closed tab ${tabId}`);
    chrome.sidePanel.setOptions({ tabId, enabled: false })
      .catch(err => {
        // Log warning, but don't throw - tab might already be gone or panel wasn't open
        logger.background.warn(`Failed to disable side panel for closed tab ${tabId}:`, err.message);
      });
  });

  // HOURLY CLEANUP REMOVED
  logger.background.info('Tab state listener initialized (cleanup onRemoved only).');
}

/**
 * Performs cleanup of stale tab-specific data from storage.
 * Iterates through known tab-specific keys and removes entries for tabs that no longer exist.
 * (This function is now called on startup and initial load)
 */
export async function performStaleTabCleanup() { // Keep this function exported
  logger.background.info('Running stale tab data cleanup...');
  try {
    // Get all valid tabs
    const tabs = await chrome.tabs.query({});
    const validTabIds = new Set(tabs.map(tab => tab.id));

    // Clean up all tab-specific storage keys using the broader list
    for (const storageKey of ALL_TAB_SPECIFIC_KEYS_FOR_CLEANUP) {
       // Don't let the general cleanup function handle sidebar state directly here,
       // SidebarStateManager.cleanupTabStates() below handles it more robustly.
       if (storageKey !== STORAGE_KEYS.TAB_SIDEBAR_STATES) {
          await cleanupTabStorage(storageKey, null, validTabIds); // Pass validTabIds for multi-removal
       }
    }

    // Use SidebarStateManager to clean its state based on valid IDs
    SidebarStateManager.cleanupTabStates(null, validTabIds); // Pass validTabIds for periodic cleanup
    logger.background.info('Stale tab data cleanup completed.');
  } catch (error) {
    logger.background.error('Error during stale tab data cleanup:', error);
  }
}

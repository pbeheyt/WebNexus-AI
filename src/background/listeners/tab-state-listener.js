// src/background/listeners/tab-state-listener.js

import { STORAGE_KEYS } from '../../shared/constants.js';
import SidePanelStateManager from '../../services/SidePanelStateManager.js';
import { logger } from '../../shared/logger.js';

// List of tab-specific storage keys to clear on manual refresh (excluding sidepanel visibility)
const TAB_SPECIFIC_DATA_KEYS_TO_CLEAR = [
  STORAGE_KEYS.TAB_CHAT_HISTORIES,
  STORAGE_KEYS.TAB_TOKEN_STATISTICS,
  STORAGE_KEYS.TAB_SYSTEM_PROMPTS,
  STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG,
  STORAGE_KEYS.TAB_MODEL_PREFERENCES,
  STORAGE_KEYS.TAB_PLATFORM_PREFERENCES,
  STORAGE_KEYS.TAB_FORMATTED_CONTENT,
  // Note: TAB_SIDEPANEL_STATES is intentionally excluded to preserve visibility state during manual refresh.
];

// List of all storage keys that are tab-specific and need automatic cleanup (used for onRemoved/periodic cleanup)
// This includes TAB_SIDEPANEL_STATES which is handled by SidePanelStateManager.cleanupTabStates
const ALL_TAB_SPECIFIC_KEYS_FOR_CLEANUP = [
  STORAGE_KEYS.TAB_FORMATTED_CONTENT,
  STORAGE_KEYS.TAB_CONTEXT_SENT_FLAG,
  STORAGE_KEYS.TAB_PLATFORM_PREFERENCES,
  STORAGE_KEYS.TAB_MODEL_PREFERENCES,
  STORAGE_KEYS.TAB_SIDEPANEL_STATES, // Included for the loop, but handled separately
  STORAGE_KEYS.TAB_CHAT_HISTORIES,
  STORAGE_KEYS.TAB_TOKEN_STATISTICS,
  STORAGE_KEYS.TAB_SYSTEM_PROMPTS,
];

/**
 * Clears specified storage data for a single tab.
 * Used for the manual refresh action initiated from the UI.
 * @param {number} tabId - The ID of the tab to clear data for.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function clearSingleTabData(tabId) {
  if (typeof tabId !== 'number') {
    logger.background.error(
      'clearSingleTabData called with invalid tabId:',
      tabId
    );
    return false;
  }
  const tabIdStr = tabId.toString();
  logger.background.info(`Clearing specific data for tab ${tabIdStr}...`);

  try {
    for (const storageKey of TAB_SPECIFIC_DATA_KEYS_TO_CLEAR) {
      // Use the manual refresh list
      const result = await chrome.storage.local.get(storageKey);
      const data = result[storageKey];

      if (data && typeof data === 'object' && data[tabIdStr] !== undefined) {
        logger.background.info(
          `Found data for key ${storageKey} for tab ${tabIdStr}. Deleting...`
        );
        delete data[tabIdStr];
        await chrome.storage.local.set({ [storageKey]: data });
        logger.background.info(`Cleared ${storageKey} for tab ${tabIdStr}.`);
      } else {
        logger.background.info(
          `No data found for key ${storageKey} for tab ${tabIdStr}. Skipping.`
        );
      }
    }
    logger.background.info(
      `Successfully cleared specified data for tab ${tabIdStr}.`
    );
    return true;
  } catch (error) {
    logger.background.error(`Error clearing data for tab ${tabIdStr}:`, error);
    return false;
  }
}

/**
 * Handles the 'clearTabData' message request from the UI (e.g., sidepanel refresh button).
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
    .then((success) => {
      if (success) {
        logger.background.info(
          `handleClearTabDataRequest successful for tab ${message.tabId}, sending success response.`
        );
        sendResponse({ success: true });
      } else {
        logger.background.warn(
          `handleClearTabDataRequest failed for tab ${message.tabId}, sending failure response.`
        );
        sendResponse({
          success: false,
          error: 'Failed to clear tab data in background',
        });
      }
    })
    .catch((error) => {
      logger.background.error(
        'Error during clearSingleTabData execution in handler:',
        error
      );
      sendResponse({
        success: false,
        error: 'Internal error during tab data clearing',
      });
    });

  return true; // Keep channel open for async response
}

/**
 * Clean up a specific tab-based storage item. Used internally by automatic cleanup processes.
 * @param {string} storageKey - The storage key to clean up (e.g., STORAGE_KEYS.TAB_CHAT_HISTORIES).
 * @param {number|null} tabId - Tab ID to remove (for single tab cleanup on close). If null, uses validTabIds.
 * @param {Set<number>|null} [validTabIds=null] - Set of currently open tab IDs (for periodic cleanup). If null, uses tabId.
 * @returns {Promise<boolean>} - True if changes were made, false otherwise.
 */
async function cleanupTabStorage(storageKey, tabId, validTabIds = null) {
  try {
    // Get the current storage data for the specified key
    const storageData = await chrome.storage.local.get(storageKey);
    if (
      !storageData[storageKey] ||
      typeof storageData[storageKey] !== 'object'
    ) {
      return false; // No data or invalid data structure for this key, no changes needed
    }

    const currentData = storageData[storageKey];
    let updatedData = { ...currentData }; // Create a mutable copy to modify
    let hasChanges = false;

    if (validTabIds instanceof Set) {
      // Periodic Cleanup Mode (onStartup / Service Worker Wake-up) ---
      // Remove entries for tabs that are NOT in the validTabIds set.
      for (const storedTabIdStr of Object.keys(updatedData)) {
        const storedTabId = parseInt(storedTabIdStr, 10);
        // Check if the stored ID is valid number AND if it's NOT present in the set of currently open tabs
        if (isNaN(storedTabId) || !validTabIds.has(storedTabId)) {
          delete updatedData[storedTabIdStr]; // Delete data for the closed/invalid tab
          hasChanges = true;
          logger.background.info(
            `Periodic cleanup: Removed stale ${storageKey} data for tab ID ${storedTabIdStr}`
          );
        }
        // If the storedTabId *is* in validTabIds, it's kept.
      }
    } else if (typeof tabId === 'number') {
      // Single Tab Cleanup Mode (onRemoved) ---
      // Remove the entry specifically for the closed tab ID.
      const tabIdStr = tabId.toString();
        if (Object.hasOwn(updatedData, tabIdStr)) {
        delete updatedData[tabIdStr];
        hasChanges = true;
        logger.background.info(
          `onRemoved cleanup: Removed ${storageKey} data for tab ${tabIdStr}.`
        );
      }
    } else {
      // Invalid parameters for cleanup mode
      logger.background.warn(
        `cleanupTabStorage called with invalid parameters for ${storageKey}. Mode ambiguity.`
      );
      return false;
    }

    // Save changes back to storage only if modifications were made
    if (hasChanges) {
      await chrome.storage.local.set({
        [storageKey]: updatedData,
      });
      logger.background.info(
        `Successfully saved updated data for ${storageKey} after cleanup.`
      );
    }

    return hasChanges;
  } catch (error) {
    logger.background.error(`Error cleaning up ${storageKey}:`, error);
    return false; // Indicate failure on error
  }
}

/**
 * Set up tab state cleanup listeners (Handles tab removal).
 */
export function setupTabStateListener() {
  // Clean up tab states when tabs are closed
  chrome.tabs.onRemoved.addListener(
    async (tabId /* removedTabId */, removeInfo) => {
      // Check if the browser window is closing; if so, onStartup cleanup will handle it later.
      if (removeInfo.isWindowClosing) {
        logger.background.info(
          `Window closing, skipping onRemoved cleanup for tab ${tabId}. Startup cleanup will handle.`
        );
        return;
      }

      logger.background.info(
        `Tab ${tabId} closed, cleaning up tab-specific state via onRemoved.`
      );

      try {
        // Clean up all general tab-specific storage keys
        for (const storageKey of ALL_TAB_SPECIFIC_KEYS_FOR_CLEANUP) {
          // Skip sidepanel state in this loop; handled separately below.
          if (storageKey !== STORAGE_KEYS.TAB_SIDEPANEL_STATES) {
            await cleanupTabStorage(storageKey, tabId, null); // Pass tabId for single removal, validTabIds=null
          }
        }
        logger.background.info(
          `General tab data cleanup completed for closed tab ${tabId}.`
        );

        // Use SidePanelStateManager to specifically clean its state for the removed tab
        await SidePanelStateManager.setSidePanelVisibilityForTab(tabId, false); // This will now delete the key if it exists
        logger.background.info(
          `Sidepanel state (visibility set to false/key removed) for closed tab ${tabId}.`
        );
      } catch (error) {
        logger.background.error(
          `Error cleaning up tab-specific data on tab removal (tabId: ${tabId}):`,
          error
        );
      }

      // Also attempt to disable the side panel for the closed tab, if it was enabled.
      // This might fail if the tab is truly gone, so catch errors gracefully.
      logger.background.info(
        `Attempting to disable side panel for closed tab ${tabId}`
      );
      try {
        await chrome.sidePanel.setOptions({ tabId: tabId, enabled: false });
        logger.background.info(
          `Successfully requested side panel disable for closed tab ${tabId}.`
        );
      } catch (err) {
        // Log warning, but don't throw - tab might already be gone or panel wasn't open/relevant
        logger.background.warn(
          `Could not disable side panel for closed tab ${tabId} (likely expected):`,
          err.message
        );
      }
    }
  );

  logger.background.info('Tab state listener initialized (cleanup onRemoved).');
}

/**
 * Performs cleanup of stale tab-specific data from storage based on currently open tabs.
 * Iterates through known tab-specific keys and removes entries for tabs that no longer exist.
 * This function is called on browser startup and service worker initialization.
 */
export async function performStaleTabCleanup() {
  logger.background.info('Running stale tab data cleanup...');
  try {
    // Get all currently open tabs
    const tabs = await chrome.tabs.query({});
    const validTabIds = new Set(tabs.map((tab) => tab.id)); // Set of IDs for open tabs
    logger.background.info(`Found ${validTabIds.size} currently open tabs.`);

    // Clean up all general tab-specific storage keys based on the valid IDs
    for (const storageKey of ALL_TAB_SPECIFIC_KEYS_FOR_CLEANUP) {
      // Skip sidepanel state in this loop; handled separately below.
      if (storageKey !== STORAGE_KEYS.TAB_SIDEPANEL_STATES) {
        await cleanupTabStorage(storageKey, null, validTabIds); // Pass validTabIds for periodic removal, tabId=null
      }
    }
    logger.background.info(
      `General stale tab data cleanup processing completed.`
    );

    // Use SidePanelStateManager to clean its state based on valid IDs
        await SidePanelStateManager.cleanupTabStates(); // Call without arguments
        logger.background.info(`SidePanelStateManager stale state cleanup completed.`);

    logger.background.info('Stale tab data cleanup finished successfully.');
  } catch (error) {
    logger.background.error(
      'Error during stale tab data cleanup execution:',
      error
    );
  }
}

// src/background/listeners/tab-state-listener.js

import SidePanelStateManager from '../../services/SidePanelStateManager.js';
import ChatHistoryService from '../../sidepanel/services/ChatHistoryService.js';
import { logger } from '../../shared/logger.js';
import { STORAGE_KEYS } from '../../shared/constants';

import { debouncedUpdateContextMenuForTab } from './context-menu-listener.js';

/**
 * Resets the UI state for a single tab, effectively preparing it for a new chat session.
 * Used for the manual refresh action initiated from the UI.
 * @param {number} tabId - The ID of the tab to reset UI state for.
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
  logger.background.info(`Resetting tab UI state for tab ${tabId} for a new chat...`);

  try {
    // Get current visibility to preserve it, or assume true if resetting
    const currentTabState = await SidePanelStateManager.getTabUIState(tabId);
    await SidePanelStateManager.setTabUIVisibility(tabId, currentTabState.isVisible); // This sets the visibility part
    await SidePanelStateManager.setActiveChatSessionForTab(tabId, null); // Clear active session
    await SidePanelStateManager.setTabViewMode(tabId, 'chat'); // Reset view to chat
    

    logger.background.info(
      `Successfully reset tab UI state for tab ${tabId}.`
    );
    return true;
  } catch (error) {
    logger.background.error(`Error resetting tab UI state for tab ${tabId}:`, error);
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
/**
 * Updates the selection state for a specific tab in storage.
 * @param {number} tabId - The ID of the tab to update.
 * @param {boolean} hasSelection - The new selection state.
 * @returns {Promise<void>}
 */
export async function updateTabSelectionState(tabId, hasSelection) {
  if (typeof tabId !== 'number') {
    logger.background.error('updateTabSelectionState called with invalid tabId:', tabId);
    return;
  }
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_SELECTION_STATES);
    const selectionStates = result[STORAGE_KEYS.TAB_SELECTION_STATES] || {};

    if (hasSelection) {
      // Add or update the key only if it's not already true, to avoid unnecessary writes
      if (selectionStates[tabId] !== true) {
        selectionStates[tabId] = true;
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_SELECTION_STATES]: selectionStates,
        });
      }
    } else {
      // Delete the key if selection is lost and the key exists
      if (selectionStates[tabId]) {
        delete selectionStates[tabId];
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_SELECTION_STATES]: selectionStates,
        });
      }
    }
  } catch (error) {
    logger.background.error(`Error updating selection state for tab ${tabId}:`, error);
  }
}

export async function handleUpdateSelectionStatusRequest(
  message,
  sender,
  sendResponse
) {
  if (sender.tab && sender.tab.id) {
    // Update the selection state in storage
    await updateTabSelectionState(sender.tab.id, message.hasSelection);
    // Crucially, now update the context menu based on the new selection state
    if (sender.tab) {
      debouncedUpdateContextMenuForTab(sender.tab);
    }
  }
  sendResponse({ success: true }); // Acknowledge receipt
}

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
        `Tab ${tabId} closed, performing immediate cleanup via onRemoved.`
      );

      try {
        // --- Immediate Sidepanel State Cleanup ---
        // Completely remove the state object for the closed tab.
        await SidePanelStateManager.removeTabUIState(tabId);

        // --- Provisional Chat Session Cleanup ---
        // This logic remains important for cleaning up unsaved chats.
        try {
          const tabUIState = await SidePanelStateManager.getTabUIState(tabId);
          const activeChatSessionId = tabUIState?.activeChatSessionId;

          if (activeChatSessionId) {
            logger.background.info(`Tab ${tabId} closed, checking active session ${activeChatSessionId} for provisional cleanup.`);
            const sessionMetadata = await ChatHistoryService.getSessionMetadata(activeChatSessionId);
            if (sessionMetadata && sessionMetadata.isProvisional === true) {
              logger.background.info(`Active session ${activeChatSessionId} for closed tab ${tabId} is provisional. Deleting.`);
              await ChatHistoryService.deleteChatSession(activeChatSessionId);
            } else if (sessionMetadata) {
              logger.background.info(`Active session ${activeChatSessionId} for closed tab ${tabId} is not provisional. No cleanup needed for session itself.`);
            } else {
              logger.background.warn(`Could not retrieve metadata for session ${activeChatSessionId} associated with closed tab ${tabId}.`);
            }
          }
        } catch (cleanupError) {
          logger.background.error(`Error during provisional session cleanup for closed tab ${tabId}:`, cleanupError);
        }

        // --- Immediate Selection State Cleanup ---
        // Unconditionally remove the key for the closed tab.
        try {
          const selectionResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_SELECTION_STATES);
          const selectionStates = selectionResult[STORAGE_KEYS.TAB_SELECTION_STATES];
          if (selectionStates && selectionStates[tabId]) {
            delete selectionStates[tabId];
            await chrome.storage.local.set({ [STORAGE_KEYS.TAB_SELECTION_STATES]: selectionStates });
            logger.background.info(`Cleaned up selection state for closed tab ${tabId}.`);
          }
        } catch (selectionCleanupError) {
          logger.background.error(`Error during selection state cleanup for closed tab ${tabId}:`, selectionCleanupError);
        }


      } catch (error) {
        logger.background.error(
          `Error during onRemoved cleanup for tab ${tabId}:`,
          error
        );
      }

      // The attempt to disable the side panel is less critical now but can be kept as a good practice.
      // It might fail if the tab is truly gone, so catch errors gracefully.
      logger.background.info(
        `Attempting to disable side panel for closed tab ${tabId}`
      );
      try {
        if (chrome.sidePanel && typeof chrome.sidePanel.setOptions === 'function') {
          await chrome.sidePanel.setOptions({ tabId: tabId, enabled: false });
          logger.background.info(
            `Successfully requested side panel disable for closed tab ${tabId}.`
          );
        }
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
    // The primary call to SidePanelStateManager.cleanupTabStates() will handle
    // the cleanup of TAB_SIDEPANEL_STATES and any other keys it's configured to manage.
    await SidePanelStateManager.cleanupTabStates();
    logger.background.info(
      `SidePanelStateManager.cleanupTabStates() completed.`
    );

    // Also clean up stale selection states
    const openTabs = await chrome.tabs.query({});
    const openTabIds = new Set(openTabs.map(tab => tab.id.toString()));
    const selectionResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_SELECTION_STATES);
    const selectionStates = selectionResult[STORAGE_KEYS.TAB_SELECTION_STATES];
    if (selectionStates) {
      let changed = false;
      for (const storedTabIdStr in selectionStates) {
        if (!openTabIds.has(storedTabIdStr)) {
          delete selectionStates[storedTabIdStr];
          changed = true;
          logger.background.debug(`Cleaned up stale selection state for closed tab ${storedTabIdStr}.`);
        }
      }
      if (changed) {
        await chrome.storage.local.set({ [STORAGE_KEYS.TAB_SELECTION_STATES]: selectionStates });
      }
    }

    // Add cleanup for provisional chat sessions
    try {
      logger.background.info('Running provisional chat session cleanup...');
      await ChatHistoryService.cleanupProvisionalSessions();
      logger.background.info('Provisional chat session cleanup finished.');
    } catch (error) {
      logger.background.error('Error during provisional chat session cleanup:', error);
    }

    logger.background.info('Stale tab data cleanup finished successfully.');
  } catch (error) {
    logger.background.error(
      'Error during stale tab data cleanup execution:',
      error
    );
  }
}

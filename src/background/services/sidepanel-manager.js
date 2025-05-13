// src/background/services/sidebar-manager.js - Tab-specific native side panel management

import SidepanelStateManager from '../../services/SidepanelStateManager.js';
import { logger } from '../../shared/logger.js';
import { isSidePanelAllowedPage } from '../../shared/utils/content-utils.js';

/**
 * Toggle native side panel visibility for a specific tab.
 * @param {Object} message - Message object containing optional `tabId` and `visible` properties.
 * @param {Object} sender - Message sender, potentially containing `sender.tab.id`.
 * @param {Function} sendResponse - Function to send the response back.
 */
export async function toggleNativeSidepanel(message, sender, sendResponse) {
  let targetTabId;
  let newState; // To store the final state (true for open, false for closed)
  try {
    logger.background.info(
      'Handling native side panel toggle request (Refactored)'
    );

    // Determine the target tab ID
    const explicitTabId = message?.tabId || sender?.tab?.id;
    if (explicitTabId) {
      targetTabId = explicitTabId;
    } else {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!activeTab?.id) {
        throw new Error('No active tab found to target for side panel toggle.');
      }
      targetTabId = activeTab.id;
    }
    logger.background.info(
      `Targeting tab ${targetTabId} for side panel operation.`
    );

    // Get the full tab object to check URL
    const targetTab = await chrome.tabs.get(targetTabId);
    if (!targetTab || !targetTab.url) {
      throw new Error('Could not determine tab URL for side panel operation');
    }

    // Check if side panel is allowed on this page
    const isAllowed = isSidePanelAllowedPage(targetTab.url);
    if (!isAllowed) {
    logger.background.warn(
      `Attempted to toggle sidepanel on restricted page: ${targetTab.url}`
    );
      // Force state to closed and disable panel
      newState = false;
      await SidebarStateManager.setSidebarVisibilityForTab(targetTabId, false);
      await chrome.sidePanel.setOptions({ tabId: targetTabId, enabled: false });

      sendResponse({
        success: false,
        error: 'Side Panel cannot be opened on this page.',
        tabId: targetTabId,
        visible: false,
        code: 'RESTRICTED_PAGE',
      });
      return;
    }

    // Read the current *intended* state from storage
    const currentState =
      await SidepanelStateManager.getSidepanelVisibilityForTab(targetTabId);
    logger.background.info(
      `Current stored visibility for tab ${targetTabId}: ${currentState}`
    );

    // Determine the new state and perform actions
    if (currentState === false) {
      // Current state is closed, so we intend to open (enable) it
      newState = true;
      logger.background.info(
        `Action: Enable side panel for tab ${targetTabId}`
      );
      await SidebarStateManager.setSidebarVisibilityForTab(targetTabId, true);
      await chrome.sidePanel.setOptions({
        tabId: targetTabId,
        path: `sidepanel.html?tabId=${targetTabId}`, // Pass tabId via URL
        enabled: true,
      });
      logger.background.info(
        `Side panel enabled and path set for tab ${targetTabId}.`
      );
    } else {
      // Current state is open, so we intend to close (disable) it
      newState = false;
      logger.background.info(
        `Action: Disable side panel for tab ${targetTabId}`
      );
      await SidebarStateManager.setSidebarVisibilityForTab(targetTabId, false);
      await chrome.sidePanel.setOptions({
        tabId: targetTabId,
        enabled: false,
      });
      logger.background.info(`Side panel disabled for tab ${targetTabId}.`);
    }

    sendResponse({
      success: true,
      visible: newState, // Send back the new intended state
      tabId: targetTabId,
      message: `Side panel state updated for tab ${targetTabId}. Intended visibility: ${newState}.`,
    });
  } catch (error) {
    logger.background.error(
      `Error handling native side panel toggle for tab ${targetTabId || 'unknown'}:`,
      error
    );
    // If an error occurred, the actual panel state might not match the intended state.
    // We send back the intended newState if determined, otherwise report failure.
    sendResponse({
      success: false,
      error: error.message,
      tabId: targetTabId,
      visible: newState, // Include intended state if available, even on error
    });
  }
}

/**
 * Handles the 'toggleNativeSidePanelAction' message request.
 * @param {object} message - The message object.
 * @param {chrome.runtime.MessageSender} sender - The sender of the message.
 * @param {function} sendResponse - Function to call to send the response.
 * @returns {boolean} - True to indicate an asynchronous response.
 */
export function handleToggleNativeSidepanelAction(
  message,
  sender,
  sendResponse
) {
  logger.background.info(
    'Received toggleNativeSidePanelAction request via message router'
  );
  // Call the actual function which handles the logic and response
  toggleNativeSidePanel(message, sender, sendResponse);
  // toggleNativeSidePanel is async and handles sendResponse itself
  return true; // Keep channel open for async response
}

/**
 * Get sidepanel state for specific tab
 * @param {Object} message - Message object
 * @param {Object} sender - Message sender
 * @param {Function} sendResponse - Response function
 */
export async function getSidepanelState(message, sender, sendResponse) {
  try {
    // Get target tab ID (same logic as toggle)
    const tabId = message.tabId || (sender.tab && sender.tab.id);
    let targetTabId;

    if (!tabId) {
      // Get active tab if no tab ID specified
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const activeTab = tabs[0];

      if (!activeTab || !activeTab.id) {
        throw new Error('No active tab found');
      }

      targetTabId = activeTab.id;
    } else {
      targetTabId = tabId;
    }

    const state = await SidepanelStateManager.getSidepanelState(targetTabId);

    sendResponse({
      success: true,
      state,
      tabId: targetTabId,
    });
  } catch (error) {
    logger.background.error(
      'Error handling tab-specific sidepanel state query:',
      error
    );
    sendResponse({ success: false, error: error.message });
  }
}

// Add this new function
export async function handleCloseCurrentSidepanelRequest(message, sender, sendResponse) {
  const { tabId } = message;

  if (typeof tabId !== 'number') {
    logger.background.error('handleCloseCurrentSidePanelRequest: Invalid or missing tabId.', message);
    sendResponse({ success: false, error: 'Invalid tabId provided.' });
    return false; // Indicate synchronous response for this error path
  }

  logger.background.info(`Closing sidepanel for tab ${tabId} by direct request from sidepanel.`);

  try {
    await SidepanelStateManager.setSidepanelVisibilityForTab(tabId, false);
    await chrome.sidePanel.setOptions({ tabId, enabled: false });
    logger.background.info(`Sidepanel for tab ${tabId} successfully closed and state updated.`);
    sendResponse({
      success: true,
      tabId,
      visible: false,
      message: 'Side panel closed successfully.',
    });
  } catch (error) {
    logger.background.error(`Error closing sidepanel for tab ${tabId} via direct request:`, error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to close side panel.',
      tabId,
      visible: true, // Reflect that the operation might have failed to change visibility
    });
  }
  return true; // Indicate asynchronous response handling
}

// src/background/services/sidepanel-manager.js - Tab-specific side panel management

import SidePanelStateManager from '../../services/SidePanelStateManager.js';
import { logger } from '../../shared/logger.js';
import { isSidePanelAllowedPage } from '../../shared/utils/content-utils.js';

/**
 * Toggle side panel visibility for a specific tab.
 * @param {Object} message - Message object containing optional `tabId` and `visible` properties.
 * @param {Object} sender - Message sender, potentially containing `sender.tab.id`.
 * @param {Function} sendResponse - Function to send the response back.
 */
        export async function toggleSidePanel(message, sender, sendResponse) {
          let targetTabId;
          let newState; // To store the final state (true for open, false for closed)
          try {
            logger.background.info(
              'Handling sidepanel toggle request'
            );
            if (!chrome.sidePanel || typeof chrome.sidePanel.setOptions !== 'function' || typeof chrome.sidePanel.open !== 'function') {
              logger.background.error('Side Panel API is not available. Cannot toggle side panel.');
              sendResponse({
                success: false,
                error: 'SIDE_PANEL_UNSUPPORTED',
                message: 'Side Panel feature requires a newer Chrome version (114+).',
                tabId: message?.tabId || sender?.tab?.id || null,
                visible: false, // Assume not visible if API is missing
              });
              return; // Exit early
            }

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
      await SidePanelStateManager.setSidePanelVisibilityForTab(targetTabId, false);
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
      await SidePanelStateManager.getSidePanelVisibilityForTab(targetTabId);
    logger.background.info(
      `Current stored visibility for tab ${targetTabId}: ${currentState}`
    );

    // Determine the new state and perform actions
    if (currentState === false) {
      // Current state is closed, so we intend to open (enable) it
      newState = true;
      logger.background.info(
        `Action: Enable sidepanel for tab ${targetTabId}`
      );
      await SidePanelStateManager.setSidePanelVisibilityForTab(targetTabId, true);
      await chrome.sidePanel.setOptions({
        tabId: targetTabId,
        path: `sidepanel.html?tabId=${targetTabId}`, // Pass tabId via URL
        enabled: true,
      });
      logger.background.info(
        `Sidepanel enabled and path set for tab ${targetTabId}.`
      );
    } else {
      // Current state is open, so we intend to close (disable) it
      newState = false;
      logger.background.info(
        `Action: Disable sidepanel for tab ${targetTabId}`
      );
      await SidePanelStateManager.setSidePanelVisibilityForTab(targetTabId, false);
      await chrome.sidePanel.setOptions({
        tabId: targetTabId,
        enabled: false,
      });
      logger.background.info(`Sidepanel disabled for tab ${targetTabId}.`);
    }

    sendResponse({
      success: true,
      visible: newState, // Send back the new intended state
      tabId: targetTabId,
      message: `Side Panel state updated for tab ${targetTabId}. Intended visibility: ${newState}.`,
    });
  } catch (error) {
    logger.background.error(
      `Error handling sidepanel toggle for tab ${targetTabId || 'unknown'}:`,
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
 * Handles the 'toggleSidePanelAction' message request.
 * @param {object} message - The message object.
 * @param {chrome.runtime.MessageSender} sender - The sender of the message.
 * @param {function} sendResponse - Function to call to send the response.
 * @returns {boolean} - True to indicate an asynchronous response.
 */
export function handleToggleSidePanelAction(
  message,
  sender,
  sendResponse
) {
  logger.background.info(
    'Received toggleSidePanelAction request via message router'
  );
  // Call the actual function which handles the logic and response
  toggleSidePanel(message, sender, sendResponse);
  // toggleSidePanel is async and handles sendResponse itself
  return true; // Keep channel open for async response
}

export async function handleCloseCurrentSidePanelRequest(message, sender, sendResponse) {
  const { tabId } = message;

  if (typeof tabId !== 'number') {
    logger.background.error('handleCloseCurrentSidePanelRequest: Invalid or missing tabId.', message);
    sendResponse({ success: false, error: 'Invalid tabId provided.' });
    return false; // Indicate synchronous response for this error path
  }

  logger.background.info(`Closing sidepanel for tab ${tabId} by direct request from sidepanel.`);

  try {
    await SidePanelStateManager.setSidePanelVisibilityForTab(tabId, false);
    if (chrome.sidePanel && typeof chrome.sidePanel.setOptions === 'function') {
      await chrome.sidePanel.setOptions({ tabId, enabled: false });
      logger.background.info(`Sidepanel for tab ${tabId} successfully closed and state updated.`);
    } else {
      logger.background.warn(`Side Panel API not available. Cannot setOptions to close for tab ${tabId}. State was updated.`);
      // The state is updated, but the panel might not visually close if API is missing.
      // This is an edge case, as the sidepanel itself calls this, implying API was available to open it.
    }
    sendResponse({
      success: true,
      tabId,
      visible: false,
      message: 'Side Panel closed successfully.'
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

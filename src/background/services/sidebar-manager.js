// src/background/services/sidebar-manager.js - Tab-specific native side panel management

import SidebarStateManager from '../../services/SidebarStateManager.js';
import logger from '../../shared/logger.js';

/**
 * Toggle native side panel visibility for a specific tab.
 * @param {Object} message - Message object containing optional `tabId` and `visible` properties.
 * @param {Object} sender - Message sender, potentially containing `sender.tab.id`.
 * @param {Function} sendResponse - Function to send the response back.
 */
export async function toggleNativeSidePanel(message, sender, sendResponse) {
  let targetTabId;
  let newState; // To store the final state (true for open, false for closed)
  try {
    logger.background.info('Handling native side panel toggle request (Refactored)');

    // Determine the target tab ID
    const explicitTabId = message?.tabId || sender?.tab?.id;
    if (explicitTabId) {
      targetTabId = explicitTabId;
    } else {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) {
        throw new Error('No active tab found to target for side panel toggle.');
      }
      targetTabId = activeTab.id;
    }
    logger.background.info(`Targeting tab ${targetTabId} for side panel operation.`);

    // Read the current *intended* state from storage
    const currentState = await SidebarStateManager.getSidebarVisibilityForTab(targetTabId);
    logger.background.info(`Current stored visibility for tab ${targetTabId}: ${currentState}`);

    // Determine the new state and perform actions
    if (currentState === false) {
      // Current state is closed, so we intend to open (enable) it
      newState = true;
      logger.background.info(`Action: Enable side panel for tab ${targetTabId}`);
      await SidebarStateManager.setSidebarVisibilityForTab(targetTabId, true);
      await chrome.sidePanel.setOptions({
        tabId: targetTabId,
        path: `sidepanel.html?tabId=${targetTabId}`, // Pass tabId via URL
        enabled: true
      });
      logger.background.info(`Side panel enabled and path set for tab ${targetTabId}.`);
    } else {
      // Current state is open, so we intend to close (disable) it
      newState = false;
      logger.background.info(`Action: Disable side panel for tab ${targetTabId}`);
      await SidebarStateManager.setSidebarVisibilityForTab(targetTabId, false);
      await chrome.sidePanel.setOptions({
        tabId: targetTabId,
        enabled: false
      });
      logger.background.info(`Side panel disabled for tab ${targetTabId}.`);
    }

    // Handle FAB visibility after side panel state change
    const hasBeenOpenedOnce = await SidebarStateManager.getSidebarOpenedOnceState(targetTabId);
    const isVisible = await SidebarStateManager.getSidebarVisibilityForTab(targetTabId);

    if (hasBeenOpenedOnce) {
      logger.background.info(`Tab ${targetTabId} has been opened once. Ensuring content script exists and sending FAB state.`);
      try {
        await chrome.scripting.executeScript({
          target: { tabId: targetTabId },
          files: ['dist/content-script.bundle.js']
        });
        logger.background.info(`Content script injection successful (or already present) for tab ${targetTabId}.`);

        chrome.tabs.sendMessage(targetTabId, {
          action: isVisible ? 'showFab' : 'hideFab',
          isVisible: isVisible
        });
        logger.background.info(`Sent FAB message ('${isVisible ? 'showFab' : 'hideFab'}') to tab ${targetTabId}.`);

      } catch (error) {
        if (error.message.includes('Cannot access') || error.message.includes('extension context') || error.message.includes('No tab with id')) {
          logger.background.warn(`Cannot inject script or send message to tab ${targetTabId} (likely a restricted page or closed tab): ${error.message}`);
        } else {
          logger.background.error(`Error ensuring content script or sending FAB message to tab ${targetTabId}:`, error);
        }
      }
    } else {
      logger.background.info(`Tab ${targetTabId} has not been opened before. FAB message not sent.`);
    }

    sendResponse({
      success: true,
      visible: newState, // Send back the new intended state
      tabId: targetTabId,
      message: `Side panel state updated for tab ${targetTabId}. Intended visibility: ${newState}.`
    });

  } catch (error) {
    logger.background.error(`Error handling native side panel toggle for tab ${targetTabId || 'unknown'}:`, error);
    // If an error occurred, the actual panel state might not match the intended state.
    // We send back the intended newState if determined, otherwise report failure.
    sendResponse({
      success: false,
      error: error.message,
      tabId: targetTabId,
      visible: newState // Include intended state if available, even on error
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
export function handleToggleNativeSidePanelAction(message, sender, sendResponse) {
  logger.background.info('Received toggleNativeSidePanelAction request via message router');
  // Call the actual function which handles the logic and response
  toggleNativeSidePanel(message, sender, sendResponse);
  // toggleNativeSidePanel is async and handles sendResponse itself
  return true; // Keep channel open for async response
}


/**
 * Get sidebar state for specific tab
 * @param {Object} message - Message object
 * @param {Object} sender - Message sender
 * @param {Function} sendResponse - Response function
 */
export async function getSidebarState(message, sender, sendResponse) {
  try {
    // Get target tab ID (same logic as toggle)
    const tabId = message.tabId || (sender.tab && sender.tab.id);
    let targetTabId;
    
    if (!tabId) {
      // Get active tab if no tab ID specified
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      
      if (!activeTab || !activeTab.id) {
        throw new Error('No active tab found');
      }
      
      targetTabId = activeTab.id;
    } else {
      targetTabId = tabId;
    }
    
    const state = await SidebarStateManager.getSidebarState(targetTabId);
    
    sendResponse({
      success: true,
      state,
      tabId: targetTabId
    });
  } catch (error) {
    logger.background.error('Error handling tab-specific sidebar state query:', error);
    sendResponse({ success: false, error: error.message });
  }
}

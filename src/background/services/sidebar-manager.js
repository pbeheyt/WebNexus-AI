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
  try {
    logger.background.info('Handling native side panel toggle request');

    // Determine the target tab ID
    const explicitTabId = message.tabId || (sender?.tab?.id);
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

    // Determine the desired visibility state
    let visible = message.visible;
    if (visible === undefined) {
      // If visibility isn't specified, toggle based on the stored intended state
      const currentState = await SidebarStateManager.getSidebarState(targetTabId);
      visible = !currentState.visible;
      logger.background.info(`Visibility not specified, toggling based on stored state. New state: ${visible}`);
    } else {
      logger.background.info(`Explicit visibility requested: ${visible}`);
    }

    // Save the intended state *before* attempting to change the panel
    // This ensures our internal state reflects the desired outcome even if the panel API fails
    await SidebarStateManager.setSidebarVisibilityForTab(targetTabId, visible);
    // Removed log about storing intended visibility

    // Perform the side panel action
    if (visible) {
      logger.background.info(`Enabling side panel for tab ${targetTabId}`);
      // Set options to enable the panel and set its path, including tabId. Opening is handled by the caller (user gesture context).
      await chrome.sidePanel.setOptions({
        tabId: targetTabId,
        path: `sidepanel.html?tabId=${targetTabId}`, // Pass tabId via URL
        enabled: true
      });
      // DO NOT call chrome.sidePanel.open() here; it must be called in response to a user gesture.
    } else {
      logger.background.info(`Disabling side panel for tab ${targetTabId}`);
      // Just disable it; the browser handles closing it if it was open.
      await chrome.sidePanel.setOptions({
        tabId: targetTabId,
        enabled: false
      });
    }

    sendResponse({
      success: true,
      visible,
      tabId: targetTabId,
      message: `Side panel for tab ${targetTabId} ${visible ? 'enabled' : 'disabled'}.` // Updated message
    });

  } catch (error) {
    logger.background.error(`Error handling native side panel toggle for tab ${targetTabId || 'unknown'}:`, error);
    // Attempt to revert the stored state if the API call failed, though this might be tricky
    // For now, just report the error. The stored state might be out of sync if the API failed.
    if (targetTabId && message.visible !== undefined) {
       logger.background.warn(`Side panel API failed. Stored state for tab ${targetTabId} might be ${message.visible}, but the panel state is uncertain.`);
       // Consider trying to revert SidebarStateManager state here if critical
    }
    sendResponse({ success: false, error: error.message, tabId: targetTabId });
  }
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
// Removed ensureSidebarScriptInjected function as it's no longer needed with the native Side Panel API.

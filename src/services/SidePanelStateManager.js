// src/services/SidePanelStateManager.js
import { STORAGE_KEYS } from '../shared/constants';
import { logger } from '../shared/logger';

/**
 * Manages the state of the side panel for each tab,
 * including visibility, preferences, and associated data.
 */
class SidePanelStateManager {
  /**
   * Get the UI state of the side panel for a specific tab.
   * @param {number} tabId - The ID of the tab.
   * @returns {Promise<Object>} An object containing { isVisible: boolean, activeChatSessionId: string|null, currentView: string }.
   */
  static async getTabUIState(tabId) {
    if (tabId === null || tabId === undefined) {
      logger.service.warn(
        'SidePanelStateManager: getTabUIState called with invalid tabId.'
      );
      return { isVisible: false, activeChatSessionId: null, currentView: 'chat' }; // Default state for invalid tabId
    }
    try {
      const result = await chrome.storage.local.get(
        STORAGE_KEYS.TAB_SIDEPANEL_STATES
      );
      const states = result[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};
      return states[tabId.toString()] || { isVisible: false, activeChatSessionId: null, currentView: 'chat' };
    } catch (error) {
      logger.service.error(
        `SidePanelStateManager: Error getting tab UI state for tab ${tabId}:`,
        error
      );
      return { isVisible: false, activeChatSessionId: null, currentView: 'chat' }; // Default state on error
    }
  }

  /**
   * Set the visibility state of the side panel for a specific tab.
   * @param {number} tabId - The ID of the tab.
   * @param {boolean} isVisible - The new visibility state.
   * @returns {Promise<void>}
   */
  static async setTabUIVisibility(tabId, isVisible) {
    if (tabId === null || tabId === undefined) {
      logger.service.warn(
        'SidePanelStateManager: setTabUIVisibility called with invalid tabId.'
      );
      return;
    }
    try {
      const result = await chrome.storage.local.get(
        STORAGE_KEYS.TAB_SIDEPANEL_STATES
      );
      const states = result[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};
      const tabIdStr = tabId.toString();
      if (!states[tabIdStr]) {
        states[tabIdStr] = { isVisible: false, activeChatSessionId: null, currentView: 'chat' };
      }
      states[tabIdStr].isVisible = isVisible;

      // Optional: Cleanup if state is default and not visible
      // if (!isVisible && states[tabIdStr].activeChatSessionId === null && states[tabIdStr].currentView === 'chat') {
      //   delete states[tabIdStr];
      // }
      await chrome.storage.local.set({
        [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: states,
      });
      logger.service.info(
        `SidePanelStateManager: Tab UI visibility for tab ${tabId} set to ${isVisible}.`
      );
    } catch (error) {
      logger.service.error(
        `SidePanelStateManager: Error setting tab UI visibility for tab ${tabId}:`,
        error
      );
    }
  }

  static async setActiveChatSessionForTab(tabId, chatSessionId) {
    if (tabId === null || tabId === undefined) {
      logger.service.warn('SidePanelStateManager: setActiveChatSessionForTab called with invalid tabId.');
      return;
    }
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEPANEL_STATES);
      const states = result[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};
      const tabIdStr = tabId.toString();

      if (!states[tabIdStr]) {
        states[tabIdStr] = { isVisible: true, activeChatSessionId: null, currentView: 'chat' }; // Assume visible if setting active chat
      }
      states[tabIdStr].activeChatSessionId = chatSessionId;
      // Optionally, ensure currentView is 'chat' when a session is made active
      // states[tabIdStr].currentView = 'chat'; 

      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: states });
      logger.service.info(`SidePanelStateManager: Active chat session for tab ${tabId} set to ${chatSessionId}.`);
    } catch (error) {
      logger.service.error(`SidePanelStateManager: Error setting active chat session for tab ${tabId}:`, error);
    }
  }

  static async setTabViewMode(tabId, viewMode) {
    if (tabId === null || tabId === undefined || (viewMode !== 'chat' && viewMode !== 'history')) {
      logger.service.warn('SidePanelStateManager: setTabViewMode called with invalid parameters.', { tabId, viewMode });
      return;
    }
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEPANEL_STATES);
      const states = result[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};
      const tabIdStr = tabId.toString();

      if (!states[tabIdStr]) {
        states[tabIdStr] = { isVisible: true, activeChatSessionId: null, currentView: 'chat' }; // Assume visible if setting view mode
      }
      states[tabIdStr].currentView = viewMode;

      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: states });
      logger.service.info(`SidePanelStateManager: View mode for tab ${tabId} set to ${viewMode}.`);
    } catch (error) {
      logger.service.error(`SidePanelStateManager: Error setting view mode for tab ${tabId}:`, error);
    }
  }

  /**
   * Resets all tab UI states stored. Typically called on browser startup or extension install/update.
   * This effectively clears the TAB_SIDEPANEL_STATES storage key.
   * @returns {Promise<void>}
   */
  static async resetAllTabUIStates() {
    try {
      await chrome.storage.local.remove(STORAGE_KEYS.TAB_SIDEPANEL_STATES);
      logger.service.info(
        'All tab UI states have been reset (storage key removed).'
      );
    } catch (error) {
      logger.service.error(
        'Error resetting all tab UI states:',
        error
      );
    }
  }


  /**
   * Cleans up all tab-specific states (visibility, preferences, data) for tabs that are no longer open.
   * @returns {Promise<void>}
   */
  static async cleanupTabStates() {
    logger.service.info(
      'SidePanelStateManager: Starting cleanup of stale tab states.'
    );
    try {
      const openTabs = await chrome.tabs.query({});
      const openTabIds = new Set(openTabs.map((tab) => tab.id.toString()));

      // Only clean TAB_SIDEPANEL_STATES directly. Other keys are managed by their respective services or deprecated.
    const keysToClean = [
      STORAGE_KEYS.TAB_SIDEPANEL_STATES,
    ];
      // Deprecated keys like TAB_CHAT_HISTORIES and TAB_TOKEN_STATISTICS are no longer cleaned here.

      for (const storageKey of keysToClean) {
        const result = await chrome.storage.local.get(storageKey);
        let data = result[storageKey];
        let changed = false;

        if (data && typeof data === 'object') {
          for (const storedTabIdStr in data) {
            if (!openTabIds.has(storedTabIdStr)) {
              delete data[storedTabIdStr];
              changed = true;
              logger.service.debug(
                `SidePanelStateManager: Cleaned up ${storageKey} for closed tab ${storedTabIdStr}.`
              );
            }
          }

          if (changed) {
            if (Object.keys(data).length === 0) {
              await chrome.storage.local.remove(storageKey);
              logger.service.info(
                `SidePanelStateManager: Removed empty storage key ${storageKey} after cleanup.`
              );
            } else {
              await chrome.storage.local.set({ [storageKey]: data });
            }
          }
        }
      }
      logger.service.info(
        'SidePanelStateManager: Stale tab state cleanup finished.'
      );
    } catch (error) {
      logger.service.error(
        'SidePanelStateManager: Error during tab state cleanup:',
        error
      );
    }
  }
}

export default SidePanelStateManager;

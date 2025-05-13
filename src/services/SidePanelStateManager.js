import { logger } from '../shared/logger.js';
import { STORAGE_KEYS } from '../shared/constants.js';

/**
 * Service for managing tab-specific sidepanel state
 */
class SidePanelStateManager {
  /**
   * Toggle sidepanel visibility for a specific tab
   * @private
   * @param {number} tabId - Tab ID
   * @param {boolean|undefined} visible - Visibility state (undefined to toggle)
   */
  async _toggleForTab(tabId, visible) {
    // Get current tab states
    const { [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: tabStates = {} } =
      await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEPANEL_STATES);

    // Convert tabId to string for use as object key
    const tabIdStr = tabId.toString();

    // Determine new visibility
    if (visible === undefined) {
      // Toggle current state
      visible = !(tabStates[tabIdStr] === true);
    }

    // Update tab state
    const updatedStates = {
      ...tabStates,
      [tabIdStr]: visible,
    };

    // Save updated states
    await chrome.storage.local.set({
      [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: updatedStates,
    });

    logger.service.info(`Tab ${tabId} sidepanel visibility set to ${visible}`);
  }

  /**
  /**
   * Get sidepanel state for a specific tab
   * @private
   * @param {number} tabId - Tab ID
   * @returns {Promise<Object>} Tab-specific sidepanel state
   */
  async _getStateForTab(tabId) {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.TAB_SIDEPANEL_STATES,
      STORAGE_KEYS.SIDEPANEL_DEFAULT_PLATFORM_ID,
      STORAGE_KEYS.SIDEPANEL_DEFAULT_MODEL_ID_BY_PLATFORM,
    ]);

    const tabStates = result[STORAGE_KEYS.TAB_SIDEPANEL_STATES] || {};

    return {
      visible: tabStates[tabId.toString()] === true,
      platform: result[STORAGE_KEYS.SIDEPANEL_DEFAULT_PLATFORM_ID] || null,
      model: result[STORAGE_KEYS.SIDEPANEL_DEFAULT_MODEL_ID_BY_PLATFORM] || null,
    };
  }

  /**
   * Get current sidepanel state for specific tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<Object>} Tab-specific sidepanel state
   */
  async getSidePanelState(tabId) {
    try {
      if (!tabId) {
        // Get active tab if no tab ID specified
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        const activeTab = tabs[0];

        if (!activeTab || !activeTab.id) {
          logger.service.warn('No active tab found for getSidepanelState');
          return {
            visible: false,
            platform: null,
            model: null,
          };
        }

        return this._getStateForTab(activeTab.id);
      }

      return this._getStateForTab(tabId);
    } catch (error) {
      logger.service.error(`Error getting sidepanel state for tab ${tabId}:`, error);
      return {
        visible: false,
        platform: null,
        model: null,
      };
    }
  }

  /**
   * Get sidepanel visibility for specific tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} Visibility state
   */
  async getSidePanelVisibilityForTab(tabId) {
    try {
      const { [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: tabStates = {} } =
        await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEPANEL_STATES);

      return tabStates[tabId.toString()] === true;
    } catch (error) {
      logger.service.error(`Error getting sidepanel visibility for tab ${tabId}:`, error);
      return false;
    }
  }

  /**
   * Set sidepanel visibility for specific tab
   * @param {number} tabId - Tab ID
   * @param {boolean} visible - Visibility state
   * @returns {Promise<boolean>} Success indicator
   */
  async setSidePanelVisibilityForTab(tabId, visible) {
    try {
      await this._toggleForTab(tabId, visible);
      return true;
    } catch (error) {
      logger.service.error(`Error setting sidepanel visibility for tab ${tabId}:`, error);
      return false;
    }
  }

  /**
   * Clean up tab states for closed tabs
   * Called periodically to prevent storage bloat
   * @returns {Promise<void>}
   */
  async cleanupTabStates() {
    try {
      // Get all current tabs
      const tabs = await chrome.tabs.query({});
      const activeTabIds = new Set(tabs.map((tab) => tab.id.toString()));

      // Get current tab states
      const { [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: tabStates = {} } =
        await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEPANEL_STATES);

      // Filter out closed tabs
      const updatedStates = {};
      let stateChanged = false;

      Object.entries(tabStates).forEach(([tabId, state]) => {
        if (activeTabIds.has(tabId)) {
          updatedStates[tabId] = state;
        } else {
          stateChanged = true;
          logger.service.info(`Removing sidepanel state for closed tab ${tabId}`);
        }
      });

      // Save updated states if changed
      if (stateChanged) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.TAB_SIDEPANEL_STATES]: updatedStates,
        });
        logger.service.info('Tab sidepanel states cleaned up');
      }
    } catch (error) {
      logger.service.error('Error cleaning up tab sidepanel states:', error);
    }
  }
}

export default new SidePanelStateManager();

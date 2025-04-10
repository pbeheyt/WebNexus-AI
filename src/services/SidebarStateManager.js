const logger = require('../shared/logger.js').service;
const { STORAGE_KEYS } = require('../shared/constants');

/**
 * Service for managing tab-specific sidebar state
 */
class SidebarStateManager {
  
  /**
   * Toggle sidebar visibility for a specific tab
   * @private
   * @param {number} tabId - Tab ID
   * @param {boolean|undefined} visible - Visibility state (undefined to toggle)
   */
  async _toggleForTab(tabId, visible) {
    // Get current tab states
    const { [STORAGE_KEYS.TAB_SIDEBAR_INFO]: tabStates = {} } = 
      await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEBAR_INFO);
    
    // Convert tabId to string for use as object key
    const tabIdStr = tabId.toString();
    
    // Get current state (default to hidden and not opened)
    const currentState = tabStates[tabIdStr] || { 
      isVisible: false, 
      hasBeenOpenedOnce: false 
    };
    
    // Determine new visibility
    const newVisible = visible === undefined ? !currentState.isVisible : visible;
    
    // Create new state object
    const newState = {
      isVisible: newVisible,
      hasBeenOpenedOnce: currentState.hasBeenOpenedOnce || newVisible
    };
    
    // Update tab states
    const updatedStates = {
      ...tabStates,
      [tabIdStr]: newState
    };
    
    // Save updated states
    await chrome.storage.local.set({ 
      [STORAGE_KEYS.TAB_SIDEBAR_INFO]: updatedStates 
    });
    
    logger.info(`Tab ${tabId} sidebar visibility set to ${visible}`);
  }
  
  /**
  /**
   * Get sidebar state for a specific tab
   * @private
   * @param {number} tabId - Tab ID
   * @returns {Promise<Object>} Tab-specific sidebar state
   */
  async _getStateForTab(tabId) {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.TAB_SIDEBAR_INFO,
      STORAGE_KEYS.SIDEBAR_PLATFORM,
      STORAGE_KEYS.SIDEBAR_MODEL
    ]);
    
    const tabStates = result[STORAGE_KEYS.TAB_SIDEBAR_INFO] || {};
    const tabState = tabStates[tabId.toString()] || { isVisible: false };
    
    return {
      visible: tabState.isVisible,
      platform: result[STORAGE_KEYS.SIDEBAR_PLATFORM] || null,
      model: result[STORAGE_KEYS.SIDEBAR_MODEL] || null
    };
  }
  
  /**
   * Get current sidebar state for specific tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<Object>} Tab-specific sidebar state
   */
  async getSidebarState(tabId) {
    try {
      if (!tabId) {
        // Get active tab if no tab ID specified
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        
        if (!activeTab || !activeTab.id) {
          logger.warn('No active tab found for getSidebarState');
          return {
            visible: false,
            platform: null,
            model: null
          };
        }
        
        return this._getStateForTab(activeTab.id);
      }
      
      return this._getStateForTab(tabId);
    } catch (error) {
      logger.error(`Error getting sidebar state for tab ${tabId}:`, error);
      return {
        visible: false,
        platform: null,
        model: null
      };
    }
  }
  
  /**
   * Get sidebar visibility for specific tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} Visibility state
   */
  async getSidebarVisibilityForTab(tabId) {
    try {
      const { [STORAGE_KEYS.TAB_SIDEBAR_INFO]: tabStates = {} } = 
        await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEBAR_INFO);
      
      const tabState = tabStates[tabId.toString()] || { isVisible: false };
      return tabState.isVisible;
    } catch (error) {
      logger.error(`Error getting sidebar visibility for tab ${tabId}:`, error);
      return false;
    }
  }
  
  /**
   * Set sidebar visibility for specific tab
   * @param {number} tabId - Tab ID
   * @param {boolean} visible - Visibility state
   * @returns {Promise<boolean>} Success indicator
   */
  async setSidebarVisibilityForTab(tabId, visible) {
    try {
      await this._toggleForTab(tabId, visible);
      return true;
    } catch (error) {
      logger.error(`Error setting sidebar visibility for tab ${tabId}:`, error);
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
      const activeTabIds = new Set(tabs.map(tab => tab.id.toString()));
      
      // Get current tab states
      const { [STORAGE_KEYS.TAB_SIDEBAR_INFO]: tabStates = {} } = 
        await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEBAR_INFO);
      
      // Filter out closed tabs
      const updatedStates = {};
      let stateChanged = false;
      
      Object.entries(tabStates).forEach(([tabId, state]) => {
        if (activeTabIds.has(tabId)) {
          updatedStates[tabId] = state;
        } else {
          stateChanged = true;
          logger.info(`Removing sidebar state for closed tab ${tabId}`);
        }
      });
      
      // Save updated states if changed
      if (stateChanged) {
        await chrome.storage.local.set({ 
          [STORAGE_KEYS.TAB_SIDEBAR_INFO]: updatedStates 
        });
        logger.info('Tab sidebar states cleaned up');
      }
    } catch (error) {
      logger.error('Error cleaning up tab sidebar states:', error);
    }
  }
  /**
   * Get whether sidebar has been opened at least once for a tab
   * @param {number} tabId - Tab ID
   * @returns {Promise<boolean>} Whether sidebar has been opened once
   */
  async getSidebarOpenedOnceState(tabId) {
    try {
      const { [STORAGE_KEYS.TAB_SIDEBAR_INFO]: tabStates = {} } = 
        await chrome.storage.local.get(STORAGE_KEYS.TAB_SIDEBAR_INFO);
      
      const tabState = tabStates[tabId.toString()] || { hasBeenOpenedOnce: false };
      return tabState.hasBeenOpenedOnce;
    } catch (error) {
      logger.error(`Error getting sidebar opened state for tab ${tabId}:`, error);
      return false;
    }
  }
}

module.exports = new SidebarStateManager();

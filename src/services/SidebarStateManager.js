const logger = require('../utils/logger').service;

/**
 * Service for managing sidebar state
 */
class SidebarStateManager {
  constructor() {
    this.STORAGE_KEYS = {
      SIDEBAR_VISIBLE: 'sidebar_visible',
      SIDEBAR_PLATFORM: 'sidebar_platform_preference',
      SIDEBAR_MODEL: 'sidebar_model_preference'
    };
  }
  
  /**
   * Initialize sidebar state management
   */
  initialize() {
    logger.info('Initializing SidebarStateManager');
    
    // Set up message listeners
    this._setupMessageListeners();
  }
  
  /**
   * Set up listeners for sidebar-related messages
   * @private
   */
  _setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || typeof message !== 'object') {
        return false;
      }
      
      // Handle sidebar toggle request
      if (message.action === 'toggleSidebar') {
        this._handleToggleSidebar(message, sender, sendResponse);
        return true; // Keep channel open for async response
      }
      
      // Handle sidebar state query
      if (message.action === 'getSidebarState') {
        this._handleGetSidebarState(message, sender, sendResponse);
        return true; // Keep channel open for async response
      }
      
      return false;
    });
  }
  
  /**
   * Handle sidebar toggle request
   * @private
   * @param {Object} message - Message object
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response function
   */
  async _handleToggleSidebar(message, sender, sendResponse) {
    try {
      logger.info('Handling sidebar toggle request');
      
      // Default to toggling current state if no visibility specified
      let visible = message.visible;
      
      if (visible === undefined) {
        const { [this.STORAGE_KEYS.SIDEBAR_VISIBLE]: currentVisible } = 
          await chrome.storage.local.get(this.STORAGE_KEYS.SIDEBAR_VISIBLE);
        
        visible = !currentVisible;
      }
      
      // Save sidebar state
      await chrome.storage.local.set({ [this.STORAGE_KEYS.SIDEBAR_VISIBLE]: visible });
      
      // Get target tab ID
      const tabId = message.tabId || (sender.tab && sender.tab.id);
      
      if (!tabId) {
        // Get active tab if no tab ID specified
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        
        if (activeTab && activeTab.id) {
          // Send toggle command to active tab
          chrome.tabs.sendMessage(activeTab.id, {
            action: 'toggleSidebar',
            visible
          });
        } else {
          throw new Error('No active tab found');
        }
      } else {
        // Send toggle command to specified tab
        chrome.tabs.sendMessage(tabId, {
          action: 'toggleSidebar',
          visible
        });
      }
      
      sendResponse({ success: true, visible });
    } catch (error) {
      logger.error('Error handling sidebar toggle:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  /**
   * Handle sidebar state query
   * @private
   * @param {Object} message - Message object
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response function
   */
  async _handleGetSidebarState(message, sender, sendResponse) {
    try {
      logger.info('Handling sidebar state query');
      
      const result = await chrome.storage.local.get([
        this.STORAGE_KEYS.SIDEBAR_VISIBLE,
        this.STORAGE_KEYS.SIDEBAR_PLATFORM,
        this.STORAGE_KEYS.SIDEBAR_MODEL
      ]);
      
      sendResponse({
        success: true,
        state: {
          visible: result[this.STORAGE_KEYS.SIDEBAR_VISIBLE] || false,
          platform: result[this.STORAGE_KEYS.SIDEBAR_PLATFORM] || null,
          model: result[this.STORAGE_KEYS.SIDEBAR_MODEL] || null
        }
      });
    } catch (error) {
      logger.error('Error handling sidebar state query:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  /**
   * Get current sidebar state
   * @returns {Promise<Object>} Sidebar state
   */
  async getSidebarState() {
    try {
      const result = await chrome.storage.local.get([
        this.STORAGE_KEYS.SIDEBAR_VISIBLE,
        this.STORAGE_KEYS.SIDEBAR_PLATFORM,
        this.STORAGE_KEYS.SIDEBAR_MODEL
      ]);
      
      return {
        visible: result[this.STORAGE_KEYS.SIDEBAR_VISIBLE] || false,
        platform: result[this.STORAGE_KEYS.SIDEBAR_PLATFORM] || null,
        model: result[this.STORAGE_KEYS.SIDEBAR_MODEL] || null
      };
    } catch (error) {
      logger.error('Error getting sidebar state:', error);
      return {
        visible: false,
        platform: null,
        model: null
      };
    }
  }
  
  /**
   * Set sidebar visibility
   * @param {boolean} visible - Visibility state
   * @returns {Promise<boolean>} Success indicator
   */
  async setSidebarVisibility(visible) {
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEYS.SIDEBAR_VISIBLE]: visible });
      return true;
    } catch (error) {
      logger.error('Error setting sidebar visibility:', error);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new SidebarStateManager();
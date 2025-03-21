// src/background/services/sidebar-manager.js - Sidebar management

import SidebarStateManager from '../../services/SidebarStateManager.js';
import logger from '../../utils/logger.js';

/**
 * Toggle sidebar visibility
 * @param {Object} message - Message object
 * @param {Object} sender - Message sender
 * @param {Function} sendResponse - Response function
 */
export async function toggleSidebar(message, sender, sendResponse) {
  try {
    logger.background.info('Handling sidebar toggle request');
    
    // Default to toggling current state if no visibility specified
    let visible = message.visible;
    
    if (visible === undefined) {
      const state = await SidebarStateManager.getSidebarState();
      visible = !state.visible;
    }
    
    // Save sidebar state
    await SidebarStateManager.setSidebarVisibility(visible);
    
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
    logger.background.error('Error handling sidebar toggle:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Get sidebar state
 * @param {Object} message - Message object
 * @param {Object} sender - Message sender
 * @param {Function} sendResponse - Response function
 */
export async function getSidebarState(message, sender, sendResponse) {
  try {
    logger.background.info('Handling sidebar state query');
    
    const state = await SidebarStateManager.getSidebarState();
    
    sendResponse({
      success: true,
      state
    });
  } catch (error) {
    logger.background.error('Error handling sidebar state query:', error);
    sendResponse({ success: false, error: error.message });
  }
}
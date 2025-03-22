// src/background/services/sidebar-manager.js - Tab-specific sidebar management

import SidebarStateManager from '../../services/SidebarStateManager.js';
import { injectContentScript } from './content-extraction.js';
import logger from '../../utils/logger.js';

// Operational state management for toggle transactions
const toggleOperationState = {
  inProgress: false,
  operationMap: new Map(), // Map of tabId -> {timestamp, inProgress}
  MIN_TOGGLE_INTERVAL: 500, // Minimum milliseconds between toggle operations per tab
  OPERATION_TIMEOUT: 2000   // Safety timeout to release locks
};

/**
 * Attempts to acquire an operational lock for a specific tab
 * @param {number} tabId - Tab ID to lock
 * @returns {boolean} Whether the lock was acquired
 */
function acquireToggleLock(tabId) {
  const now = Date.now();
  const tabState = toggleOperationState.operationMap.get(tabId) || { 
    timestamp: 0, 
    inProgress: false 
  };
  
  // Check if operation is in progress or too recent
  if (tabState.inProgress || (now - tabState.timestamp < toggleOperationState.MIN_TOGGLE_INTERVAL)) {
    logger.background.info(`Toggle operation for tab ${tabId} debounced - operation in progress or too soon`);
    return false;
  }
  
  // Set lock for this tab
  toggleOperationState.operationMap.set(tabId, {
    timestamp: now,
    inProgress: true
  });
  
  // Set safety timeout to release lock
  setTimeout(() => releaseLock(tabId), toggleOperationState.OPERATION_TIMEOUT);
  
  return true;
}

/**
 * Releases operational lock for a specific tab
 * @param {number} tabId - Tab ID to unlock
 */
function releaseLock(tabId) {
  const tabState = toggleOperationState.operationMap.get(tabId);
  
  if (tabState) {
    if (tabState.inProgress) {
      logger.background.info(`Released toggle lock for tab ${tabId}`);
    }
    
    tabState.inProgress = false;
    toggleOperationState.operationMap.set(tabId, tabState);
  }
}

/**
 * Toggle sidebar visibility for specific tab with debouncing protection
 * @param {Object} message - Message object
 * @param {Object} sender - Message sender
 * @param {Function} sendResponse - Response function
 */
export async function toggleSidebar(message, sender, sendResponse) {
  try {
    logger.background.info('Handling tab-specific sidebar toggle request');
    
    // Get target tab ID
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
    
    // Apply debouncing to prevent rapid toggle operations
    if (!acquireToggleLock(targetTabId)) {
      sendResponse({ 
        success: true, 
        debounced: true,
        message: 'Operation debounced - toggle in progress or requested too rapidly'
      });
      return;
    }
    
    // Default to toggling current state if no visibility specified
    let visible = message.visible;
    
    if (visible === undefined) {
      const state = await SidebarStateManager.getSidebarState(targetTabId);
      visible = !state.visible;
    }
    
    // Save sidebar state for this tab
    await SidebarStateManager.setSidebarVisibilityForTab(targetTabId, visible);
    
    // Ensure script is injected before sending message
    await ensureSidebarScriptInjected(targetTabId);
    
    // Send toggle command to tab
    try {
      await chrome.tabs.sendMessage(targetTabId, {
        action: 'toggleSidebar',
        visible,
        tabId: targetTabId
      });
    } catch (err) {
      logger.background.error(`Error sending toggle message to tab ${targetTabId}:`, err);
      // If message fails, try re-injecting script and sending again
      await injectContentScript(targetTabId, 'dist/sidebar-injector.bundle.js');
      await chrome.tabs.sendMessage(targetTabId, {
        action: 'toggleSidebar',
        visible,
        tabId: targetTabId
      });
    }
    
    // Release lock for this tab
    releaseLock(targetTabId);
    
    sendResponse({ 
      success: true, 
      visible, 
      tabId: targetTabId 
    });
  } catch (error) {
    // Make sure to release lock on error
    if (message.tabId) releaseLock(message.tabId);
    if (sender.tab && sender.tab.id) releaseLock(sender.tab.id);
    
    logger.background.error('Error handling tab-specific sidebar toggle:', error);
    sendResponse({ success: false, error: error.message });
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
    logger.background.info('Handling tab-specific sidebar state query');
    
    // Get target tab ID
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

/**
 * Ensure sidebar script is injected in the tab
 * @param {number} tabId - Tab ID
 */
async function ensureSidebarScriptInjected(tabId) {
  logger.background.info(`Ensuring sidebar script is injected in tab ${tabId}`);
  
  // First, check if content script is already loaded
  let isScriptLoaded = false;
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { action: 'ping' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 300))
    ]);
    isScriptLoaded = !!(response && response.ready);
    logger.background.info(`Content script check result: ${isScriptLoaded ? 'Loaded' : 'Not loaded'}`);
  } catch (error) {
    logger.background.info('Content script not loaded, will inject');
  }
  
  // Inject if needed
  if (!isScriptLoaded) {
    // First inject main content script
    const contentScriptResult = await injectContentScript(tabId, 'dist/content-script.bundle.js');
    if (!contentScriptResult) {
      logger.background.error(`Failed to inject main content script into tab ${tabId}`);
    }
    
    // Then inject sidebar script
    const sidebarScriptResult = await injectContentScript(tabId, 'dist/sidebar-injector.bundle.js');
    if (!sidebarScriptResult) {
      logger.background.error(`Failed to inject sidebar script into tab ${tabId}`);
    }
    
    // Give time for script to initialize
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}
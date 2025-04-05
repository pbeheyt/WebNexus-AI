// src/background/services/sidebar-manager.js - Tab-specific sidebar management

import SidebarStateManager from '../../services/SidebarStateManager.js';
import { injectContentScript } from './content-extraction.js';
import logger from '../../shared/logger.js';

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
 * Ensure both main content script and sidebar injector script are injected in the tab.
 * Injects them sequentially if they are missing.
 * @param {number} tabId - Tab ID
 */
export async function ensureSidebarScriptInjected(tabId) {
  logger.background.info(`Ensuring scripts are injected in tab ${tabId}`);
  const PING_TIMEOUT = 300; // ms
  const SCRIPT_INIT_DELAY = 150; // ms

  // 1. Check/Inject Main Content Script (content-script.bundle.js)
  let isMainContentLoaded = false;
  try {
    logger.background.debug(`Pinging main content script in tab ${tabId}`);
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { action: 'ping' }), // Generic ping
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), PING_TIMEOUT))
    ]);
    isMainContentLoaded = !!(response && response.ready);
    logger.background.info(`Main content script ping result for tab ${tabId}: ${isMainContentLoaded ? 'Loaded' : 'Not loaded'}`);
  } catch (error) {
    // Handle ping error (likely script not loaded or tab inaccessible)
    if (error.message?.includes('Timeout')) {
      logger.background.info(`Main content script ping timed out for tab ${tabId}. Assuming not loaded.`);
    } else if (error.message?.includes('Receiving end does not exist') || error.message?.includes('Could not establish connection')) {
      logger.background.info(`Main content script not reachable in tab ${tabId}. Assuming not loaded.`);
    } else {
      logger.background.warn(`Error pinging main content script in tab ${tabId}:`, error);
    }
    isMainContentLoaded = false;
  }

  if (!isMainContentLoaded) {
    logger.background.info(`Injecting main content script into tab ${tabId}`);
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['dist/content-script.bundle.js']
      });
      logger.background.info(`Successfully injected main content script into tab ${tabId}. Waiting for initialization...`);
      // Wait a bit for the script to potentially initialize
      await new Promise(resolve => setTimeout(resolve, SCRIPT_INIT_DELAY));
      isMainContentLoaded = true; // Assume success for the next step
    } catch (injectionError) {
      logger.background.error(`Failed to inject main content script into tab ${tabId}:`, injectionError);
      // Decide if we should proceed or stop if the main script fails
      // For now, we'll log the error and attempt to inject the sidebar script anyway,
      // but it might fail if it depends on the main script.
    }
  }

  // 2. Check/Inject Sidebar Injector Script (sidebar-injector.bundle.js)
  // Only proceed if the main script is loaded or was just injected
  if (isMainContentLoaded) {
    let isSidebarInjectorLoaded = false;
    try {
      logger.background.debug(`Pinging sidebar injector script in tab ${tabId}`);
      const response = await Promise.race([
        chrome.tabs.sendMessage(tabId, { action: 'pingSidebarInjector' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), PING_TIMEOUT))
      ]);
      isSidebarInjectorLoaded = !!(response && response.ready && response.type === 'sidebarInjector');
      logger.background.info(`Sidebar injector ping result for tab ${tabId}: ${isSidebarInjectorLoaded ? 'Loaded' : 'Not loaded'}`);
    } catch (error) {
      // Handle ping error
       if (error.message?.includes('Timeout')) {
        logger.background.info(`Sidebar injector ping timed out for tab ${tabId}. Assuming not loaded.`);
      } else if (error.message?.includes('Receiving end does not exist') || error.message?.includes('Could not establish connection')) {
        logger.background.info(`Sidebar injector not reachable in tab ${tabId}. Assuming not loaded.`);
      } else {
        logger.background.warn(`Error pinging sidebar injector in tab ${tabId}:`, error);
      }
      isSidebarInjectorLoaded = false;
    }

    if (!isSidebarInjectorLoaded) {
      logger.background.info(`Injecting sidebar injector script into tab ${tabId}`);
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['dist/sidebar-injector.bundle.js']
        });
        logger.background.info(`Successfully injected sidebar injector script into tab ${tabId}.`);
        // Optional: Add a small delay if needed for its initialization
        // await new Promise(resolve => setTimeout(resolve, 50));
      } catch (injectionError) {
        logger.background.error(`Failed to inject sidebar injector script into tab ${tabId}:`, injectionError);
      }
    }
  } else {
     logger.background.warn(`Skipping sidebar injector check/injection for tab ${tabId} because main content script is not loaded.`);
  }
}

// src/background/services/sidebar-manager.js - Sidebar management

import SidebarStateManager from '../../services/SidebarStateManager.js';
import { injectContentScript } from './content-extraction.js';
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
        await ensureSidebarScriptInjected(activeTab.id);
        // Send toggle command to active tab
        chrome.tabs.sendMessage(activeTab.id, {
          action: 'toggleSidebar',
          visible
        }).catch(err => {
          logger.background.error(`Error sending toggle message to tab ${activeTab.id}:`, err);
        });
      } else {
        throw new Error('No active tab found');
      }
    } else {
      await ensureSidebarScriptInjected(tabId);
      // Send toggle command to specified tab
      chrome.tabs.sendMessage(tabId, {
        action: 'toggleSidebar',
        visible
      }).catch(err => {
        logger.background.error(`Error sending toggle message to tab ${tabId}:`, err);
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
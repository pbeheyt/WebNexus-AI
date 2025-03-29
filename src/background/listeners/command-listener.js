// src/background/listeners/command-listener.js - Keyboard shortcuts

import { toggleSidebar } from '../services/sidebar-manager.js'; // Import the function directly
import logger from '../../utils/logger.js';

/**
 * Set up command listener for keyboard shortcuts
 */
export function setupCommandListener() {
  chrome.commands.onCommand.addListener(handleCommand);
  logger.background.info('Command listener initialized');
}

/**
 * Handle keyboard shortcut commands
 * @param {string} command - Command name
 */
async function handleCommand(command) {
  // Handle the sidebar toggle command
  if (command === "toggle-sidebar") {
    try {
      logger.background.info('Keyboard shortcut triggered: toggle-sidebar');
      
      // Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        logger.background.warn('No active tab found');
        return;
      }
      
      const activeTab = tabs[0];
      logger.background.info(`Active tab for sidebar toggle: ${activeTab.id}`);
      
      // Call toggleSidebar directly with appropriate parameters
      await toggleSidebar(
        { tabId: activeTab.id },  // message object with tabId
        { tab: activeTab },       // sender object with tab info
        (response) => {           // sendResponse callback
          if (!response.success) {
            logger.background.error('Sidebar toggle failed:', response);
          }
        }
      );
      
    } catch (error) {
      logger.background.error('Error handling sidebar toggle shortcut:', error);
    }
  }
}

// src/background/listeners/command-listener.js - Keyboard shortcuts

import { processContent } from '../services/content-processing.js';
import { toggleSidebar } from '../services/sidebar-manager.js'; // Import the function directly
import { STORAGE_KEYS } from '../../shared/constants.js';
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
  if (command === "process-page") {
    try {
      logger.background.info('Keyboard shortcut triggered: process-page');
      
      // Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        logger.background.warn('No active tab found');
        return;
      }
      
      const activeTab = tabs[0];
      logger.background.info(`Active tab: ${activeTab.id}, URL: ${activeTab.url}`);

      logger.background.info(`Processing full page content request from keyboard shortcut`);
      
      // Use centralized content processing for the full page
      const result = await processContent({
        tabId: activeTab.id,
        url: activeTab.url
        // No promptId/platformId to use user's preferred defaults
      });
      
      // Handle any errors that need UI feedback
      if (!result.success) {
        logger.background.error('Keyboard shortcut action failed:', result);
      }
      
    } catch (error) {
      logger.background.error('Error handling keyboard shortcut:', error);
    }
  }
  // Add handling for the sidebar toggle command
  else if (command === "toggle-sidebar") {
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
      
      // FIXED: Call toggleSidebar directly with appropriate parameters
      // This bypasses the message routing system and directly invokes the service
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

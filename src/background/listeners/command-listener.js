// src/background/listeners/command-listener.js - Keyboard shortcuts

import { toggleNativeSidePanel } from '../services/sidebar-manager.js'; // Import the updated function
import logger from '../../shared/logger.js';

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
      logger.background.info(`Active tab for native side panel toggle: ${activeTab.id}`);
      
      // Call toggleNativeSidePanel directly with appropriate parameters
      await toggleNativeSidePanel(
        { tabId: activeTab.id },  // message object with tabId
        { tab: activeTab },       // sender object with tab info
        async (response) => {     // Make the callback async
          if (response && response.success) {
            logger.background.info(`Native side panel ${response.visible ? 'enabled' : 'disabled'} via shortcut for tab ${activeTab.id}.`);
            // If enabled, open it from the user gesture context
            if (response.visible) {
              try {
                await chrome.sidePanel.open({ tabId: activeTab.id });
                logger.background.info(`Opened side panel via shortcut for tab ${activeTab.id}.`);
              } catch (openError) {
                logger.background.error(`Error opening side panel via shortcut for tab ${activeTab.id}:`, openError);
              }
            }
          } else {
            logger.background.error('Native side panel toggle failed via shortcut:', response);
          }
        }
      );
      
    } catch (error) {
      logger.background.error('Error handling native side panel toggle shortcut:', error);
    }
  }
}

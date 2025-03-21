// src/background/listeners/command-listener.js - Keyboard shortcuts

import { summarizeContent } from '../services/summarization.js';
import { detectTextSelection } from '../services/content-extraction.js';
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
  if (command === "summarize-page") {
    try {
      logger.background.info('Keyboard shortcut triggered: summarize-page');
      
      // Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        logger.background.warn('No active tab found');
        return;
      }
      
      const activeTab = tabs[0];
      logger.background.info(`Active tab: ${activeTab.id}, URL: ${activeTab.url}`);
      
      // First, determine behavior based on user settings
      let useSelection = true; // Default to respecting selection
      
      try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.SHORTCUT_SETTINGS);
        if (result[STORAGE_KEYS.SHORTCUT_SETTINGS] && 
            result[STORAGE_KEYS.SHORTCUT_SETTINGS].summarization_behavior) {
          useSelection = result[STORAGE_KEYS.SHORTCUT_SETTINGS].summarization_behavior === 'selection';
          logger.background.info(`Using shortcut behavior from settings: ${useSelection ? 'Respect selection' : 'Always full page'}`);
        }
      } catch (error) {
        logger.background.error('Error getting shortcut settings:', error);
        // Continue with default behavior
      }
      
      // If we're set to respect selection, we need to check if there's a selection
      let hasSelection = false;
      
      if (useSelection) {
        // Detect if there's a text selection
        hasSelection = await detectTextSelection(activeTab.id);
      }

      logger.background.info(`Summarize content request from keyboard`);
      
      // Use centralized summarization process
      const result = await summarizeContent({
        tabId: activeTab.id,
        url: activeTab.url,
        hasSelection
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
      
      // Toggle sidebar using existing functionality
      await chrome.runtime.sendMessage({
        action: 'toggleSidebar',
        tabId: activeTab.id
      });
      
    } catch (error) {
      logger.background.error('Error handling sidebar toggle shortcut:', error);
    }
  }
}
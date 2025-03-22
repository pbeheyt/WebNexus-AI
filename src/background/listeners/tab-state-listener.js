// src/background/listeners/tab-state-listener.js - Tab state cleanup

import SidebarStateManager from '../../services/SidebarStateManager.js';
import logger from '../../utils/logger.js';

/**
 * Set up tab state cleanup listeners
 */
export function setupTabStateListener() {
  // Clean up tab states when tabs are closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    logger.background.info(`Tab ${tabId} closed, cleaning up sidebar state`);
    SidebarStateManager.cleanupTabStates();
  });

  // Periodically clean up tab states to prevent storage bloat
  setInterval(() => {
    SidebarStateManager.cleanupTabStates();
  }, 3600000); // Clean up every hour

  logger.background.info('Tab state listener initialized');
}
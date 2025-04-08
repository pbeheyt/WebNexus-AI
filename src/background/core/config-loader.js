// src/background/core/config-loader.js - Configuration manager initialization

import sidebarStateManager from '../../services/SidebarStateManager.js';
import logger from '../../shared/logger.js';

/**
 * Initialize configuration manager
 * @returns {Promise<void>}
 */
export async function initializeConfigManager() {
  try {
    // Initialize sidebar state
    sidebarStateManager.initialize();
    logger.background.info('SidebarStateManager initialized');
  } catch (error) {
    logger.background.error('Error initializing configuration:', error);
    throw error;
  }
}

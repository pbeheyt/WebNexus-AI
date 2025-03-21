// src/background/core/config-loader.js - Configuration loading and management

import configManager from '../../services/ConfigManager.js';
import sidebarStateManager from '../../services/SidebarStateManager.js';
import logger from '../../utils/logger.js';

/**
 * Initialize configuration manager
 * @returns {Promise<void>}
 */
export async function initializeConfigManager() {
  try {
    // Initialize main configuration
    await configManager.initialize();
    logger.background.info('ConfigManager initialized');
    
    // Initialize sidebar state
    sidebarStateManager.initialize();
    logger.background.info('SidebarStateManager initialized');
  } catch (error) {
    logger.background.error('Error initializing configuration:', error);
    throw error;
  }
}

/**
 * Load platform configuration
 * @param {string} platformId - Platform identifier
 * @returns {Promise<Object|null>} Platform configuration
 */
export async function getPlatformConfig(platformId) {
  try {
    logger.background.info(`Getting config for platform: ${platformId}`);
    const response = await fetch(chrome.runtime.getURL('platform-config.json'));
    const config = await response.json();

    if (config.aiPlatforms && config.aiPlatforms[platformId]) {
      return config.aiPlatforms[platformId];
    } else {
      logger.background.error(`Platform config not found for: ${platformId}`);
      return null;
    }
  } catch (error) {
    logger.background.error(`Error loading platform config for ${platformId}:`, error);
    return null;
  }
}

/**
 * Subscribe to configuration changes
 * This sets up listeners for any configuration changes in storage
 */
export function setupConfigChangeListeners() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.template_configuration) {
      logger.background.info('Template configuration changed in storage');
    }
  });
}

// Set up config change listeners when this module is loaded
setupConfigChangeListeners();
// src/background/initialization.js - Handles extension initialization

import { initializeConfigManager } from './core/config-loader.js';
import { resetState } from './core/state-manager.js';
import logger from '../utils/logger.js';

/**
 * Initialize the extension
 * Sets up configuration, resets state, and creates UI elements
 * Only called during installation/update
 */
export async function initializeExtension() {
  logger.background.info('Initializing extension on installation/update');

  try {
    // 1. Initialize configuration in storage
    await initializeConfigManager();
    logger.background.info('Configuration initialized');

    // 2. Reset state
    await resetState();
    logger.background.info('Initial state reset complete');
    
    return true;
  } catch (error) {
    logger.background.error('Initialization error:', error);
    throw error;
  }
}

/**
 * Handle extension installation or update
 * @param {Object} details - Installation details
 */
export async function handleInstallation(details) {
  logger.background.info('Extension installed/updated', details);
  await initializeExtension();
}

// Setup installation handler - ONLY place where context menus are created
chrome.runtime.onInstalled.addListener(handleInstallation);
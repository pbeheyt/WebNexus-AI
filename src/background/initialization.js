// src/background/initialization.js - Handles extension initialization

import { logger } from '../shared/logger.js';
import { STORAGE_KEYS } from '../shared/constants.js';
import { ensureDefaultPrompts, performFullPromptRepopulation } from '../shared/utils/prompt-utils.js';
import ConfigService from '../services/ConfigService.js';

import { resetState } from './core/state-manager.js';

/**
 * Populates initial prompts from prompt-config.json and sets default prompts if not already done.
 * Uses the storage structure with _defaultPromptId_ keys.
 * Relies on the performFullPromptRepopulation shared utility.
 * @returns {Promise<boolean>} True if population ran, false if already populated or failed.
 */
async function populateInitialPromptsAndSetDefaults() {
  const flagKey = STORAGE_KEYS.INITIAL_PROMPTS_POPULATED_FLAG;
  try {
    const flagResult = await chrome.storage.local.get(flagKey);
    if (flagResult[flagKey] === true) {
      logger.background.info('Initial prompts already populated. Ensuring defaults are still valid...');
      await ensureDefaultPrompts(); // Still good to ensure defaults on subsequent starts.
      return false; // Already populated
    }

    logger.background.info('Initial prompts not populated. Running full repopulation...');
    const success = await performFullPromptRepopulation();

    if (success) {
      await chrome.storage.local.set({ [flagKey]: true });
      logger.background.info('Set initial prompts populated flag after successful repopulation.');
      return true; // Population ran
    } else {
      logger.background.error('Full prompt repopulation failed during initial setup.');
      return false; // Population failed
    }

  } catch (error) {
    logger.background.error('Error in populateInitialPromptsAndSetDefaults:', error);
    return false;
  }
}

/**
 * Initialize the extension's core configuration and state.
 * Should run on install and update.
 */
async function initializeExtension() {
  logger.background.info('Running core extension initialization...');
  try {
    await resetState();
    logger.background.info('Volatile state reset complete');


    return true;
  } catch (error) {
    logger.background.error('Core initialization error:', error);
    throw error;
  }
}

/**
 * Handle extension installation or update event.
 * @param {Object} details - Installation details (reason: "install", "update", "chrome_update")
 */
async function handleInstallation(details) {
  logger.background.info(`Extension event: ${details.reason}`, details);

  // --- Default Prompt Initialization Logic ---
  // Call the main initialization function on install.
  // It handles the flag check internally and ensures pointers are set.
  if (details.reason === 'install') {
     logger.background.info('Reason is "install", running populateInitialPromptsAndSetDefaults...');
     await populateInitialPromptsAndSetDefaults();
  }
  // No specific call for 'update' needed here for this logic, 
  // as ensureDefaultPrompts in startBackgroundService will handle consistency.

  // --- Set Default Popup Platform Preference ---
  if (details.reason === 'install') {
    logger.background.info(
      'Setting default popup platform preference on install...'
    );
    try {
      const platformList = await ConfigService.getAllPlatformConfigs();

      if (platformList && platformList.length > 0) {
        const defaultPlatformId = platformList[0].id; // Use the ID of the first platform
          await chrome.storage.sync.set({
            [STORAGE_KEYS.POPUP_DEFAULT_PLATFORM_ID]: defaultPlatformId,
          });
        logger.background.info(
          `Default popup platform set to: ${defaultPlatformId}`
        );
      } else {
        logger.background.warn(
          'No platforms found in config, cannot set default popup platform.'
        );
      }
    } catch (error) {
      logger.background.error(
        'Error setting default popup platform preference:',
        error
      );
    }
  }
  // --- End Set Default Popup Platform Preference ---

  // --- Core Initialization ---
  // Run general initialization on both install and update.
  // It's generally safe to run this multiple times.
  try {
    await initializeExtension();
    logger.background.info('Core extension initialization completed.');

    // --- Context Menu Setup ---
    logger.background.info('Setting up context menu...');
    try {
      // Remove existing menu items first to prevent duplicates on update
      await chrome.contextMenus.removeAll();
      // Create the new context menu item
      await chrome.contextMenus.create({
        id: 'menu-quick-process',
        title: 'Process in Web UI (Default Prompt)',
        contexts: ['page'], // Show only when right-clicking on the page
      });
      logger.background.info('Context menu created successfully.');
    } catch (menuError) {
      logger.background.error('Failed to create context menu:', menuError);
    }
  } catch (error) {
    logger.background.error(
      'Failed to complete core extension initialization after install/update event.'
    );
  }
}

// Setup installation handler
chrome.runtime.onInstalled.addListener(handleInstallation);

export { initializeExtension, populateInitialPromptsAndSetDefaults, handleInstallation };

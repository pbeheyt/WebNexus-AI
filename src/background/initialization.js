import { logger } from '../shared/logger.js';
import {
  STORAGE_KEYS,
  DEFAULT_EXTRACTION_STRATEGY,
} from '../shared/constants.js';
import { populateInitialPrompts } from '../shared/utils/prompt-utils.js';
import ConfigService from '../services/ConfigService.js';
import SidePanelStateManager from '../services/SidePanelStateManager.js';

import { resetState } from './core/state-manager.js';

/* Removed old populateInitialPromptsAndSetDefaults function */

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

  if (details.reason === 'update') {
    logger.background.info(
      'Extension updated. Invalidating configuration cache.'
    );
    ConfigService.invalidateCache();
  }

  try {
    // --- Default Prompt Initialization Logic ---
    // Reset all tab UI states as Chrome closes them on install/update.
    try {
      logger.background.info(
        'Resetting all tab UI states due to installation event...'
      );
      await SidePanelStateManager.resetAllTabUIStates();
      logger.background.info('Tab UI states reset successfully.');
    } catch (resetError) {
      logger.background.error(
        'Error resetting tab UI states during installation:',
        resetError
      );
    }

    // --- Prompt Management ---
    if (details.reason === 'install') {
      logger.background.info('Reason is "install", populating initial prompts...');
      await populateInitialPrompts();

      // --- First-Time Default Settings ---
      logger.background.info('Setting first-time defaults...');
      // Set default platform
      const platformList = await ConfigService.getAllPlatformConfigs();
      if (platformList?.length > 0) {
        await chrome.storage.sync.set({
          [STORAGE_KEYS.POPUP_DEFAULT_PLATFORM_ID]: platformList[0].id,
        });
        logger.background.info(`Default popup platform set to: ${platformList[0].id}`);
      }
      // Set default extraction strategy
      await chrome.storage.sync.set({
        [STORAGE_KEYS.GENERAL_CONTENT_EXTRACTION_STRATEGY]: DEFAULT_EXTRACTION_STRATEGY,
      });
      logger.background.info(`Default extraction strategy set to: ${DEFAULT_EXTRACTION_STRATEGY}`);
    }

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

    // --- Set Default General Content Extraction Strategy ---
    logger.background.info(
      'Setting default general content extraction strategy on install...'
    );
    try {
      await chrome.storage.sync.set({
        [STORAGE_KEYS.GENERAL_CONTENT_EXTRACTION_STRATEGY]:
          DEFAULT_EXTRACTION_STRATEGY,
      });
      logger.background.info(
        `Default general content extraction strategy set to: ${DEFAULT_EXTRACTION_STRATEGY}`
      );
    } catch (error) {
      logger.background.error(
        'Error setting default general content extraction strategy:',
        error
      );
    }
    // --- End Set Default General Content Extraction Strategy ---

    // --- Core Initialization ---
    // Run general initialization on both install and update.
    // It's generally safe to run this multiple times.
    try {
      await initializeExtension();
      logger.background.info('Core extension initialization completed.');

      // Context menu is now created dynamically by tab listeners,
      // so we only need to ensure any old menus are cleared on install/update.
      logger.background.info('Clearing all context menus on installation...');
      try {
        await chrome.contextMenus.removeAll();
        logger.background.info('Context menus cleared successfully.');
      } catch (menuError) {
        logger.background.error('Failed to clear context menus:', menuError);
      }
    } catch (error) {
      logger.background.error(
        'Failed to complete core extension initialization after install/update event.',
        error
      );
    }
  } catch (outerError) {
    logger.background.error(
      `Critical error during extension installation event (${details.reason}):`,
      outerError
    );
  }
}

// Setup installation handler
chrome.runtime.onInstalled.addListener(handleInstallation);

export { initializeExtension, handleInstallation };

// src/background/initialization.js - Handles extension initialization

import { logger } from '../shared/logger.js';
import { STORAGE_KEYS } from '../shared/constants.js';
import { ensureDefaultPrompts } from '../shared/utils/prompt-utils.js';
import ConfigService from '../services/ConfigService.js';

import { resetState } from './core/state-manager.js';

/**
 * Ensures the default prompts from the config file exist in local storage.
 * Runs only if the initialization flag is not set locally for this device.
 * @returns {Promise<boolean>} True if initialization ran, false otherwise.
 */
async function ensureLocalDefaultPromptsExist() {
  const flagKey = STORAGE_KEYS.DEFAULT_PROMPTS_INIT_FLAG;
  try {
    const flagResult = await chrome.storage.local.get(flagKey);
    // Check if the flag is true for *this specific device*
    if (flagResult[flagKey] === true) {
      logger.background.info('Default prompts flag already set locally. Skipping population.');
      return false; // Already initialized on this device
    }

    logger.background.info('Local default prompts flag not set. Populating defaults...');
    // Fetch default prompts from config file
    const response = await fetch(chrome.runtime.getURL('prompt-config.json'));
    if (!response.ok) {
      throw new Error(`Failed to fetch prompt-config.json: ${response.statusText}`);
    }
    const defaultPromptsConfig = await response.json();

    // Fetch existing custom prompts from local storage
    const localResult = await chrome.storage.local.get(STORAGE_KEYS.CUSTOM_PROMPTS);
    // Ensure we initialize with an empty object if storage is empty or corrupt
    const promptsByType = typeof localResult[STORAGE_KEYS.CUSTOM_PROMPTS] === 'object' && localResult[STORAGE_KEYS.CUSTOM_PROMPTS] !== null
      ? { ...localResult[STORAGE_KEYS.CUSTOM_PROMPTS] } // Use spread for a mutable copy
      : {};

    let promptsAdded = false;

    // Iterate through content types in the default config
    for (const contentType in defaultPromptsConfig) {
      if (Object.hasOwnProperty.call(defaultPromptsConfig, contentType)) {
        // Ensure the content type exists in the local storage structure
        if (!promptsByType[contentType]) {
          promptsByType[contentType] = { prompts: {} };
        } else if (typeof promptsByType[contentType].prompts !== 'object' || promptsByType[contentType].prompts === null) {
          // Handle case where content type exists but prompts object is missing/invalid
          promptsByType[contentType].prompts = {};
        }

        const defaultPromptsForType = defaultPromptsConfig[contentType];
        const existingPrompts = promptsByType[contentType].prompts;

        // Iterate through default prompts defined for this content type in the config
        for (const defaultPromptName in defaultPromptsForType) {
          if (Object.hasOwnProperty.call(defaultPromptsForType, defaultPromptName)) {
            const defaultPromptContent = defaultPromptsForType[defaultPromptName];

            // Check if a prompt with the same name already exists in local storage for this type
            const nameExists = Object.values(existingPrompts).some(
              (prompt) => prompt && typeof prompt === 'object' && prompt.name === defaultPromptName
            );

            if (!nameExists) {
              // Prompt doesn't exist locally, create and add it
              const newPromptId = `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
              const now = new Date().toISOString();
              const newPrompt = {
                id: newPromptId,
                name: defaultPromptName,
                content: defaultPromptContent,
                contentType: contentType, // Use the key from the config
                createdAt: now,
                updatedAt: now,
              };
              promptsByType[contentType].prompts[newPromptId] = newPrompt;
              promptsAdded = true;
              logger.background.info(`Added default prompt locally: "${defaultPromptName}" for type "${contentType}"`);
            } else {
               logger.background.info(`Default prompt "${defaultPromptName}" for type "${contentType}" already exists locally. Skipping.`);
            }
          }
        }
      }
    }

    // Save the potentially updated custom prompts back to local storage
    if (promptsAdded) {
      await chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_PROMPTS]: promptsByType });
      logger.background.info('Successfully added/updated custom prompts in local storage.');
    } else {
      logger.background.info('No new default prompts needed to be added locally.');
    }

    // Set the local flag indicating defaults have been populated on this device
    await chrome.storage.local.set({ [flagKey]: true });
    logger.background.info('Set local default prompts initialization flag.');
    return true; // Initialization ran

  } catch (error) {
    logger.background.error('Error ensuring local default prompts exist:', error);
    return false; // Indicate failure
  }
}

/**
 * Initializes default prompts from prompt-config.json into local storage
 * if they haven't been initialized before on this device.
 * Also ensures the default prompt pointers are set correctly afterwards.
 * Intended to be called on install or startup.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function initializeDefaultPrompts() {
  logger.background.info('Running default prompt initialization check...');
  try {
    // Step 1: Ensure the base prompts exist locally (runs only if flag not set)
    await ensureLocalDefaultPromptsExist();

    // Step 2: Always run ensureDefaultPrompts afterwards to set the default pointers
    // based on the prompts that are now guaranteed to exist locally.
    await ensureDefaultPrompts();
    logger.background.info('Ensured default prompt pointers are set.');

    return true; // Indicate overall success of the flow
  } catch (error) {
    logger.background.error('Error during full default prompt initialization flow:', error);
    return false; // Indicate failure
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

    // Reset all tab sidebar visibility states to false
    logger.background.info(
      'Resetting all tab sidebar visibility states to false...'
    );
    const tabs = await chrome.tabs.query({});
    const initialSidebarStates = {};
    for (const tab of tabs) {
      if (tab.id) {
        initialSidebarStates[tab.id.toString()] = false;
      }
    }
    await chrome.storage.local.set({
      [STORAGE_KEYS.TAB_SIDEBAR_STATES]: initialSidebarStates,
    });
    logger.background.info('All tab sidebar visibility states reset.');

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
     logger.background.info('Reason is "install", running initializeDefaultPrompts...');
     await initializeDefaultPrompts(); // This now handles the necessary checks and actions
  } else {
     logger.background.info(`Reason is "${details.reason}", skipping prompt initialization in handleInstallation.`);
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
        await chrome.storage.local.set({
          [STORAGE_KEYS.POPUP_PLATFORM]: defaultPlatformId,
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

export { initializeExtension, initializeDefaultPrompts, handleInstallation };

// src/background/initialization.js - Handles extension initialization

import { logger } from '../shared/logger.js';
import { STORAGE_KEYS } from '../shared/constants.js';
import { ensureDefaultPrompts } from '../shared/utils/prompt-utils.js';
import ConfigService from '../services/ConfigService.js';

import { resetState } from './core/state-manager.js';

/**
 * Populates initial prompts from prompt-config.json and sets default prompts.
 * Uses the new V2 storage structure with _defaultPromptId_ keys.
 * @returns {Promise<boolean>} True if population ran, false if already populated
 */
async function populateInitialPromptsAndSetDefaults() {
  const flagKey = STORAGE_KEYS.INITIAL_PROMPTS_POPULATED;
  try {
    const flagResult = await chrome.storage.local.get(flagKey);
    if (flagResult[flagKey] === true) {
      logger.background.info('Initial prompts already populated. Ensuring defaults are still valid...');
      await ensureDefaultPrompts();
      return false; // Already populated
    }

    logger.background.info('Populating initial prompts and setting defaults...');
    
    const response = await fetch(chrome.runtime.getURL('prompt-config.json'));
    if (!response.ok) {
      throw new Error(`Failed to fetch prompt-config.json: ${response.statusText}`);
    }
    const defaultPromptsConfig = await response.json();

    const customPromptsStorage = await chrome.storage.local.get(STORAGE_KEYS.PROMPTS);
    // Initialize with an empty object if storage is empty or corrupt for PROMPTS
    const newCustomPromptsStructure = customPromptsStorage[STORAGE_KEYS.PROMPTS] && typeof customPromptsStorage[STORAGE_KEYS.PROMPTS] === 'object' 
                                      ? { ...customPromptsStorage[STORAGE_KEYS.PROMPTS] } 
                                      : {};

    let promptsAddedOrDefaultsChanged = false;

    for (const contentType in defaultPromptsConfig) {
      if (Object.hasOwnProperty.call(defaultPromptsConfig, contentType)) {
        if (!newCustomPromptsStructure[contentType]) {
          newCustomPromptsStructure[contentType] = {}; // Initialize content type object
        }

        const defaultPromptsForType = defaultPromptsConfig[contentType];
        let firstPromptIdForThisType = null;

        for (const defaultPromptName in defaultPromptsForType) {
          if (Object.hasOwnProperty.call(defaultPromptsForType, defaultPromptName)) {
            const defaultPromptContent = defaultPromptsForType[defaultPromptName];
            
            // Check if a prompt with this name ALREADY exists under this contentType in the new structure
            const existingPromptWithSameName = Object.values(newCustomPromptsStructure[contentType] || {}).find(
              p => typeof p === 'object' && p.name === defaultPromptName
            );

            if (!existingPromptWithSameName) {
              const newPromptId = `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
              const now = new Date().toISOString();
              newCustomPromptsStructure[contentType][newPromptId] = {
                name: defaultPromptName,
                content: defaultPromptContent,
                createdAt: now,
                updatedAt: now,
              };
              promptsAddedOrDefaultsChanged = true;
              if (!firstPromptIdForThisType) {
                firstPromptIdForThisType = newPromptId;
              }
              logger.background.info(`Added initial prompt: "${defaultPromptName}" for type "${contentType}" with ID ${newPromptId}`);
            } else {
              logger.background.info(`Initial prompt "${defaultPromptName}" for type "${contentType}" already exists or name collision. Skipping.`);
              if (!firstPromptIdForThisType && existingPromptWithSameName.id /* if old structure had id */) {
                 // This case is tricky if migrating from an even older structure. For fresh V2, less likely.
                 // We need an ID for the existing prompt to set it as default if it's the first one we encounter.
                 // This part might need adjustment if handling very old data. For now, assume new IDs are generated.
              } else if (!firstPromptIdForThisType) {
                 // Find the ID of the existing prompt to set it as default
                 const idOfExisting = Object.entries(newCustomPromptsStructure[contentType] || {}).find(
                    ([, p]) => typeof p === 'object' && p.name === defaultPromptName
                 )?.[0];
                 if (idOfExisting) firstPromptIdForThisType = idOfExisting;
              }
            }
          }
        }

        // Set the default prompt ID for this content type if one was added/found
        // and if there isn't already a default set (e.g. from a partial previous run or manual edit)
        if (firstPromptIdForThisType && !newCustomPromptsStructure[contentType]['_defaultPromptId_']) {
          newCustomPromptsStructure[contentType]['_defaultPromptId_'] = firstPromptIdForThisType;
          promptsAddedOrDefaultsChanged = true;
          logger.background.info(`Set initial default prompt for "${contentType}" to ID ${firstPromptIdForThisType}`);
        }
      }
    }

    if (promptsAddedOrDefaultsChanged) {
      await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: newCustomPromptsStructure });
      logger.background.info('Successfully populated initial prompts and set defaults into PROMPTS.');
    } else {
      logger.background.info('No new initial prompts needed or defaults to set in PROMPTS.');
    }
    
    await chrome.storage.local.set({ [flagKey]: true });
    logger.background.info('Set initial prompts populated flag (V2).');

    // After populating, ensure all defaults are valid (handles cases where config might be empty for a type)
    await ensureDefaultPrompts(); // This will be the refactored version

    return true; // Population ran
  } catch (error) {
    logger.background.error('Error populating initial prompts (V2):', error);
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
     logger.background.info('Reason is "install", running populateInitialPromptsAndSetDefaults (V2)...');
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

export { initializeExtension, populateInitialPromptsAndSetDefaults, handleInstallation };

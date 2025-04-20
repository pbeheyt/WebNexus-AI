// src/background/initialization.js - Handles extension initialization

import { resetState } from './core/state-manager.js';
import logger from '../shared/logger.js';
import { STORAGE_KEYS } from '../shared/constants.js';

/**
 * Initializes default prompts from prompt-config.json into sync storage
 * if they haven't been initialized before. This should only run once.
 */
async function initializeDefaultPrompts() {
  // This log should now appear if the function is called correctly
  logger.background.info('Attempting to initialize default prompts...');
  try {
    // Fetch default prompts from config file
    const response = await fetch(chrome.runtime.getURL('prompt-config.json'));
    if (!response.ok) {
      throw new Error(`Failed to fetch prompt-config.json: ${response.statusText}`);
    }
    const defaultPromptsConfig = await response.json();

    // Fetch existing custom prompts from sync storage
    const syncResult = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
    const promptsByType = typeof syncResult[STORAGE_KEYS.CUSTOM_PROMPTS] === 'object' && syncResult[STORAGE_KEYS.CUSTOM_PROMPTS] !== null
      ? syncResult[STORAGE_KEYS.CUSTOM_PROMPTS]
      : {};

    let promptsAdded = false;

    // Iterate through content types in the default config
    for (const contentType in defaultPromptsConfig) {
      if (Object.hasOwnProperty.call(defaultPromptsConfig, contentType)) {
        // Ensure the content type exists in the sync storage structure
        if (!promptsByType[contentType]) {
          promptsByType[contentType] = { prompts: {} };
        } else if (typeof promptsByType[contentType].prompts !== 'object' || promptsByType[contentType].prompts === null) {
          promptsByType[contentType].prompts = {};
        }

        const defaultPromptsForType = defaultPromptsConfig[contentType];

        // Iterate through prompts defined for this content type in the default config
        for (const defaultPromptName in defaultPromptsForType) {
          if (Object.hasOwnProperty.call(defaultPromptsForType, defaultPromptName)) {
            const defaultPromptContent = defaultPromptsForType[defaultPromptName];

            // Check if a prompt with the same name already exists in sync storage for this type
            const existingPrompts = promptsByType[contentType].prompts;
            const nameExists = Object.values(existingPrompts).some(
              (prompt) => prompt && typeof prompt === 'object' && prompt.name === defaultPromptName
            );

            if (!nameExists) {
              // Prompt doesn't exist, create and add it
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
              logger.background.info(`Added default prompt: "${defaultPromptName}" for type "${contentType}"`);
            } else {
              logger.background.info(`Default prompt "${defaultPromptName}" for type "${contentType}" already exists. Skipping.`);
            }
          }
        }
      }
    }

    // Save back to sync storage if any prompts were added
    if (promptsAdded) {
      await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_PROMPTS]: promptsByType });
      logger.background.info('Successfully added default prompts to sync storage.');
    } else {
      logger.background.info('No new default prompts needed to be added.');
    }

    // Return true indicating success (or at least completion without error)
    return true;

  } catch (error) {
    logger.background.error('Error initializing default prompts:', error);
    // Return false indicating failure
    return false;
  }
}

/**
 * Initialize the extension's core configuration and state.
 * Should run on install and update.
 */
export async function initializeExtension() {
  logger.background.info('Running core extension initialization...');
  try {
    await resetState();
    logger.background.info('Volatile state reset complete');

    // Reset all tab sidebar visibility states to false
    logger.background.info('Resetting all tab sidebar visibility states to false...');
    const tabs = await chrome.tabs.query({});
    const initialSidebarStates = {};
    for (const tab of tabs) {
      if (tab.id) {
        initialSidebarStates[tab.id.toString()] = false;
      }
    }
    await chrome.storage.local.set({ 
      [STORAGE_KEYS.TAB_SIDEBAR_STATES]: initialSidebarStates 
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
export async function handleInstallation(details) {
  logger.background.info(`Extension event: ${details.reason}`, details);

  // --- Default Prompt Initialization Logic ---
  if (details.reason === 'install') {
    logger.background.info('Reason is "install", checking default prompt initialization flag...');
    const flagKey = STORAGE_KEYS.DEFAULT_PROMPTS_INIT_FLAG;
    try {
      const flagResult = await chrome.storage.local.get(flagKey);
      if (!flagResult[flagKey]) { // Only run if flag is not true
        logger.background.info('Initialization flag not set. Proceeding with default prompt initialization.');
        const promptInitSuccess = await initializeDefaultPrompts();
        if (promptInitSuccess) {
          // Set the flag only if initialization completed successfully
          await chrome.storage.local.set({ [flagKey]: true });
          logger.background.info('Set default prompts initialization flag.');
        } else {
           logger.background.warn('Default prompt initialization failed. Flag not set.');
        }
      } else {
        logger.background.info('Default prompts initialization flag is already set. Skipping.');
      }
    } catch (error) {
      logger.background.error('Error during default prompt initialization check:', error);
    }
  } else {
     logger.background.info(`Reason is "${details.reason}", skipping default prompt initialization.`);
  }

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
        id: "nexusai-quick-process",
        title: "Nexus AI: Process with Default Prompt",
        contexts: ["page"], // Show only when right-clicking on the page
      });
      logger.background.info('Context menu created successfully.');
    } catch (menuError) {
      logger.background.error('Failed to create context menu:', menuError);
    }

  } catch(error) {
     logger.background.error('Failed to complete core extension initialization after install/update event.');
  }
}

// Setup installation handler
chrome.runtime.onInstalled.addListener(handleInstallation);

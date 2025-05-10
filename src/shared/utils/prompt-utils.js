// src/shared/utils/prompt-utils.js
import { logger } from '../logger';
import { STORAGE_KEYS, CONTENT_TYPES } from '../constants';

/**
 * Ensures that every content type with at least one prompt has a valid default prompt assigned.
 * Uses the new _defaultPromptId_ key within the PROMPTS structure.
 * @returns {Promise<boolean>} True if changes were made, false otherwise.
 */
/**
 * Performs a full repopulation of prompts from prompt-config.json.
 * It fetches the config, merges/sets prompts in storage, and ensures defaults are set.
 * This function does NOT manage the INITIAL_PROMPTS_POPULATED flag.
 * @returns {Promise<boolean>} True if repopulation was successful, false otherwise.
 */
export async function performFullPromptRepopulation() {
  logger.service.info('Starting full prompt repopulation...');
  try {
    const response = await fetch(chrome.runtime.getURL('prompt-config.json'));
    if (!response.ok) {
      throw new Error(`Failed to fetch prompt-config.json: ${response.statusText}`);
    }
    const defaultPromptsConfig = await response.json();

        const newCustomPromptsStructure = {}; // Start fresh for a full repopulation

    let promptsAddedOrDefaultsChanged = false; // To track if any actual changes are made

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
            logger.service.info(`Added initial prompt: "${defaultPromptName}" for type "${contentType}" with ID ${newPromptId} during repopulation.`);
          }
        }

        if (firstPromptIdForThisType) {
          newCustomPromptsStructure[contentType]['_defaultPromptId_'] = firstPromptIdForThisType;
          promptsAddedOrDefaultsChanged = true;
          logger.service.info(`Set initial default prompt for "${contentType}" to ID ${firstPromptIdForThisType} during repopulation.`);
        }
      }
    }

    if (promptsAddedOrDefaultsChanged || Object.keys(newCustomPromptsStructure).length > 0) {
      await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: newCustomPromptsStructure });
      logger.service.info('Successfully repopulated prompts into PROMPTS storage.');
    } else {
      logger.service.info('No new prompts to repopulate from config, or config was empty.');
      // Ensure an empty object is set if no prompts were found to clear out old data
      await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: {} });
    }
    
    // Crucially, call ensureDefaultPrompts after repopulating.
    await ensureDefaultPrompts();
    logger.service.info('Full prompt repopulation completed and defaults ensured.');
    return true;
  } catch (error) {
    logger.service.error('Error during full prompt repopulation:', error);
    return false;
  }
}

export async function ensureDefaultPrompts() {
  try {
    const promptsResult = await chrome.storage.local.get(STORAGE_KEYS.PROMPTS);
    const customPromptsByType = promptsResult[STORAGE_KEYS.PROMPTS] || {};
    let changesMade = false;

    for (const contentType of Object.values(CONTENT_TYPES)) {
      const typeData = customPromptsByType[contentType] || {};
      const currentDefaultId = typeData['_defaultPromptId_'];
      
      // Extract actual prompts, excluding the _defaultPromptId_ key
      const actualPrompts = {};
      for (const key in typeData) {
        if (key !== '_defaultPromptId_') {
          actualPrompts[key] = typeData[key];
        }
      }
      const promptIdsForType = Object.keys(actualPrompts);

      if (promptIdsForType.length > 0) {
        // Prompts exist for this type
        const isCurrentDefaultValid = currentDefaultId && actualPrompts[currentDefaultId];

        if (!isCurrentDefaultValid) {
          // Default is missing or invalid, set to the first available prompt
          if (!customPromptsByType[contentType]) { // Ensure content type object exists
             customPromptsByType[contentType] = {};
          }
          customPromptsByType[contentType]['_defaultPromptId_'] = promptIdsForType[0];
          changesMade = true;
          logger.service.info(`Set/fixed default prompt for ${contentType} to ${promptIdsForType[0]}`);
        }
      } else {
        // No prompts exist for this type
        if (currentDefaultId) {
          // A default is set, but there are no prompts, so remove the default setting
          if (customPromptsByType[contentType]) { // Check if contentType entry exists
            delete customPromptsByType[contentType]['_defaultPromptId_'];
             // If the content type object becomes empty after removing _defaultPromptId_, remove the content type object itself
            if (Object.keys(customPromptsByType[contentType]).length === 0) {
                delete customPromptsByType[contentType];
            }
            changesMade = true;
            logger.service.info(`Removed default prompt setting for empty content type ${contentType}`);
          }
        }
      }
    }

    if (changesMade) {
      await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: customPromptsByType });
      logger.service.info('PROMPTS updated by ensureDefaultPrompts.');
    }
    return changesMade;
  } catch (error) {
    logger.service.error('Error in ensureDefaultPrompts (V2):', error);
    return false;
  }
}

/**
 * Loads custom prompts relevant to a specific content type, including shared prompts.
 *
 * @param {string} contentType - The content type to load prompts for (e.g., 'general', 'youtube').
 * @returns {Promise<Array<{id: string, name: string, content: string, contentType: string}>>} - A promise that resolves to a sorted array of relevant prompt objects.
 */
export async function loadRelevantPrompts(contentType) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PROMPTS);
    const promptsByType = result[STORAGE_KEYS.PROMPTS] || {};

    // Get prompts for the requested type
    const typePromptsData = promptsByType[contentType] || {}; // Ensure typePromptsData is what was typePromptsObj
        const relevantPrompts = Object.entries(typePromptsData)
          .filter(([key]) => key !== '_defaultPromptId_') // Skip the default prompt ID key
          .map(([id, promptObjectValue]) => ({
            id, // The key is the ID
            ...promptObjectValue, // Spread the properties of promptObjectValue (name, content, createdAt, updatedAt)
            contentType: contentType, // Add contentType
            // contentTypeLabel is already added if needed by the caller based on contentType
          }));

        // Sort prompts alphabetically by name (now directly accessible)
        relevantPrompts.sort((a, b) => a.name.localeCompare(b.name));

    return relevantPrompts;
  } catch (error) {
    logger.service.error('Error loading relevant prompts:', error);
    return []; // Return empty array on error
  }
}

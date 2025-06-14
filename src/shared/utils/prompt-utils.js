// src/shared/utils/prompt-utils.js
import { logger } from '../logger';
import { STORAGE_KEYS, CONTENT_TYPES } from '../constants';

/**
 * Internal pure function to validate and fix default prompt IDs on a given object.
 * Does not interact with chrome.storage.
 * @param {object} promptsByType - The prompt object to validate.
 * @returns {{prompts: object, changesMade: boolean}} - The corrected object and a flag indicating if changes were made.
 */
function _validateAndFixDefaultsOnObject(promptsByType) {
  let changesMade = false;
  // Deep copy to avoid mutating the original object, ensuring pure function behavior.
  const correctedPrompts = JSON.parse(JSON.stringify(promptsByType));

  for (const contentType of Object.values(CONTENT_TYPES)) {
    const typeData = correctedPrompts[contentType] || {};
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
      const isCurrentDefaultValid =
        currentDefaultId && actualPrompts[currentDefaultId];

      if (!isCurrentDefaultValid) {
        // Default is missing or invalid, set to the first available prompt
        if (!correctedPrompts[contentType]) {
          // This check is slightly redundant given the deep copy, but safe.
          correctedPrompts[contentType] = {};
        }
        correctedPrompts[contentType]['_defaultPromptId_'] =
          promptIdsForType[0];
        changesMade = true;
        logger.service.info(
          `Set/fixed default prompt for ${contentType} to ${promptIdsForType[0]}`
        );
      }
    } else {
      // No prompts exist for this type
      if (currentDefaultId) {
        // A default is set, but there are no prompts, so remove the default setting
        if (correctedPrompts[contentType]) {
          delete correctedPrompts[contentType]['_defaultPromptId_'];
          // If the content type object becomes empty, remove it entirely.
          if (Object.keys(correctedPrompts[contentType]).length === 0) {
            delete correctedPrompts[contentType];
          }
          changesMade = true;
          logger.service.info(
            `Removed default prompt setting for empty content type ${contentType}`
          );
        }
      }
    }
  }

  return { prompts: correctedPrompts, changesMade };
}

/**
 * Performs a full repopulation of prompts from prompt-config.json.
 * It fetches the config, builds a new prompt structure in memory, validates it,
 * and performs a single write to storage.
 * This function does NOT manage the INITIAL_PROMPTS_POPULATED_FLAG flag itself.
 * @returns {Promise<boolean>} True if repopulation was successful, false otherwise.
 */
export async function performFullPromptRepopulation() {
  logger.service.info('Starting full prompt repopulation...');
  try {
    const response = await fetch(chrome.runtime.getURL('prompt-config.json'));
    if (!response.ok) {
      throw new Error(
        `Failed to fetch prompt-config.json: ${response.statusText}`
      );
    }
    const defaultPromptsConfig = await response.json();

    const newCustomPromptsStructure = {}; // Start fresh for a full repopulation

    for (const contentType in defaultPromptsConfig) {
      if (Object.hasOwnProperty.call(defaultPromptsConfig, contentType)) {
        if (!newCustomPromptsStructure[contentType]) {
          newCustomPromptsStructure[contentType] = {}; // Initialize content type object
        }

        const defaultPromptsForType = defaultPromptsConfig[contentType];

        for (const defaultPromptName in defaultPromptsForType) {
          if (
            Object.hasOwnProperty.call(defaultPromptsForType, defaultPromptName)
          ) {
            const defaultPromptContent =
              defaultPromptsForType[defaultPromptName];

            const newPromptId = `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const now = new Date().toISOString();
            newCustomPromptsStructure[contentType][newPromptId] = {
              name: defaultPromptName,
              content: defaultPromptContent,
              createdAt: now,
              updatedAt: now,
            };
            logger.service.info(
              `Added initial prompt: "${defaultPromptName}" for type "${contentType}" with ID ${newPromptId} during repopulation.`
            );
          }
        }
      }
    }

    // Validate and set defaults on the in-memory object before writing to storage.
    const { prompts: validatedPrompts } = _validateAndFixDefaultsOnObject(
      newCustomPromptsStructure
    );

    // Perform a single write with the fully validated and populated data.
    await chrome.storage.local.set({
      [STORAGE_KEYS.USER_CUSTOM_PROMPTS]: validatedPrompts,
    });

    logger.service.info(
      'Full prompt repopulation completed and defaults ensured in a single operation.'
    );
    return true;
  } catch (error) {
    logger.service.error('Error during full prompt repopulation:', error);
    return false;
  }
}

/**
 * Ensures that every content type with at least one prompt has a valid default prompt assigned.
 * This is a general-purpose utility to be called when consistency needs to be checked,
 * e.g., on browser startup or after manual prompt deletion.
 * @returns {Promise<boolean>} True if changes were made to storage, false otherwise.
 */
export async function ensureDefaultPrompts() {
  try {
    const promptsResult = await chrome.storage.local.get(
      STORAGE_KEYS.USER_CUSTOM_PROMPTS
    );
    const customPromptsByType =
      promptsResult[STORAGE_KEYS.USER_CUSTOM_PROMPTS] || {};

    // Use the pure function to get the corrected state and check if changes are needed
    const { prompts: correctedPrompts, changesMade } =
      _validateAndFixDefaultsOnObject(customPromptsByType);

    if (changesMade) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.USER_CUSTOM_PROMPTS]: correctedPrompts,
      });
      logger.service.info('PROMPTS storage updated by ensureDefaultPrompts.');
    }
    return changesMade;
  } catch (error) {
    logger.service.error('Error in ensureDefaultPrompts:', error);
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
    const result = await chrome.storage.local.get(
      STORAGE_KEYS.USER_CUSTOM_PROMPTS
    );
    const promptsByType = result[STORAGE_KEYS.USER_CUSTOM_PROMPTS] || {};

    // Get prompts for the requested type
    const typePromptsData = promptsByType[contentType] || {};
    const relevantPrompts = Object.entries(typePromptsData)
      .filter(([key]) => key !== '_defaultPromptId_') // Skip the default prompt ID key
      .map(([id, promptObjectValue]) => ({
        id, // The key is the ID
        ...promptObjectValue, // Spread the properties of promptObjectValue (name, content, createdAt, updatedAt)
        contentType: contentType, // Add contentType
      }));

    // Sort prompts alphabetically by name
    relevantPrompts.sort((a, b) => a.name.localeCompare(b.name));

    return relevantPrompts;
  } catch (error) {
    logger.service.error('Error loading relevant prompts:', error);
    return []; // Return empty array on error
  }
}

/**
 * Sets the default prompt for a specific content type.
 *
 * @param {string} contentType - The content type for which to set the default.
 * @param {string} promptId - The ID of the prompt to set as default.
 * @returns {Promise<boolean>} True if the default was successfully set, false otherwise.
 */
export async function setDefaultPromptForContentType(contentType, promptId) {
  if (!contentType || !promptId) {
    logger.service.error(
      'setDefaultPromptForContentType: contentType and promptId are required.'
    );
    return false;
  }

  logger.service.info(
    `Setting default prompt for ${contentType} to ${promptId}`
  );
  try {
    const result = await chrome.storage.local.get(
      STORAGE_KEYS.USER_CUSTOM_PROMPTS
    );
    const customPromptsByType = result[STORAGE_KEYS.USER_CUSTOM_PROMPTS] || {};

    // Ensure the content type object exists
    if (!customPromptsByType[contentType]) {
      customPromptsByType[contentType] = {};
    }

    // Ensure the prompt ID actually exists for that content type before setting it as default
    if (!customPromptsByType[contentType][promptId]) {
      logger.service.error(
        `setDefaultPromptForContentType: Prompt ID ${promptId} does not exist for content type ${contentType}. Cannot set as default.`
      );
      return false;
    }

    customPromptsByType[contentType]['_defaultPromptId_'] = promptId;

    await chrome.storage.local.set({
      [STORAGE_KEYS.USER_CUSTOM_PROMPTS]: customPromptsByType,
    });

    logger.service.info(
      `Successfully set default prompt for ${contentType} to ${promptId}.`
    );
    return true;
  } catch (error) {
    logger.service.error(
      `Error setting default prompt for ${contentType}:`,
      error
    );
    return false;
  }
}

// src/shared/utils/prompt-utils.js
import { logger } from '../logger';
import { STORAGE_KEYS, CONTENT_TYPES } from '../constants';

import { robustDeepClone } from './object-utils.js';

/**
 * Creates a new, non-customized prompt object.
 * @param {string} name - The display name of the prompt.
 * @param {string} content - The content of the prompt.
 * @returns {object} A new prompt object.
 */
function _createNewDefaultPrompt(name, content) {
  const now = new Date().toISOString();
  return {
    name,
    content,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Internal pure function to validate and fix default prompt IDs on a given object.
 * Does not interact with chrome.storage.
 * @param {object} promptsByType - The prompt object to validate.
 * @returns {{prompts: object, changesMade: boolean}} - The corrected object and a flag indicating if changes were made.
 */
function _validateAndFixDefaultsOnObject(promptsByType) {
  let changesMade = false;
  const correctedPrompts = robustDeepClone(promptsByType);

  for (const contentType of Object.values(CONTENT_TYPES)) {
    const typeData = correctedPrompts[contentType] || {};
    const currentDefaultId = typeData['_defaultPromptId_'];

    const actualPrompts = Object.fromEntries(
      Object.entries(typeData).filter(([key]) => key !== '_defaultPromptId_')
    );
    const promptIdsForType = Object.keys(actualPrompts);

    if (promptIdsForType.length > 0) {
      const isCurrentDefaultValid =
        currentDefaultId && actualPrompts[currentDefaultId];
      if (!isCurrentDefaultValid) {
        if (!correctedPrompts[contentType]) correctedPrompts[contentType] = {};
        correctedPrompts[contentType]['_defaultPromptId_'] = promptIdsForType[0];
        changesMade = true;
        logger.service.info(`Set/fixed default prompt for ${contentType} to ${promptIdsForType[0]}`);
      }
    } else if (currentDefaultId) {
      if (correctedPrompts[contentType]) {
        delete correctedPrompts[contentType]['_defaultPromptId_'];
        if (Object.keys(correctedPrompts[contentType]).length === 0) {
          delete correctedPrompts[contentType];
        }
        changesMade = true;
        logger.service.info(`Removed default prompt setting for empty content type ${contentType}`);
      }
    }
  }
  return { prompts: correctedPrompts, changesMade };
}

/**
 * Populates storage with initial default prompts from config. Runs only on first install.
 * @returns {Promise<boolean>} True if successful.
 */
export async function populateInitialPrompts() {
  logger.service.info('Performing initial population of default prompts...');
  try {
    const response = await fetch(chrome.runtime.getURL('prompt-config.json'));
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
    const config = await response.json();

    const newPrompts = {};

    for (const [contentType, prompts] of Object.entries(config)) {
      newPrompts[contentType] = {};
      for (const [name, { content }] of Object.entries(prompts)) {
        const newId = `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        newPrompts[contentType][newId] = _createNewDefaultPrompt(name, content);
      }
    }

    const { prompts: validatedPrompts } = _validateAndFixDefaultsOnObject(newPrompts);
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_PROMPTS]: validatedPrompts });
    logger.service.info('Initial prompt population successful.');
    return true;
  } catch (error) {
    logger.service.error('Error during initial prompt population:', error);
    return false;
  }
}



/**
 * Ensures that every content type with at least one prompt has a valid default prompt assigned.
 * @returns {Promise<boolean>} True if changes were made to storage.
 */
export async function ensureDefaultPrompts() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROMPTS);
    const prompts = result[STORAGE_KEYS.USER_PROMPTS] || {};
    const { prompts: correctedPrompts, changesMade } = _validateAndFixDefaultsOnObject(prompts);
    if (changesMade) {
      await chrome.storage.local.set({ [STORAGE_KEYS.USER_PROMPTS]: correctedPrompts });
      logger.service.info('Default prompt pointers validated and fixed.');
    }
    return changesMade;
  } catch (error) {
    logger.service.error('Error in ensureDefaultPrompts:', error);
    return false;
  }
}

/**
 * Loads custom prompts relevant to a specific content type.
 * @param {string} contentType - The content type to load prompts for.
 * @returns {Promise<Array<object>>} A sorted array of relevant prompt objects.
 */
export async function loadRelevantPrompts(contentType) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROMPTS);
    const promptsByType = result[STORAGE_KEYS.USER_PROMPTS] || {};
    const typePromptsData = promptsByType[contentType] || {};
    const relevantPrompts = Object.entries(typePromptsData)
      .filter(([key]) => key !== '_defaultPromptId_')
      .map(([id, promptObjectValue]) => ({ id, ...promptObjectValue, contentType }));
    relevantPrompts.sort((a, b) => a.name.localeCompare(b.name));
    return relevantPrompts;
  } catch (error) {
    logger.service.error('Error loading relevant prompts:', error);
    return [];
  }
}

/**
 * Sets the default prompt for a specific content type.
 * @param {string} contentType - The content type.
 * @param {string} promptId - The prompt ID to set as default.
 * @returns {Promise<boolean>} True if successful.
 */
export async function setDefaultPromptForContentType(contentType, promptId) {
  if (!contentType || !promptId) {
    logger.service.error('setDefaultPromptForContentType: contentType and promptId are required.');
    return false;
  }
  logger.service.info(`Setting default prompt for ${contentType} to ${promptId}`);
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PROMPTS);
    const prompts = result[STORAGE_KEYS.USER_PROMPTS] || {};
    if (!prompts[contentType]) prompts[contentType] = {};
    if (!prompts[contentType][promptId]) {
      logger.service.error(`Prompt ID ${promptId} does not exist for ${contentType}.`);
      return false;
    }
    prompts[contentType]['_defaultPromptId_'] = promptId;
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_PROMPTS]: prompts });
    logger.service.info(`Successfully set default prompt for ${contentType} to ${promptId}.`);
    return true;
  } catch (error) {
    logger.service.error(`Error setting default prompt for ${contentType}:`, error);
    return false;
  }
}

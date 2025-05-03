// src/shared/utils/prompt-utils.js
import { logger } from '../logger';
import { STORAGE_KEYS, CONTENT_TYPES } from '../constants';

/**
 * Ensures that every content type with at least one prompt has a valid default prompt assigned.
 * If no default is set or the current default is invalid, it assigns the first available prompt.
 * If a content type has no prompts, it ensures no default is set for it.
 * This function should be called after any operation that modifies the custom prompts structure (create, update, delete).
 * @returns {Promise<boolean>} True if default assignments were changed, false otherwise.
 */
export async function ensureDefaultPrompts() {
  try {
    const [promptsResult, defaultsResult] = await Promise.all([
      chrome.storage.local.get(STORAGE_KEYS.CUSTOM_PROMPTS),
      chrome.storage.local.get(STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE),
    ]);

    const customPromptsByType =
      promptsResult[STORAGE_KEYS.CUSTOM_PROMPTS] || {};
    const currentDefaults =
      defaultsResult[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};
    const updatedDefaults = { ...currentDefaults };
    let defaultsChanged = false;

    // Iterate through all defined content types
    for (const contentType of Object.values(CONTENT_TYPES)) {
      const promptsForType = customPromptsByType[contentType]?.prompts || {};
      const promptIdsForType = Object.keys(promptsForType);
      const currentDefaultId = updatedDefaults[contentType];

      if (promptIdsForType.length > 0) {
        // --- Prompts exist for this type ---
        const isCurrentDefaultValid =
          currentDefaultId && promptsForType[currentDefaultId];

        if (!isCurrentDefaultValid) {
          // No default set, or the existing default ID is no longer valid
          const newDefaultId = promptIdsForType[0];
          updatedDefaults[contentType] = newDefaultId;
          defaultsChanged = true;
        }
      } else {
        // --- No prompts exist for this type ---
        if (currentDefaultId) {
          // A default is set, but there are no prompts, so remove the default setting
          delete updatedDefaults[contentType];
          defaultsChanged = true;
        }
      }
    }

    // Save back to storage only if changes were made
    if (defaultsChanged) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE]: updatedDefaults,
      });
      return true;
    }

    return false;
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
    const result = await chrome.storage.local.get(STORAGE_KEYS.CUSTOM_PROMPTS);
    const promptsByType = result[STORAGE_KEYS.CUSTOM_PROMPTS] || {};

    // Get prompts for the requested type
    const typePromptsObj = promptsByType[contentType]?.prompts || {};

    // Convert to array and add contentType
    const relevantPrompts = Object.values(typePromptsObj).map((prompt) => ({
      ...prompt,
      contentType: contentType,
    }));

    // Sort prompts alphabetically by name
    relevantPrompts.sort((a, b) => a.name.localeCompare(b.name));

    return relevantPrompts;
  } catch (error) {
    logger.service.error('Error loading relevant prompts:', error);
    return []; // Return empty array on error
  }
}

// src/shared/utils/prompt-utils.js
import { STORAGE_KEYS, SHARED_TYPE } from '../constants';

/**
 * Loads custom prompts relevant to a specific content type, including shared prompts.
 * 
 * @param {string} contentType - The content type to load prompts for (e.g., 'general', 'youtube').
 * @returns {Promise<Array<{id: string, name: string, content: string, contentType: string}>>} - A promise that resolves to a sorted array of relevant prompt objects.
 */
export async function loadRelevantPrompts(contentType) {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
    const promptsByType = result[STORAGE_KEYS.CUSTOM_PROMPTS] || {};

    // Get prompts for the requested type
    const typePromptsObj = promptsByType[contentType]?.prompts || {};

    // Convert to array and add contentType
    const relevantPrompts = Object.values(typePromptsObj).map(prompt => ({
      ...prompt,
      contentType: contentType
    }));

    // Sort prompts alphabetically by name
    relevantPrompts.sort((a, b) => a.name.localeCompare(b.name));

    return relevantPrompts;
  } catch (error) {
    console.error("Error loading relevant prompts:", error);
    return []; // Return empty array on error
  }
}

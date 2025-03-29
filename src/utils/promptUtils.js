// src/utils/promptUtils.js
import { STORAGE_KEYS, SHARED_TYPE } from '../shared/constants';

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

    // Get prompts for the specific content type
    const typeSpecificPrompts = promptsByType[contentType] || [];
    
    // Get shared prompts, ensuring they are not duplicated if contentType is SHARED_TYPE
    const sharedPrompts = (contentType !== SHARED_TYPE && promptsByType[SHARED_TYPE]) 
      ? promptsByType[SHARED_TYPE] 
      : [];

    // Combine and remove potential duplicates (e.g., if a shared prompt somehow ended up in a specific type)
    const combinedPrompts = [...typeSpecificPrompts, ...sharedPrompts];
    const uniquePromptsMap = new Map();
    combinedPrompts.forEach(prompt => {
      if (prompt && prompt.id) { // Basic validation
        uniquePromptsMap.set(prompt.id, prompt);
      }
    });

    const relevantPrompts = Array.from(uniquePromptsMap.values());

    // Sort prompts alphabetically by name
    relevantPrompts.sort((a, b) => a.name.localeCompare(b.name));

    return relevantPrompts;
  } catch (error) {
    console.error("Error loading relevant prompts:", error);
    return []; // Return empty array on error
  }
}

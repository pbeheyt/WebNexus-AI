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

    // Step 1: Correctly access the .prompts object for the given contentType
    const typePromptsObj = promptsByType[contentType]?.prompts || {};

    // Step 2: Correctly access the .prompts object for SHARED_TYPE, avoid duplication
    const sharedPromptsObj = contentType !== SHARED_TYPE 
      ? (promptsByType[SHARED_TYPE]?.prompts || {}) 
      : {};

    // Step 3: Convert type-specific prompts object to array and add contentType
    const typeSpecificPromptsArray = Object.values(typePromptsObj).map(prompt => ({
      ...prompt,
      contentType: contentType 
    }));

    // Step 4: Convert shared prompts object to array and add contentType
    const sharedPromptsArray = Object.values(sharedPromptsObj).map(prompt => ({
      ...prompt,
      contentType: SHARED_TYPE
    }));

    // Step 5: Combine the arrays
    const combinedPrompts = [...typeSpecificPromptsArray, ...sharedPromptsArray];

    // Step 6: Ensure uniqueness using a Map based on prompt.id
    const uniquePromptsMap = new Map();
    combinedPrompts.forEach(prompt => {
      if (prompt && prompt.id) { // Ensure prompt and id exist
        uniquePromptsMap.set(prompt.id, prompt);
      }
    });

    // Step 7: Convert Map values back to an array
    let relevantPrompts = Array.from(uniquePromptsMap.values());

    // Step 8: Sort prompts alphabetically by name
    relevantPrompts.sort((a, b) => a.name.localeCompare(b.name));

    // Step 9: Return the sorted array
    return relevantPrompts;
  } catch (error) {
    console.error("Error loading relevant prompts:", error);
    return []; // Return empty array on error
  }
}

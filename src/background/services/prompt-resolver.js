// src/background/services/prompt-resolver.js - Prompt fetching and management

import promptBuilder from '../../services/PromptBuilder.js';
import { STORAGE_KEYS } from '../../shared/constants.js';
import logger from '../../utils/logger.js';
import { trackQuickPromptUsage } from '../core/state-manager.js';

/**
 * Get preferred prompt ID for a content type
 * @param {string} contentType - Content type
 * @returns {Promise<string>} Prompt ID
 */
export async function getPreferredPromptId(contentType) {
  try {
    logger.background.info(`Getting preferred prompt ID for content type: ${contentType}`);

    // Determine preferred prompt type
    const typeResult = await chrome.storage.sync.get('prompt_type_preference');
    const promptTypePreferences = typeResult.prompt_type_preference || {};
    const preferredType = promptTypePreferences[contentType] || 'default';

    logger.background.info(`Preferred prompt type: ${preferredType}`);

    // 1. Try preferred type first
    const promptId = await getPromptIdForType(preferredType, contentType);
    if (promptId) {
      logger.background.info(`Using ${preferredType} prompt ID: ${promptId}`);
      return promptId;
    }

    // 2. If preferred type is 'quick' but no valid prompt found, try custom
    if (preferredType === 'quick') {
      logger.background.info("Quick prompt unavailable, attempting to fallback to custom prompt");
      const customPromptId = await getPromptIdForType('custom', contentType);
      if (customPromptId) {
        logger.background.info(`Fallback to custom prompt ID: ${customPromptId}`);
        return customPromptId;
      }
    }

    // 3. Final fallback to default template prompt
    logger.background.info(`Fallback to default template prompt for ${contentType}`);
    return contentType;
  } catch (error) {
    logger.background.error('Error getting preferred prompt ID:', error);
    return contentType;
  }
}

/**
 * Get prompt ID for a specific type
 * @param {string} promptType - Prompt type (quick, custom, default)
 * @param {string} contentType - Content type
 * @returns {Promise<string|null>} Prompt ID or null
 */
export async function getPromptIdForType(promptType, contentType) {
  try {
    if (promptType === 'quick') {
      // Check if quick prompt exists and has content
      const quickResult = await chrome.storage.sync.get('quick_prompts');
      const quickPrompts = quickResult.quick_prompts || {};

      if (quickPrompts[contentType] && quickPrompts[contentType].trim()) {
        logger.background.info('Found valid quick prompt');
        return 'quick';
      }
      return null;
    }
    else if (promptType === 'custom') {
      // First check selected custom prompt ID
      const selectionsResult = await chrome.storage.sync.get('selected_prompt_ids');
      const selections = selectionsResult.selected_prompt_ids || {};
      const key = `${contentType}-custom`;

      if (selections[key]) {
        // Verify this custom prompt still exists
        const customResult = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
        const customPromptsByType = customResult[STORAGE_KEYS.CUSTOM_PROMPTS] || {};

        if (customPromptsByType[contentType]?.prompts?.[selections[key]]) {
          logger.background.info(`Found selected custom prompt ID: ${selections[key]}`);
          return selections[key];
        }
      }

      // If no selection or selection invalid, check if any custom prompts exist
      const customResult = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
      const customPromptsByType = customResult[STORAGE_KEYS.CUSTOM_PROMPTS] || {};

      if (customPromptsByType[contentType]?.prompts) {
        const promptIds = Object.keys(customPromptsByType[contentType].prompts);
        if (promptIds.length > 0) {
          // Use preferred prompt if set, otherwise first available prompt
          const preferredId = customPromptsByType[contentType].preferredPromptId;
          const promptId = (preferredId && promptIds.includes(preferredId)) ?
                          preferredId : promptIds[0];

          logger.background.info(`Using available custom prompt ID: ${promptId}`);
          return promptId;
        }
      }
      return null;
    }
    else if (promptType === 'default') {
      return contentType; // Default prompt ID is same as content type
    }

    return null;
  } catch (error) {
    logger.background.error(`Error getting prompt ID for type ${promptType}:`, error);
    return null;
  }
}

/**
 * Get prompt content by ID
 * @param {string} promptId - Prompt ID
 * @param {string} contentType - Content type
 * @returns {Promise<string|null>} Prompt content or null
 */
export async function getPromptContentById(promptId, contentType) {
  logger.background.info(`Getting prompt content for ID: ${promptId}, type: ${contentType}`);
  
  // Handle quick prompts
  if (promptId === "quick") {
    try {
      const result = await chrome.storage.sync.get('quick_prompts');
      // Mark the quick prompt as used for tracking
      trackQuickPromptUsage(contentType);
      return result.quick_prompts?.[contentType] || null;
    } catch (error) {
      logger.background.error('Error loading quick prompt:', error);
      return null;
    }
  }
  
  // If ID matches content type, it's a default prompt
  if (promptId === contentType) {
    try {
      // Get user preferences
      const userPreferences = await chrome.storage.sync.get('default_prompt_preferences');
      const typePreferences = userPreferences.default_prompt_preferences?.[contentType] || {};
      
      // Build prompt using the preferences
      return promptBuilder.buildPrompt(contentType, typePreferences);
    } catch (error) {
      logger.background.error('Error building default prompt:', error);
      return null;
    }
  }
  
  // For custom prompts
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
    
    // First try to find the prompt in the content-specific storage
    let promptContent = result[STORAGE_KEYS.CUSTOM_PROMPTS]?.[contentType]?.prompts?.[promptId]?.content;
    
    // If not found, check in the shared storage
    if (!promptContent && result[STORAGE_KEYS.CUSTOM_PROMPTS]?.shared?.prompts?.[promptId]) {
      logger.background.info(`Prompt not found in ${contentType}, found in shared storage instead`);
      promptContent = result[STORAGE_KEYS.CUSTOM_PROMPTS].shared.prompts[promptId].content;
    }
    
    return promptContent || null;
  } catch (error) {
    logger.background.error('Error loading custom prompt:', error);
    return null;
  }
}

/**
 * Clear a quick prompt for a content type
 * @param {string} contentType - Content type
 * @param {Function} sendResponse - Response function
 */
export async function clearQuickPrompt(contentType, sendResponse) {
  try {
    logger.background.info(`Clearing quick prompt for content type: ${contentType}`);
    const quickPrompts = await chrome.storage.sync.get('quick_prompts');

    if (quickPrompts.quick_prompts && quickPrompts.quick_prompts[contentType]) {
      logger.background.info(`Found quick prompt to clear for ${contentType}`);
      quickPrompts.quick_prompts[contentType] = '';
      await chrome.storage.sync.set({ quick_prompts: quickPrompts.quick_prompts });
      logger.background.info(`Successfully cleared quick prompt for ${contentType}`);
    } else {
      logger.background.info(`No quick prompt found for ${contentType}, nothing to clear`);
    }

    sendResponse({ success: true });
  } catch (error) {
    logger.background.error(`Error clearing quick prompt: ${error.message}`, error);
    sendResponse({ success: false, error: error.message });
  }
}
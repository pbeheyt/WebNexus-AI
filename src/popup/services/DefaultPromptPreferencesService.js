// src/popup/services/DefaultPromptPreferencesService.js
import { STORAGE_KEYS } from '../constants.js';

export default class DefaultPromptPreferencesService {
  constructor(storageService, promptBuilderService) {
    this.storageService = storageService;
    this.promptBuilder = promptBuilderService;
  }

  async getPreferences(contentType) {
    // Get user preferences
    const userPreferences = await this.storageService.get(STORAGE_KEYS.DEFAULT_PROMPT_PREFERENCES) || {};
    
    // Get default preferences from promptBuilder
    const defaultPreferences = await this.promptBuilder.getDefaultPreferences(contentType);
    
    // Merge default preferences with user preferences
    return {
      ...defaultPreferences,
      ...(userPreferences[contentType] || {})
    };
  }

  async savePreferences(contentType, preferences) {
    // Get existing preferences
    const userPreferences = await this.storageService.get(STORAGE_KEYS.DEFAULT_PROMPT_PREFERENCES) || {};
    
    // Update preferences for content type
    userPreferences[contentType] = {
      ...(userPreferences[contentType] || {}),
      ...preferences
    };
    
    // Save to storage
    await this.storageService.set({ [STORAGE_KEYS.DEFAULT_PROMPT_PREFERENCES]: userPreferences });
    
    return userPreferences[contentType];
  }

  async getParameterOptions(contentType) {
    // Use promptBuilder to get parameter options
    return this.promptBuilder.getParameterOptions(contentType);
  }

  async buildPrompt(contentType) {
    // Get user preferences
    const preferences = await this.getPreferences(contentType);
    
    // Use promptBuilder to build the prompt
    return this.promptBuilder.buildPrompt(contentType, preferences);
  }
}
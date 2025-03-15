// src/popup/services/DefaultPromptPreferencesService.js
import { STORAGE_KEYS } from '../constants.js';

export default class DefaultPromptPreferencesService {
  constructor(storageService, configService) {
    this.storageService = storageService;
    this.configService = configService;
  }

  async getPreferences(contentType) {
    // Get user preferences
    const userPreferences = await this.storageService.get(STORAGE_KEYS.DEFAULT_PROMPT_PREFERENCES) || {};
    
    // Get parameters for this content type
    const parameters = await this.getParameterOptions(contentType);
    
    // Build default preferences using first value of each parameter
    const defaultPreferences = {};
    for (const [paramKey, paramOptions] of Object.entries(parameters)) {
      if (paramOptions.values && Object.keys(paramOptions.values).length > 0) {
        // Use first value as default
        defaultPreferences[paramKey] = Object.keys(paramOptions.values)[0];
      }
    }
    
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
    const promptConfig = await this.configService.getConfig('prompt');
    
    // Get content-specific parameters
    const contentSpecificParams = promptConfig.defaultPrompts[contentType]?.parameters || {};
    
    // Get shared parameters
    const sharedParams = promptConfig.sharedParameters || {};
    
    // Return all parameters, with content-specific taking precedence if there are duplicates
    return { ...sharedParams, ...contentSpecificParams };
  }

  async buildPrompt(contentType) {
    // Get configuration
    const promptConfig = await this.configService.getConfig('prompt');
    const promptTemplate = promptConfig.defaultPrompts[contentType];
    
    if (!promptTemplate || !promptTemplate.baseTemplate) {
      throw new Error(`No template found for content type: ${contentType}`);
    }
    
    // Get user preferences
    const preferences = await this.getPreferences(contentType);
    
    // Get parameters (now includes both shared and content-specific)
    const parameters = await this.getParameterOptions(contentType);
    
    // Build prompt by replacing placeholders
    let prompt = promptTemplate.baseTemplate;
    
    // Process each parameter type
    for (const [paramKey, paramOptions] of Object.entries(parameters)) {
      // Skip commentAnalysis for non-YouTube content types
      if (paramKey === 'commentAnalysis' && contentType !== 'youtube') {
        // Remove the placeholder completely
        prompt = prompt.replace(`{{${paramKey}}}\n`, '');
        prompt = prompt.replace(`{{${paramKey}}}`, '');
        continue;
      }
      
      const userValue = preferences[paramKey];
      let replacement = '';
      
      // Find parameter value in options
      if (userValue && paramOptions[userValue]) {
        replacement = paramOptions[userValue];
      }
      
      // Replace in template
      const placeholder = `{{${paramKey}}}`;
      prompt = prompt.replace(placeholder, replacement);
    }
    
    return prompt;
  }
}
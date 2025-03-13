// popup/services/DefaultPromptPreferencesService.js
import { STORAGE_KEYS } from '../constants.js';

export default class DefaultPromptPreferencesService {
  constructor(storageService, configService) {
    this.storageService = storageService;
    this.configService = configService;
  }

  async getPreferences(contentType) {
    // Get user preferences from storage
    const userPreferences = await this.storageService.get(STORAGE_KEYS.DEFAULT_PROMPT_PREFERENCES) || {};
    
    // Get default preferences from config
    const config = await this.configService.getConfig();
    const defaultPreferences = config.defaultPrompts[contentType]?.defaultPreferences || {};
    
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
    const config = await this.configService.getConfig();
    return config.defaultPrompts[contentType]?.parameters || {};
  }

  async buildPrompt(contentType) {
    // Get configuration
    const config = await this.configService.getConfig();
    const promptConfig = config.defaultPrompts[contentType];
    
    if (!promptConfig || !promptConfig.baseTemplate) {
      throw new Error(`No template found for content type: ${contentType}`);
    }
    
    // Get user preferences
    const preferences = await this.getPreferences(contentType);
    
    // Ensure typeSpecificInstructions preference exists
    if (!preferences.typeSpecificInstructions) {
      preferences.typeSpecificInstructions = "default";
    }
    
    // Ensure lengthAdaptationInstructions preference exists
    if (!preferences.lengthAdaptationInstructions) {
      preferences.lengthAdaptationInstructions = "default";
    }
    
    // Get parameters
    const parameters = promptConfig.parameters;
    
    // Build prompt by replacing placeholders
    let prompt = promptConfig.baseTemplate;
    
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
      const replacement = paramOptions[userValue] || '';
      
      // Replace in template
      const placeholder = `{{${paramKey}}}`;
      prompt = prompt.replace(placeholder, replacement);
    }
    
    // Remove any double newlines that might have been created by empty parameters
    prompt = prompt.replace(/\n\n+/g, '\n\n');
    
    return prompt;
  }
}
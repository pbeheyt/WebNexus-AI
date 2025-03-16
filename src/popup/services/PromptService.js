// src/popup/services/PromptService.js
import { STORAGE_KEYS } from '../constants.js';

export default class PromptService {
  constructor(storageService, configService, defaultPromptPreferencesService) {
    this.storageService = storageService;
    this.configService = configService;
    this.defaultPromptPreferencesService = defaultPromptPreferencesService;
  }

  async loadPrompts(contentType) {
    // This method is unchanged as it only deals with default and custom prompts
    // Quick prompts are handled directly
    try {
      // Load custom prompts
      const customPromptsByType = await this.storageService.get(STORAGE_KEYS.CUSTOM_PROMPTS) || {};
      
      // Load default prompts from prompt config
      const promptConfig = await this.configService.getConfig('prompt');
      const defaultPrompts = promptConfig.defaultPrompts || {};
      
      // Get preferred prompt ID
      const preferredPromptId = customPromptsByType[contentType]?.preferredPromptId || contentType;
      
      // Build the prompt list
      const prompts = this.buildPromptList(contentType, defaultPrompts, customPromptsByType);
      
      return { prompts, preferredPromptId };
    } catch (error) {
      console.error('Error loading prompts:', error);
      return { prompts: [], preferredPromptId: contentType };
    }
  }

  buildPromptList(contentType, defaultPrompts, customPromptsByType) {
    const prompts = [];
    
    // Add default prompt
    if (defaultPrompts[contentType]) {
      prompts.push({
        id: contentType,
        name: defaultPrompts[contentType].name,
        isDefault: true
      });
    }
    
    // Add custom prompts
    if (customPromptsByType[contentType]?.prompts) {
      Object.entries(customPromptsByType[contentType].prompts).forEach(([id, prompt]) => {
        prompts.push({
          id,
          name: prompt.name,
          isDefault: false
        });
      });
    }
    
    return prompts;
  }

  async getPromptContent(promptId, contentType) {
    // Handle quick prompt
    if (promptId === 'quick') {
      const quickPrompts = await this.storageService.get(STORAGE_KEYS.QUICK_PROMPTS) || {};
      const quickPromptText = quickPrompts[contentType] || '';
      
      if (!quickPromptText.trim()) {
        throw new Error('Quick prompt is empty. Please enter your prompt text.');
      }
      
      return quickPromptText;
    }
    
    // Default prompt (same ID as content type)
    if (promptId === contentType) {
      return this.defaultPromptPreferencesService.buildPrompt(contentType);
    }
    
    // Custom prompt
    const customPromptsByType = await this.storageService.get(STORAGE_KEYS.CUSTOM_PROMPTS) || {};
    return customPromptsByType[contentType]?.prompts?.[promptId]?.content || null;
  }

  async loadCustomPrompts(contentType) {
    try {
      // Load custom prompts
      const customPromptsByType = await this.storageService.get(STORAGE_KEYS.CUSTOM_PROMPTS) || {};
      
      // Get preferred prompt ID
      const preferredPromptId = customPromptsByType[contentType]?.preferredPromptId || null;
      
      // Extract custom prompts only
      const customPrompts = [];
      
      if (customPromptsByType[contentType]?.prompts) {
        Object.entries(customPromptsByType[contentType].prompts).forEach(([id, prompt]) => {
          customPrompts.push({
            id,
            name: prompt.name,
            isPreferred: id === preferredPromptId
          });
        });
      }
      
      return { 
        prompts: customPrompts, 
        preferredPromptId 
      };
    } catch (error) {
      console.error('Error loading custom prompts:', error);
      return { prompts: [], preferredPromptId: null };
    }
  }

  async getPromptPreferences(promptId, contentType) {
    // For default prompts
    if (promptId === contentType) {
      return await this.defaultPromptPreferencesService.getPreferences(contentType);
    }
    
    // For custom and quick prompts, return empty preferences
    return {};
  }
}
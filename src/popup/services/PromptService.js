// popup/services/PromptService.js
import { STORAGE_KEYS } from '../constants.js';

export default class PromptService {
  constructor(storageService) {
    this.storageService = storageService;
  }

  async loadPrompts(contentType) {
    try {
      // Load custom prompts
      const customPromptsByType = await this.storageService.get(STORAGE_KEYS.CUSTOM_PROMPTS) || {};
      
      // Load default prompts from config
      const response = await fetch(chrome.runtime.getURL('config.json'));
      const config = await response.json();
      const defaultPrompts = config.defaultPrompts || {};
      
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
    // Default prompt (same ID as content type)
    if (promptId === contentType) {
      const response = await fetch(chrome.runtime.getURL('config.json'));
      const config = await response.json();
      return config.defaultPrompts?.[contentType]?.content || null;
    }
    
    // Custom prompt
    const customPromptsByType = await this.storageService.get(STORAGE_KEYS.CUSTOM_PROMPTS) || {};
    return customPromptsByType[contentType]?.prompts?.[promptId]?.content || null;
  }
}
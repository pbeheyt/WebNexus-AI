// src/popup/services/PromptService.js
import { STORAGE_KEYS } from '../constants.js';

export default class PromptService {
  constructor(storageService, configManager, defaultPromptPreferencesService) {
    this.storageService = storageService;
    this.configManager = configManager;
    this.defaultPromptPreferencesService = defaultPromptPreferencesService;
  }

  async getAllPrompts() {
    // Get both default and custom prompts
    const [defaultPrompts, customData] = await Promise.all([
      this.configManager.getConfigSection('defaultPrompts'),
      this.storageService.get(STORAGE_KEYS.CUSTOM_PROMPTS)
    ]);
    
    // Return organized by content type
    const customPromptsByType = customData || this.initializeEmptyPromptStructure();
    
    return { defaultPrompts, customPromptsByType };
  }

  async loadPrompts(contentType) {
    try {
      // Load default prompts from configManager
      const defaultPrompts = await this.configManager.getConfigSection('defaultPrompts');
      
      // Load custom prompts
      const customPromptsByType = await this.storageService.get(STORAGE_KEYS.CUSTOM_PROMPTS) || {};
      
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

  initializeEmptyPromptStructure() {
    // This method remains the same as in the original code
    return {
      general: {
        prompts: {},
        preferredPromptId: null,
        settings: {}
      },
      reddit: {
        prompts: {},
        preferredPromptId: null,
        settings: {
          maxComments: 100
        }
      },
      youtube: {
        prompts: {},
        preferredPromptId: null,
        settings: {
          maxComments: 20
        }
      }
    };
  }
}
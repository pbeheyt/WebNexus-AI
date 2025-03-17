// src/popup/services/PromptService.js
import { STORAGE_KEYS, CONTENT_TYPES, SHARED_TYPE } from '../constants.js';

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
    
    // Try to find in content-specific prompts
    const customPromptsByType = await this.storageService.get(STORAGE_KEYS.CUSTOM_PROMPTS) || {};
    const contentPrompt = customPromptsByType[contentType]?.prompts?.[promptId]?.content;
    
    if (contentPrompt) {
      return contentPrompt;
    }
    
    // If not found, check shared prompts
    const sharedPrompt = customPromptsByType[SHARED_TYPE]?.prompts?.[promptId]?.content;
    
    return sharedPrompt || null;
  }

  async loadCustomPrompts(contentType) {
    try {
      // Load custom prompts from storage
      const customPromptsByType = await this.storageService.get(STORAGE_KEYS.CUSTOM_PROMPTS) || {};
      
      // Get content-specific prompts
      const contentPrompts = customPromptsByType[contentType]?.prompts || {};
      const preferredPromptId = customPromptsByType[contentType]?.preferredPromptId || null;
      
      // Also get shared prompts (if we're not already loading shared type)
      const sharedPrompts = contentType !== SHARED_TYPE 
        ? customPromptsByType[SHARED_TYPE]?.prompts || {}
        : {};
      
      // Combine prompts
      const combinedPrompts = [];
      
      // Add content-specific prompts
      Object.entries(contentPrompts).forEach(([id, prompt]) => {
        combinedPrompts.push({
          id,
          name: prompt.name,
          isPreferred: id === preferredPromptId,
          isShared: false
        });
      });
      
      // Add shared prompts (if not already on shared type)
      if (contentType !== SHARED_TYPE) {
        Object.entries(sharedPrompts).forEach(([id, prompt]) => {
          combinedPrompts.push({
            id,
            name: prompt.name,
            isPreferred: false, // Shared prompts can't be preferred in a specific context
            isShared: true
          });
        });
      }
      
      return { 
        prompts: combinedPrompts, 
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
    return {
      [CONTENT_TYPES.GENERAL]: {
        prompts: {},
        preferredPromptId: null,
        settings: {}
      },
      [CONTENT_TYPES.REDDIT]: {
        prompts: {},
        preferredPromptId: null,
        settings: {
          maxComments: 100
        }
      },
      [CONTENT_TYPES.YOUTUBE]: {
        prompts: {},
        preferredPromptId: null,
        settings: {
          maxComments: 20
        }
      },
      [CONTENT_TYPES.PDF]: {
        prompts: {},
        preferredPromptId: null,
        settings: {}
      },
      [CONTENT_TYPES.SELECTED_TEXT]: {
        prompts: {},
        preferredPromptId: null,
        settings: {}
      },
      [SHARED_TYPE]: {
        prompts: {},
        preferredPromptId: null,
        settings: {}
      }
    };
  }
}
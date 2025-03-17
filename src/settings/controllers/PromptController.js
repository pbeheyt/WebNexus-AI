// src/settings/controllers/PromptController.js
import { STORAGE_KEY, CONTENT_TYPES } from '../utils/constants.js';
import { SHARED_TYPE } from '../../shared/constants.js';

export default class PromptController {
  constructor(storageService, configManager, eventBus, notificationManager) {
    this.storageService = storageService;
    this.configManager = configManager;
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
  }

  async getPromptsByType(contentType) {
    try {
      // Get default prompts from config manager
      const defaultPrompts = await this.configManager.getConfigSection('defaultPrompts');
      
      // Get custom prompts from storage
      const data = await this.storageService.get(STORAGE_KEY) || {};
      const customPromptsByType = data[contentType] || { prompts: {}, preferredPromptId: null };
      
      // Get preferred prompt ID
      const preferredPromptId = customPromptsByType.preferredPromptId || contentType;
      
      // Collect all prompts for this type
      const result = [];
      const addedIds = new Set();
      
      // Add default prompt if this is a standard content type (not shared)
      if (contentType !== SHARED_TYPE && defaultPrompts?.[contentType]) {
        result.push({
          id: contentType,
          prompt: {
            ...defaultPrompts[contentType],
            type: contentType
          },
          isDefault: true,
          isPreferred: preferredPromptId === contentType
        });
        addedIds.add(contentType);
      }
      
      // Add custom prompts
      if (customPromptsByType.prompts) {
        Object.entries(customPromptsByType.prompts).forEach(([id, prompt]) => {
          if (addedIds.has(id)) return;
          
          result.push({
            id,
            prompt,
            isDefault: false,
            isPreferred: id === preferredPromptId
          });
          addedIds.add(id);
        });
      }
      
      return { prompts: result, preferredPromptId };
    } catch (error) {
      console.error('Error getting prompts by type:', error);
      this.notificationManager.error(`Error loading prompts: ${error.message}`);
      throw error;
    }
  }

  async createPrompt(name, content, contentType) {
    try {
      // Validate inputs
      if (!name || !content || !contentType) {
        throw new Error('Missing required prompt fields');
      }
      
      // Generate ID
      const promptId = 'prompt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      
      // Create prompt object
      const prompt = {
        id: promptId,
        name,
        content,
        type: contentType,
        updatedAt: new Date().toISOString()
      };
      
      // Save to storage
      await this._savePrompt(promptId, prompt);
      
      return prompt;
    } catch (error) {
      this.notificationManager.error(`Error creating prompt: ${error.message}`);
      throw error;
    }
  }

  async updatePrompt(id, promptData) {
    try {
      // Validate
      if (!id || !promptData.name || !promptData.content || !promptData.type) {
        throw new Error('Missing required prompt fields');
      }
      
      // Create updated prompt object
      const prompt = {
        id,
        name: promptData.name,
        content: promptData.content,
        type: promptData.type,
        updatedAt: new Date().toISOString()
      };
      
      // Save to storage
      await this._savePrompt(id, prompt);
      
      return prompt;
    } catch (error) {
      this.notificationManager.error(`Error updating prompt: ${error.message}`);
      throw error;
    }
  }

  async deletePrompt(id, contentType) {
    try {
      const data = await this.storageService.get(STORAGE_KEY) || {};
      
      if (!data[contentType]?.prompts?.[id]) {
        throw new Error('Prompt not found');
      }
      
      // Store prompt for event
      const deletedPrompt = data[contentType].prompts[id];
      
      // Delete the prompt
      delete data[contentType].prompts[id];
      
      // If this was the preferred prompt, reset to default
      if (data[contentType].preferredPromptId === id) {
        data[contentType].preferredPromptId = contentType;
      }
      
      // Save to storage
      await this.storageService.set({ [STORAGE_KEY]: data });
      
      // Publish event
      this.eventBus.publish('prompt:deleted', { id, contentType });
      
      return deletedPrompt;
    } catch (error) {
      this.notificationManager.error(`Error deleting prompt: ${error.message}`);
      throw error;
    }
  }

  async setPreferredPrompt(id, contentType) {
    try {
      const data = await this.storageService.get(STORAGE_KEY) || {};
      
      if (!data[contentType]) {
        // Initialize if doesn't exist
        data[contentType] = {
          prompts: {},
          preferredPromptId: null,
          settings: {}
        };
      }
      
      // Update preferred ID
      data[contentType].preferredPromptId = id;
      
      // Save to storage
      await this.storageService.set({ [STORAGE_KEY]: data });
      
      // Publish event
      this.eventBus.publish('prompt:preferred', { id, contentType });
      
      return id;
    } catch (error) {
      this.notificationManager.error(`Error setting preferred prompt: ${error.message}`);
      throw error;
    }
  }

  // Private methods
  async _savePrompt(id, prompt) {
    const contentType = prompt.type;
    const data = await this.storageService.get(STORAGE_KEY) || {};
    
    // Make sure the content type exists
    if (!data[contentType]) {
      data[contentType] = {
        prompts: {},
        preferredPromptId: null,
        settings: {}
      };
    }
    
    // Add/update the prompt
    data[contentType].prompts[id] = prompt;
    
    // If no preferred prompt is set, make this one preferred
    if (!data[contentType].preferredPromptId) {
      data[contentType].preferredPromptId = id;
    }
    
    // Save to storage
    await this.storageService.set({ [STORAGE_KEY]: data });
    
    // Publish event
    this.eventBus.publish('prompt:saved', { id, prompt });
    
    return prompt;
  }
}
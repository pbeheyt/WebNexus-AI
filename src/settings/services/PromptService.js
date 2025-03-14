import { STORAGE_KEY, CONTENT_TYPES } from '../utils/constants.js';

// Handles prompt CRUD operations and migration
export default class PromptService {
  constructor(storageService, configService, eventBus) {
    this.storageService = storageService;
    this.configService = configService;
    this.eventBus = eventBus;
  }

  async getAllPrompts() {
    // Get both default and custom prompts
    const [defaultPrompts, customData] = await Promise.all([
      this.configService.getDefaultPrompts(),
      this.storageService.get(STORAGE_KEY)
    ]);
    
    // Return organized by content type
    const customPromptsByType = customData || this.initializeEmptyPromptStructure();
    
    return { defaultPrompts, customPromptsByType };
  }

  async getPromptsByType(contentType) {
    const { defaultPrompts, customPromptsByType } = await this.getAllPrompts();
    
    // Get preferred prompt ID
    const preferredPromptId = customPromptsByType[contentType]?.preferredPromptId || contentType;
    
    // Collect all prompts for this type
    const result = [];
    const addedIds = new Set(); // Track added IDs to prevent duplicates
    
    // Add default prompt
    if (defaultPrompts[contentType]) {
      result.push({
        id: contentType,
        prompt: {
          ...defaultPrompts[contentType],
          type: contentType
        },
        isDefault: true,
        isPreferred: preferredPromptId === contentType
      });
      addedIds.add(contentType); // Mark this ID as added
    }
    
    // Add custom prompts
    if (customPromptsByType[contentType]?.prompts) {
      Object.entries(customPromptsByType[contentType].prompts).forEach(([id, prompt]) => {
        // Skip if this ID has already been added (prevents duplicates)
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
    
    return { 
      prompts: result, 
      preferredPromptId 
    };
  }

  async createPrompt(name, content, contentType) {
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
    await this.savePrompt(promptId, prompt);
    
    return prompt;
  }

  async updatePrompt(id, promptData) {
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
    await this.savePrompt(id, prompt);
    
    return prompt;
  }

  async savePrompt(id, prompt) {
    const contentType = prompt.type;
    const data = await this.storageService.get(STORAGE_KEY) || this.initializeEmptyPromptStructure();
    
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
    if (!data[contentType].preferredPromptId || data[contentType].preferredPromptId === contentType) {
      data[contentType].preferredPromptId = id;
    }
    
    // Save to storage
    await this.storageService.set({ [STORAGE_KEY]: data });
    
    // Publish event
    this.eventBus.publish('prompt:saved', { id, prompt });
    
    return prompt;
  }

  async deletePrompt(id, contentType) {
    const data = await this.storageService.get(STORAGE_KEY);
    
    if (!data || !data[contentType] || !data[contentType].prompts || !data[contentType].prompts[id]) {
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
  }

  async setPreferredPrompt(id, contentType) {
    const data = await this.storageService.get(STORAGE_KEY);
    
    if (!data || !data[contentType]) {
      throw new Error('Content type not found');
    }
    
    // Update preferred ID
    data[contentType].preferredPromptId = id;
    
    // Save to storage
    await this.storageService.set({ [STORAGE_KEY]: data });
    
    // Publish event
    this.eventBus.publish('prompt:preferred', { id, contentType });
    
    return id;
  }

  async migrateFromLegacyFormat() {
    try {
      const legacyData = await this.storageService.get('custom_prompts');
      
      if (!legacyData) {
        return null; // No legacy data
      }
      
      const migratedData = this.initializeEmptyPromptStructure();
      
      // Process each legacy prompt
      Object.entries(legacyData).forEach(([id, prompt]) => {
        const type = prompt.type || CONTENT_TYPES.GENERAL;
        
        // Add to the appropriate type category
        migratedData[type].prompts[id] = {
          id,
          name: prompt.name,
          content: prompt.content,
          type: type,
          updatedAt: prompt.updatedAt || new Date().toISOString()
        };
        
        // If this is the first prompt of this type, make it preferred
        if (!migratedData[type].preferredPromptId) {
          migratedData[type].preferredPromptId = id;
        }
      });
      
      // Save the migrated data
      await this.storageService.set({ [STORAGE_KEY]: migratedData });
      
      // Optionally remove old data
      await this.storageService.remove('custom_prompts');
      
      return migratedData;
    } catch (error) {
      return null;
    }
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
          maxComments: 50
        }
      }
    };
  }
}
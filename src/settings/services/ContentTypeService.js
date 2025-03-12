import { CONTENT_TYPES, DEFAULT_SETTINGS, STORAGE_KEY } from '../utils/constants.js';

// Manages content type settings and configuration
export default class ContentTypeService {
  constructor(storageService, eventBus) {
    this.storageService = storageService;
    this.eventBus = eventBus;
  }

  async getSettings(contentType) {
    const data = await this.storageService.get(STORAGE_KEY) || {};
    
    if (!data[contentType] || !data[contentType].settings) {
      return DEFAULT_SETTINGS[contentType] || {};
    }
    
    return data[contentType].settings;
  }

  async updateSettings(contentType, settings) {
    const data = await this.storageService.get(STORAGE_KEY) || {};
    
    // Initialize the content type data if it doesn't exist
    if (!data[contentType]) {
      data[contentType] = {
        prompts: {},
        preferredPromptId: null,
        settings: {}
      };
    }
    
    // Update settings
    data[contentType].settings = {
      ...DEFAULT_SETTINGS[contentType],
      ...data[contentType].settings,
      ...settings
    };
    
    // Save to storage
    await this.storageService.set({ [STORAGE_KEY]: data });
    
    // Notify subscribers
    this.eventBus.publish('settings:updated', {
      contentType,
      settings: data[contentType].settings
    });
    
    return data[contentType].settings;
  }

  getDefaultSettings(contentType) {
    return DEFAULT_SETTINGS[contentType] || {};
  }

  getAllContentTypes() {
    return Object.values(CONTENT_TYPES);
  }
}
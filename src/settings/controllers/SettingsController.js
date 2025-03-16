// src/settings/controllers/SettingsController.js
import { STORAGE_KEY, DEFAULT_SETTINGS } from '../utils/constants.js';

export default class SettingsController {
  constructor(storageService, configManager, notificationManager) {
    this.storageService = storageService;
    this.configManager = configManager;
    this.notificationManager = notificationManager;
  }

  async getSettings(contentType) {
    try {
      const data = await this.storageService.get(STORAGE_KEY) || {};
      return data[contentType]?.settings || DEFAULT_SETTINGS[contentType] || {};
    } catch (error) {
      console.error('Error getting settings:', error);
      this.notificationManager.error(`Error loading settings: ${error.message}`);
      throw error;
    }
  }

  async updateSettings(contentType, settings) {
    try {
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
      
      return data[contentType].settings;
    } catch (error) {
      console.error('Error updating settings:', error);
      this.notificationManager.error(`Error updating settings: ${error.message}`);
      throw error;
    }
  }

  getDefaultSettings(contentType) {
    return DEFAULT_SETTINGS[contentType] || {};
  }
}
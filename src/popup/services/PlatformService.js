// src/popup/services/PlatformService.js
import { STORAGE_KEYS } from '../constants.js';

export default class PlatformService {
  constructor(storageService) {
    this.storageService = storageService;
  }

  async loadPlatforms() {
    try {
      const response = await fetch(chrome.runtime.getURL('platform-config.json'));
      const config = await response.json();
      
      if (!config.aiPlatforms) {
        throw new Error('AI platforms configuration not found');
      }
      
      // Transform to array with icon URLs
      const platforms = Object.entries(config.aiPlatforms).map(([id, platform]) => ({
        id,
        name: platform.name,
        url: platform.url,
        iconUrl: chrome.runtime.getURL(platform.icon)
      }));
      
      // Get preferred platform
      const preferredPlatformId = await this.storageService.get(STORAGE_KEYS.PREFERRED_PLATFORM) || 
                                config.defaultAiPlatform || 'claude';
      
      return { platforms, preferredPlatformId };
    } catch (error) {
      console.error('Error loading platforms:', error);
      return { platforms: [], preferredPlatformId: 'claude' };
    }
  }

  async setPreferredPlatform(platformId) {
    await this.storageService.set({ [STORAGE_KEYS.PREFERRED_PLATFORM]: platformId });
  }
}
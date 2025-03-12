// Handles loading and parsing configuration from config.json
export default class ConfigService {
  constructor(storageService) {
    this.storageService = storageService;
    this.config = null;
  }

  async getConfig() {
    // Return cached config if available
    if (this.config) {
      return this.config;
    }

    try {
      const response = await fetch(chrome.runtime.getURL('config.json'));
      this.config = await response.json();
      return this.config;
    } catch (error) {
      console.error('Error loading config:', error);
      return null;
    }
  }

  async getDefaultPrompts() {
    const config = await this.getConfig();
    return config?.defaultPrompts || {};
  }

  async getDefaultPromptForType(contentType) {
    const defaultPrompts = await this.getDefaultPrompts();
    return defaultPrompts[contentType] || null;
  }
}
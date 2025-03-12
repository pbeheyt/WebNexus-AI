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
      const configUrl = chrome.runtime.getURL('config.json');
      
      const response = await fetch(configUrl);
      if (!response.ok) {
        console.error('🔥 Error fetching config.json:', response.status, response.statusText);
        throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
      }
      
      this.config = await response.json();
      return this.config;
    } catch (error) {
      console.error('🔥 Error loading config:', error);
      return null;
    }
  }

  async getDefaultPrompts() {
    try {
      const config = await this.getConfig();
      if (!config) {
        console.error('🔥 Failed to get config for default prompts');
        return {};
      }
      
      const defaultPrompts = config.defaultPrompts || {};
      return defaultPrompts;
    } catch (error) {
      console.error('🔥 Error getting default prompts:', error);
      return {};
    }
  }

  async getDefaultPromptForType(contentType) {
    try {
      const defaultPrompts = await this.getDefaultPrompts();
      const prompt = defaultPrompts[contentType] || null;
      console.log('🔍 Default prompt for', contentType, prompt ? 'found' : 'not found');
      return prompt;
    } catch (error) {
      console.error('🔥 Error getting default prompt for type:', contentType, error);
      return null;
    }
  }
}
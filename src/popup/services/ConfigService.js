// popup/services/ConfigService.js
export default class ConfigService {
  constructor() {
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
        throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
      }
      
      this.config = await response.json();
      return this.config;
    } catch (error) {
      console.error('Error loading config:', error);
      return null;
    }
  }
}
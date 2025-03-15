// src/popup/services/ConfigService.js
import StorageService from './StorageService.js';

export default class ConfigService {
  constructor() {
    this.platformConfig = null;
    this.promptConfig = null;
    this.overrideConfig = null;
    this.storageService = new StorageService();
  }

  clearCache() {
    this.platformConfig = null;
    this.promptConfig = null;
    this.overrideConfig = null;
  }

  async getConfig(type = 'combined') {
    try {
      if (type === 'platform') {
        // Return cached platform config if available
        if (this.platformConfig) {
          return this.platformConfig;
        }
        
        const configUrl = chrome.runtime.getURL('platform-config.json');
        const response = await fetch(configUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch platform config: ${response.status} ${response.statusText}`);
        }
        
        this.platformConfig = await response.json();
        return this.platformConfig;
      } 
      else if (type === 'prompt') {
        // Check for override config first
        if (!this.overrideConfig) {
          try {
            const result = await chrome.storage.sync.get('prompt_config_override');
            this.overrideConfig = result.prompt_config_override || null;
          } catch (error) {
            console.error('Error loading config override:', error);
            this.overrideConfig = null;
          }
        }
        
        // Return override if available
        if (this.overrideConfig) {
          console.log('Using imported configuration override');
          return this.overrideConfig;
        }
        
        // Fall back to default config
        if (this.promptConfig) {
          return this.promptConfig;
        }
        
        const configUrl = chrome.runtime.getURL('prompt-config.json');
        const response = await fetch(configUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch prompt config: ${response.status} ${response.statusText}`);
        }
        
        this.promptConfig = await response.json();
        return this.promptConfig;
      }
      else {
        // For backward compatibility - return combined config
        const [platformConfig, promptConfig] = await Promise.all([
          this.getConfig('platform'),
          this.getConfig('prompt')
        ]);
        
        return { ...platformConfig, ...promptConfig };
      }
    } catch (error) {
      console.error(`Error loading ${type} config:`, error);
      return null;
    }
  }
}
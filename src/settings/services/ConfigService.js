// src/settings/services/ConfigService.js
export default class ConfigService {
  constructor(storageService) {
    this.storageService = storageService;
    this.platformConfig = null;
    this.promptConfig = null;
    this.overrideConfig = null;
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
        // Check for override config
        if (!this.overrideConfig) {
          // Check if there's an override in storage
          const { prompt_config_override } = await this.storageService.get('prompt_config_override', 'sync') || {};
          this.overrideConfig = prompt_config_override || null;
        }
        
        // If we have an override config, use it
        if (this.overrideConfig) {
          return this.overrideConfig;
        }
        
        // Otherwise use the default config
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
        // For combined config
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

  async getDefaultPrompts() {
    try {
      const config = await this.getConfig('prompt');
      if (!config) {
        console.error('Failed to get prompt config for default prompts');
        return {};
      }
      
      const defaultPrompts = config.defaultPrompts || {};
      return defaultPrompts;
    } catch (error) {
      console.error('Error getting default prompts:', error);
      return {};
    }
  }

  async getDefaultPromptForType(contentType) {
    try {
      const defaultPrompts = await this.getDefaultPrompts();
      const prompt = defaultPrompts[contentType] || null;
      return prompt;
    } catch (error) {
      console.error('Error getting default prompt for type:', contentType, error);
      return null;
    }
  }
}
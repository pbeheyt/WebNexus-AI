// src/popup/services/ConfigService.js
export default class ConfigService {
  constructor() {
    this.platformConfig = null;
    this.promptConfig = null;
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
        // Return cached prompt config if available
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
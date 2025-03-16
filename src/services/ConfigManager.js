/**
 * ConfigManager.js - Central configuration management
 * Single source of truth for all extension configuration
 */
class ConfigManager {
  constructor() {
    this.STORAGE_KEY = 'extension_configuration';
    this.config = null;
    this.subscribers = [];
    this.isInitialized = false;
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener(this._handleStorageChanged.bind(this));
  }

  /**
   * Initialize configuration
   * @returns {Promise<Object>} The complete configuration
   */
  async initialize() {
    if (this.isInitialized) return this.config;
    
    try {
      // Try to load config from storage
      const { [this.STORAGE_KEY]: storedConfig } = await chrome.storage.sync.get(this.STORAGE_KEY);
      
      if (storedConfig) {
        this.config = storedConfig;
      } else {
        // If no config in storage, load defaults and save
        this.config = await this._loadDefaultConfig();
        await this._saveConfig(this.config);
      }
      
      this.isInitialized = true;
      return this.config;
    } catch (error) {
      console.error('ConfigManager initialization error:', error);
      // Fallback to defaults without saving
      this.config = await this._loadDefaultConfig();
      this.isInitialized = true;
      return this.config;
    }
  }

  /**
   * Get the complete configuration
   * @returns {Promise<Object>} The complete configuration
   */
  async getConfig() {
    if (!this.isInitialized) {
      return this.initialize();
    }
    return this.config;
  }

  /**
   * Get a specific section of the configuration
   * @param {string} section - Section name (e.g., 'sharedParameters', 'defaultPrompts')
   * @returns {Promise<Object>} The requested config section
   */
  async getConfigSection(section) {
    const config = await this.getConfig();
    return config[section] || {};
  }

  /**
   * Get default prompts (BACKWARD COMPATIBILITY)
   * @returns {Promise<Object>} The default prompts 
   */
  async getDefaultPrompts() {
    console.warn('Deprecated: Use getConfigSection("defaultPrompts") instead');
    return this.getConfigSection('defaultPrompts');
  }

  /**
   * Get a specific prompt template
   * @param {string} contentType - Content type (e.g., 'general', 'youtube')
   * @returns {Promise<Object>} The prompt template
   */
  async getPromptTemplate(contentType) {
    const defaultPrompts = await this.getConfigSection('defaultPrompts');
    return defaultPrompts[contentType] || null;
  }

  /**
   * Update the configuration with a transaction function
   * @param {Function} updateFn - Function that takes current config and returns updated config
   * @returns {Promise<Object>} The updated configuration
   */
  async updateConfig(updateFn) {
    const config = await this.getConfig();
    const updatedConfig = updateFn({ ...config });
    await this._saveConfig(updatedConfig);
    return updatedConfig;
  }

  /**
   * Update a specific section of the configuration
   * @param {string} section - Section name
   * @param {Function|Object} updaterOrValue - Update function or direct value
   * @returns {Promise<Object>} The updated configuration
   */
  async updateConfigSection(section, updaterOrValue) {
    return this.updateConfig(config => {
      const currentSection = config[section] || {};
      
      if (typeof updaterOrValue === 'function') {
        config[section] = updaterOrValue(currentSection);
      } else {
        config[section] = updaterOrValue;
      }
      
      return config;
    });
  }

  /**
   * Reset configuration to defaults
   * @returns {Promise<Object>} The default configuration
   */
  async resetConfig() {
    const defaultConfig = await this._loadDefaultConfig();
    await this._saveConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * Subscribe to configuration changes
   * @param {Function} callback - Function to call on config change
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  /**
   * Load default configuration from file
   * @private
   * @returns {Promise<Object>} The default configuration
   */
  async _loadDefaultConfig() {
    try {
      const response = await fetch(chrome.runtime.getURL('prompt-config.json'));
      if (!response.ok) {
        throw new Error(`Failed to load default config: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error loading default configuration:', error);
      return {
        sharedParameters: {},
        defaultPrompts: {
          general: { name: 'Web Content', baseTemplate: 'Analyze this web content' },
          reddit: { name: 'Reddit Post', baseTemplate: 'Analyze this Reddit post' },
          youtube: { name: 'YouTube Video', baseTemplate: 'Analyze this YouTube video' }
        }
      };
    }
  }

  /**
   * Save configuration to storage
   * @private
   * @param {Object} config - Configuration to save
   * @returns {Promise<void>}
   */
  async _saveConfig(config) {
    try {
      this.config = config;
      await chrome.storage.sync.set({ [this.STORAGE_KEY]: config });
      this._notifySubscribers();
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw error;
    }
  }

  /**
   * Handle storage changes from other contexts
   * @private
   * @param {Object} changes - Storage changes
   * @param {string} area - Storage area
   */
  _handleStorageChanged(changes, area) {
    if (area === 'sync' && changes[this.STORAGE_KEY]) {
      const newConfig = changes[this.STORAGE_KEY].newValue;
      if (JSON.stringify(this.config) !== JSON.stringify(newConfig)) {
        this.config = newConfig;
        this._notifySubscribers();
      }
    }
  }

  /**
   * Notify subscribers of configuration changes
   * @private
   */
  _notifySubscribers() {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(this.config);
      } catch (error) {
        console.error('Error in config subscriber:', error);
      }
    }
  }

  /**
   * Import external configuration
   * @param {Object} importedConfig - The configuration to import
   * @returns {Promise<Object>} The merged configuration
   */
  async importConfig(importedConfig) {
    // Validate the imported config
    this._validateConfig(importedConfig);
    
    // Merge with current config to preserve critical fields
    const currentConfig = await this.getConfig();
    const mergedConfig = this._mergeConfigs(currentConfig, importedConfig);
    
    // Save the merged config
    await this._saveConfig(mergedConfig);
    
    return mergedConfig;
  }

  /**
   * Validate configuration structure
   * @private
   * @param {Object} config - Configuration to validate
   * @throws {Error} If config is invalid
   */
  _validateConfig(config) {
    if (!config.sharedParameters || !config.defaultPrompts) {
      throw new Error('Invalid configuration: missing required sections');
    }
    
    // Check core structure (can be expanded with more validation)
    const requiredPromptTypes = ['general', 'reddit', 'youtube'];
    for (const type of requiredPromptTypes) {
      if (!config.defaultPrompts[type]) {
        throw new Error(`Invalid configuration: missing '${type}' prompt template`);
      }
      
      if (!config.defaultPrompts[type].baseTemplate) {
        throw new Error(`Invalid configuration: missing baseTemplate for '${type}'`);
      }
    }
  }

  /**
   * Merge configurations, preserving critical fields
   * @private
   * @param {Object} currentConfig - Current configuration
   * @param {Object} importedConfig - Imported configuration
   * @returns {Object} Merged configuration
   */
  _mergeConfigs(currentConfig, importedConfig) {
    // Deep clone to avoid modifying the original
    const merged = JSON.parse(JSON.stringify(importedConfig));
    
    // Preserve YouTube commentAnalysis parameter if it exists
    if (currentConfig.defaultPrompts?.youtube?.parameters?.commentAnalysis &&
        merged.defaultPrompts?.youtube?.parameters) {
      merged.defaultPrompts.youtube.parameters.commentAnalysis = 
        currentConfig.defaultPrompts.youtube.parameters.commentAnalysis;
    }
    
    return merged;
  }
}

// Create and export singleton instance
const configManager = new ConfigManager();
export default configManager;
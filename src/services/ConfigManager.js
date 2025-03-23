const { STORAGE_KEYS } = require('../shared/constants');

/**
 * ConfigManager.js - Central configuration management
 * Single source of truth for all extension configuration
 */
class ConfigManager {
  constructor() {
    this.STORAGE_KEY = STORAGE_KEYS.TEMPLATE_CONFIG;
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
      const { [this.STORAGE_KEY]: storedConfig } = await chrome.storage.sync.get(this.STORAGE_KEY);
      
      if (storedConfig) {
        this.config = this._ensureParameterOrder(storedConfig);
      } else {
        const defaultConfig = await this._loadDefaultConfig();
        this.config = this._ensureParameterOrder(defaultConfig);
        await this._saveConfig(this.config);
      }
      
      this.isInitialized = true;
      return this.config;
    } catch (error) {
      console.error('ConfigManager initialization error:', error);
      const defaultConfig = await this._loadDefaultConfig();
      this.config = this._ensureParameterOrder(defaultConfig);
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
      const config = await response.json();
      return this._ensureParameterOrder(config);
    } catch (error) {
      console.error('Error loading default configuration:', error);
      return this._ensureParameterOrder({
        sharedParameters: {},
        defaultPrompts: {
          general: { 
            name: 'Web Content', 
            baseTemplate: 'Analyze this web content',
            parameters: {} 
          },
          reddit: { 
            name: 'Reddit Post', 
            baseTemplate: 'Analyze this Reddit post',
            parameters: {} 
          },
          youtube: { 
            name: 'YouTube Video', 
            baseTemplate: 'Analyze this YouTube video',
            parameters: {} 
          }
        }
      });
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
    
    // Ensure parameter order is set
    const orderedConfig = this._ensureParameterOrder(importedConfig);
    
    // Save the config
    await this._saveConfig(orderedConfig);
    
    return orderedConfig;
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
    
    // Validate parameter types
    const validateParameters = (parameters) => {
      Object.entries(parameters).forEach(([key, param]) => {
        if (param.type) {
          if (!['list', 'checkbox', 'single'].includes(param.type)) {
            throw new Error(`Invalid parameter type for '${key}': ${param.type}`);
          }
          
          // Type-specific validation
          if (param.type === 'list' && (!param.values || Object.keys(param.values).length === 0)) {
            throw new Error(`List parameter '${key}' must have at least one value`);
          }
          
          if (param.type === 'checkbox' && (!param.values?.true || !param.values?.false)) {
            throw new Error(`Checkbox parameter '${key}' must have true and false values`);
          }
          
          if (param.type === 'single' && param.value === undefined) {
            throw new Error(`Single parameter '${key}' must have a value property`);
          }
        }
      });
    };
    
    // Validate shared parameters
    validateParameters(config.sharedParameters);
    
    // Validate content-type parameters
    Object.entries(config.defaultPrompts).forEach(([contentType, template]) => {
      if (template.parameters) {
        validateParameters(template.parameters);
      }
    });
  }

  /**
   * Ensure all parameters have an order property and proper type
   * @private
   * @param {Object} config - Configuration to process
   * @returns {Object} Configuration with order properties
   */
  _ensureParameterOrder(config) {
    // Make deep copy to avoid modifying the input directly
    const newConfig = JSON.parse(JSON.stringify(config));
    
    // Process shared parameters
    if (newConfig.sharedParameters) {
      Object.entries(newConfig.sharedParameters).forEach(([key, param], index) => {
        if (param.order === undefined) {
          newConfig.sharedParameters[key].order = index;
        }
        
        // Ensure parameter has a type
        if (!param.type) {
          // Infer type from structure
          if (param.value !== undefined) {
            newConfig.sharedParameters[key].type = 'single';
          } else if (param.values && Object.keys(param.values).length === 2 && 
                    'true' in param.values && 'false' in param.values) {
            newConfig.sharedParameters[key].type = 'checkbox';
          } else {
            newConfig.sharedParameters[key].type = 'list';
          }
        }
      });
    }
    
    // Process content-specific parameters
    if (newConfig.defaultPrompts) {
      Object.entries(newConfig.defaultPrompts).forEach(([contentType, typeConfig]) => {
        if (typeConfig.parameters) {
          Object.entries(typeConfig.parameters).forEach(([key, param], index) => {
            if (param.order === undefined) {
              newConfig.defaultPrompts[contentType].parameters[key].order = index;
            }
            
            // Ensure parameter has a type
            if (!param.type) {
              // Infer type from structure
              if (param.value !== undefined) {
                newConfig.defaultPrompts[contentType].parameters[key].type = 'single';
              } else if (param.values && Object.keys(param.values).length === 2 && 
                        'true' in param.values && 'false' in param.values) {
                newConfig.defaultPrompts[contentType].parameters[key].type = 'checkbox';
              } else {
                newConfig.defaultPrompts[contentType].parameters[key].type = 'list';
              }
            }
          });
        }
      });
    }
    
    return newConfig;
  }
}

// Create and export singleton instance
const configManager = new ConfigManager();
export default configManager;
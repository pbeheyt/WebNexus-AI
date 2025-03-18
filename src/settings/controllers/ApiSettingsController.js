// src/settings/controllers/ApiSettingsController.js

/**
 * Controller for managing API settings and credentials
 */
class ApiSettingsController {
  constructor(eventBus, notificationManager) {
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
    this.platformConfig = null;
    this.credentials = {};
    this.advancedSettings = {};
    
    // Import services dynamically to avoid circular dependencies
    this.importServices();
  }
  
  /**
   * Import required services dynamically
   */
  async importServices() {
    try {
      // Get the credential manager from the existing service
      this.credentialManager = await import('../../services/CredentialManager')
        .then(module => module.default || module);
      
      // Get the model manager from the existing service
      this.modelManager = await import('../../services/ModelManager')
        .then(module => module.default || module);
      
      // Storage key for advanced API settings
      this.API_SETTINGS_KEY = 'api_advanced_settings';
    } catch (error) {
      console.error('Error importing services:', error);
    }
  }
  
  /**
   * Initialize the controller
   * @returns {Promise<boolean>} Success indicator
   */
  async initialize() {
    try {
      // Load platform configuration
      this.platformConfig = await this.loadPlatformConfig();
      
      // Load saved credentials for all platforms
      await this.loadAllCredentials();
      
      // Load advanced settings
      await this.loadAdvancedSettings();

      // Initialize default settings if needed
      await this.initializeDefaultSettings();
      
      return true;
    } catch (error) {
      console.error('Error initializing API settings controller:', error);
      this.notificationManager.error(`Failed to initialize API settings: ${error.message}`);
      return false;
    }
  }

  /**
   * Initialize default settings for platforms and models
   * @returns {Promise<void>}
   */
  async initializeDefaultSettings() {
    try {
      let needsSaving = false;

      // For each platform in the config
      for (const [platformId, platformConfig] of Object.entries(this.platformConfig.aiPlatforms || {})) {
        // Skip if no API configuration
        if (!platformConfig.api) continue;

        // Initialize platform settings if not present
        if (!this.advancedSettings[platformId]) {
          this.advancedSettings[platformId] = {
            default: {
              maxTokens: this.getDefaultMaxTokens(platformId),
              temperature: 0.7
            },
            models: {}
          };
          needsSaving = true;
        } else if (!this.advancedSettings[platformId].default) {
          // Ensure the structure has a default section
          this.advancedSettings[platformId].default = {
            maxTokens: this.getDefaultMaxTokens(platformId),
            temperature: 0.7
          };
          needsSaving = true;
        }

        // Ensure models section exists
        if (!this.advancedSettings[platformId].models) {
          this.advancedSettings[platformId].models = {};
          needsSaving = true;
        }

        // Add platform-specific default parameters
        if (platformId === 'chatgpt' && this.advancedSettings[platformId].default.topP === undefined) {
          this.advancedSettings[platformId].default.topP = 1.0;
          needsSaving = true;
        } else if (platformId === 'claude' && this.advancedSettings[platformId].default.systemPrompt === undefined) {
          this.advancedSettings[platformId].default.systemPrompt = '';
          needsSaving = true;
        }
      }

      // Save if changes were made
      if (needsSaving) {
        await chrome.storage.sync.set({ [this.API_SETTINGS_KEY]: this.advancedSettings });
        console.log('Default API settings initialized');
      }
    } catch (error) {
      console.error('Error initializing default settings:', error);
    }
  }
  
  /**
   * Load platform configuration
   * @returns {Promise<Object>} Platform configuration
   */
  async loadPlatformConfig() {
    try {
      const response = await fetch(chrome.runtime.getURL('platform-config.json'));
      return await response.json();
    } catch (error) {
      console.error('Error loading platform config:', error);
      throw new Error('Failed to load platform configuration');
    }
  }
  
  /**
   * Load credentials for all platforms
   */
  async loadAllCredentials() {
    try {
      // Get a list of platforms from platform config
      const platforms = Object.keys(this.platformConfig.aiPlatforms || {});
      
      // Load credentials for each platform
      for (const platformId of platforms) {
        const credentials = await this.credentialManager.getCredentials(platformId);
        if (credentials) {
          this.credentials[platformId] = credentials;
        }
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
      throw new Error('Failed to load API credentials');
    }
  }
  
  /**
   * Load advanced API settings
   */
  async loadAdvancedSettings() {
    try {
      const result = await chrome.storage.sync.get(this.API_SETTINGS_KEY);
      this.advancedSettings = result[this.API_SETTINGS_KEY] || {};
    } catch (error) {
      console.error('Error loading advanced settings:', error);
      this.advancedSettings = {};
    }
  }
  
  /**
   * Get all platform details with credentials
   * @returns {Array<Object>} Array of platform details with credentials
   */
  getPlatformsWithCredentials() {
    if (!this.platformConfig || !this.platformConfig.aiPlatforms) {
      return [];
    }
    
    return Object.entries(this.platformConfig.aiPlatforms).map(([id, config]) => {
      return {
        id,
        name: config.name,
        icon: config.icon,
        url: config.url,
        docUrl: config.docUrl || this.getDefaultDocUrl(id),
        apiConfig: config.api,
        credentials: this.credentials[id] || null,
        advancedSettings: this.advancedSettings[id] || {}
      };
    });
  }
  
  /**
   * Get default documentation URL for a platform
   * @param {string} platformId Platform ID
   * @returns {string} Documentation URL
   */
  getDefaultDocUrl(platformId) {
    const docUrls = {
      'claude': 'https://docs.anthropic.com/claude/reference/getting-started-with-the-api',
      'chatgpt': 'https://platform.openai.com/docs/api-reference',
      'gemini': 'https://ai.google.dev/docs',
      'mistral': 'https://docs.mistral.ai/',
      'deepseek': 'https://platform.deepseek.ai/',
      'grok': 'https://x.ai/api-docs'
    };
    
    return docUrls[platformId] || '#';
  }
  
  /**
   * Save API key for a platform
   * @param {string} platformId Platform ID
   * @param {string} apiKey API key
   * @param {string} model Selected model
   * @returns {Promise<boolean>} Success indicator
   */
  async saveCredentials(platformId, apiKey, model) {
    try {
      // Validate inputs
      if (!platformId) {
        throw new Error('Invalid platform ID');
      }
      
      if (!apiKey) {
        throw new Error('API key cannot be empty');
      }
      
      // Create credentials object
      const credentials = {
        apiKey,
        model: model || null
      };
      
      // Validate with the credential manager
      const validationResult = await this.credentialManager.validateCredentials(
        platformId,
        credentials
      );
      
      if (!validationResult.isValid) {
        throw new Error(`Invalid API key: ${validationResult.message}`);
      }
      
      // Store the credentials
      await this.credentialManager.storeCredentials(platformId, credentials);
      
      // Update local copy
      this.credentials[platformId] = credentials;
      
      // Notify success
      this.notificationManager.success(`API key saved for ${this.getPlatformName(platformId)}`);
      
      // Publish event
      this.eventBus.publish('api:credentials:updated', {
        platformId,
        hasCredentials: true
      });
      
      return true;
    } catch (error) {
      console.error('Error saving API key:', error);
      this.notificationManager.error(`Failed to save API key: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Remove API key for a platform
   * @param {string} platformId Platform ID
   * @returns {Promise<boolean>} Success indicator
   */
  async removeCredentials(platformId) {
    try {
      await this.credentialManager.removeCredentials(platformId);
      
      // Update local copy
      delete this.credentials[platformId];
      
      // Notify success
      this.notificationManager.success(`API key removed for ${this.getPlatformName(platformId)}`);
      
      // Publish event
      this.eventBus.publish('api:credentials:updated', {
        platformId,
        hasCredentials: false
      });
      
      return true;
    } catch (error) {
      console.error('Error removing API key:', error);
      this.notificationManager.error(`Failed to remove API key: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Test API key for a platform
   * @param {string} platformId Platform ID
   * @param {string} apiKey API key
   * @param {string} model Model ID
   * @returns {Promise<Object>} Test result
   */
  async testApiKey(platformId, apiKey, model) {
    try {
      // Validate inputs
      if (!platformId || !apiKey) {
        throw new Error('Platform ID and API key are required');
      }
      
      // Create temporary credentials
      const credentials = {
        apiKey,
        model: model || null
      };
      
      // Validate with the credential manager
      const validationResult = await this.credentialManager.validateCredentials(
        platformId,
        credentials
      );
      
      return {
        success: validationResult.isValid,
        message: validationResult.message
      };
    } catch (error) {
      console.error('Error testing API key:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  /**
   * Get available models for a platform
   * @param {string} platformId Platform ID
   * @returns {Promise<Array<string>>} Available models
   */
  async getAvailableModels(platformId) {
    try {
      return await this.modelManager.getAvailableModels(platformId);
    } catch (error) {
      console.error('Error getting available models:', error);
      return [];
    }
  }
  
  /**
   * Get advanced settings for a platform and model
   * @param {string} platformId Platform ID
   * @param {string} modelId Model ID (optional)
   * @returns {Object} Advanced settings
   */
  getAdvancedSettings(platformId, modelId = null) {
    const platformSettings = this.advancedSettings[platformId] || {};
    
    if (!modelId || modelId === 'default') {
      return platformSettings.default || {};
    }
    
    // Merge default with model-specific settings
    const defaultSettings = platformSettings.default || {};
    const modelSettings = platformSettings.models?.[modelId] || {};
    
    return { ...defaultSettings, ...modelSettings };
  }
  
  /**
   * Save advanced settings for a platform
   * @param {string} platformId Platform ID
   * @param {Object} settings Settings object
   * @param {string} modelId Model ID (optional)
   * @returns {Promise<boolean>} Success indicator
   */
  async saveAdvancedSettings(platformId, settings, modelId = null) {
    try {
      // Load current settings
      await this.loadAdvancedSettings();
      
      // Initialize platform settings if needed
      if (!this.advancedSettings[platformId]) {
        this.advancedSettings[platformId] = {
          default: {},
          models: {}
        };
      }
      
      // Ensure structure is correct
      if (!this.advancedSettings[platformId].default) {
        this.advancedSettings[platformId].default = {};
      }
      
      if (!this.advancedSettings[platformId].models) {
        this.advancedSettings[platformId].models = {};
      }
      
      // Update appropriate settings
      if (!modelId || modelId === 'default') {
        // Update default settings
        this.advancedSettings[platformId].default = {
          ...this.advancedSettings[platformId].default,
          ...settings
        };
      } else {
        // Update model-specific settings
        this.advancedSettings[platformId].models[modelId] = {
          ...this.advancedSettings[platformId].models[modelId] || {},
          ...settings
        };
      }
      
      // Save to storage
      await chrome.storage.sync.set({
        [this.API_SETTINGS_KEY]: this.advancedSettings
      });
      
      // Notify success
      const targetName = modelId && modelId !== 'default' 
        ? `${modelId} model`
        : `${this.getPlatformName(platformId)} defaults`;
      
      this.notificationManager.success(`Advanced settings saved for ${targetName}`);
      
      // Publish event
      this.eventBus.publish('api:settings:updated', {
        platformId,
        modelId: modelId || 'default',
        settings: modelId && modelId !== 'default' 
          ? this.advancedSettings[platformId].models[modelId]
          : this.advancedSettings[platformId].default
      });
      
      return true;
    } catch (error) {
      console.error('Error saving advanced settings:', error);
      this.notificationManager.error(`Failed to save advanced settings: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Reset model settings to platform defaults
   * @param {string} platformId Platform ID
   * @param {string} modelId Model ID
   * @returns {Promise<boolean>} Success indicator
   */
  async resetModelToDefaults(platformId, modelId) {
    try {
      if (!this.advancedSettings[platformId]?.models?.[modelId]) {
        // Nothing to reset
        return true;
      }
      
      // Remove model-specific settings
      delete this.advancedSettings[platformId].models[modelId];
      
      // Save to storage
      await chrome.storage.sync.set({
        [this.API_SETTINGS_KEY]: this.advancedSettings
      });
      
      // Notify success
      this.notificationManager.success(`Reset ${modelId} to ${this.getPlatformName(platformId)} defaults`);
      
      // Publish event
      this.eventBus.publish('api:settings:updated', {
        platformId,
        modelId,
        settings: this.advancedSettings[platformId].default
      });
      
      return true;
    } catch (error) {
      console.error('Error resetting model settings:', error);
      this.notificationManager.error(`Failed to reset model settings: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get overridden parameters for a model
   * @param {string} platformId Platform ID
   * @param {string} modelId Model ID
   * @returns {Object} Object with overridden parameter names as keys
   */
  getOverriddenParameters(platformId, modelId) {
    const defaultSettings = this.getAdvancedSettings(platformId, 'default');
    const modelSettings = this.advancedSettings[platformId]?.models?.[modelId] || {};
    
    const overridden = {};
    Object.keys(modelSettings).forEach(key => {
      // Consider a parameter overridden if it exists in model settings
      overridden[key] = true;
    });
    
    return overridden;
  }
  
  /**
   * Get platform name by ID
   * @param {string} platformId Platform ID
   * @returns {string} Platform name
   */
  getPlatformName(platformId) {
    if (this.platformConfig && this.platformConfig.aiPlatforms && this.platformConfig.aiPlatforms[platformId]) {
      return this.platformConfig.aiPlatforms[platformId].name;
    }
    
    return platformId.charAt(0).toUpperCase() + platformId.slice(1);
  }
  
  /**
   * Get token label for a platform
   * @param {string} platformId Platform ID
   * @param {Object} modelConfig Optional model-specific config
   * @returns {string} Token label
   */
  getTokensLabel(platformId, modelConfig = null) {
    // Check model-specific token parameter name
    if (modelConfig && modelConfig.tokenParameter) {
      if (modelConfig.tokenParameter === 'max_completion_tokens') {
        return 'Max Completion Tokens:';
      }
      if (modelConfig.tokenParameter === 'maxOutputTokens') {
        return 'Max Output Tokens:';
      }
    }
    
    // Platform-specific defaults
    if (platformId === 'chatgpt' || platformId === 'grok') {
      return 'Max Completion Tokens:';
    }
    
    return 'Max Tokens:';
  }
  
  /**
   * Get default max tokens for a platform/model
   * @param {string} platformId Platform ID
   * @param {Object} modelConfig Optional model-specific config
   * @returns {number} Default max tokens
   */
  getDefaultMaxTokens(platformId, modelConfig = null) {
    // If model config provides a value, use it
    if (modelConfig && modelConfig.maxTokens) {
      return modelConfig.maxTokens;
    }
    
    // Platform-specific defaults
    switch (platformId) {
      case 'claude':
        return 4007;
      case 'chatgpt':
        return 2048;
      case 'gemini':
        return 2048;
      case 'mistral':
        return 4096;
      case 'deepseek':
        return 4096;
      case 'grok':
        return 4096;
      default:
        return 2048;
    }
  }
}

export default ApiSettingsController;
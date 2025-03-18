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
      
      return true;
    } catch (error) {
      console.error('Error initializing API settings controller:', error);
      this.notificationManager.error(`Failed to initialize API settings: ${error.message}`);
      return false;
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
        docUrl: config.docLink || this.getDefaultDocUrl(id),
        modelApiLink: config.modelApiLink || this.getDefaultModelApiLink(id),
        consoleApiLink: config.consoleApiLink || '#',
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
   * Get default model documentation URL for a platform
   * @param {string} platformId Platform ID
   * @returns {string} Model documentation URL
   */
  getDefaultModelApiLink(platformId) {
    const modelUrls = {
      'claude': 'https://docs.anthropic.com/claude/reference/models',
      'chatgpt': 'https://platform.openai.com/docs/models',
      'gemini': 'https://ai.google.dev/models/gemini',
      'mistral': 'https://docs.mistral.ai/models/',
      'deepseek': 'https://platform.deepseek.ai/docs/api/models',
      'grok': 'https://x.ai/models'
    };
    
    return modelUrls[platformId] || '#';
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
   * Get the model configuration from the platform config file
   * @param {string} platformId Platform ID
   * @param {string} modelId Model ID
   * @returns {Object|null} Model configuration or null if not found
   */
  getModelConfigFromFile(platformId, modelId) {
    if (!this.platformConfig?.aiPlatforms?.[platformId]?.api?.models) {
      return null;
    }
    
    return this.platformConfig.aiPlatforms[platformId].api.models.find(
      model => model.id === modelId
    ) || null;
  }
  
  /**
   * Get advanced settings for a platform and model
   * @param {string} platformId Platform ID
   * @param {string} modelId Model ID (optional)
   * @returns {Object} Advanced settings
   */
  getAdvancedSettings(platformId, modelId = null) {
    // Get stored settings
    const platformSettings = this.advancedSettings[platformId] || {};
    
    if (!modelId || modelId === 'default') {
      return platformSettings.default || {};
    }
    
    // Get model-specific settings
    return platformSettings.models?.[modelId] || {};
  }
  
  /**
   * Get default settings for a model from the config file
   * @param {string} platformId Platform ID
   * @param {string} modelId Model ID
   * @returns {Object} Default settings based on config file
   */
  getModelDefaultSettings(platformId, modelId) {
    const modelConfig = this.getModelConfigFromFile(platformId, modelId);
    if (!modelConfig) {
      return {};
    }
    
    // Extract default values from model config
    const defaultSettings = {
      maxTokens: modelConfig.maxTokens || 1000,
      contextWindow: modelConfig.contextWindow || 16000
    };
    
    // Add temperature if supported
    if (modelConfig.supportsTemperature !== false) {
      defaultSettings.temperature = modelConfig.temperature || 0.7;
    }
    
    // Add top_p if supported
    if (modelConfig.supportsTopP === true) {
      defaultSettings.topP = modelConfig.topP || 1.0;
    }
    
    return defaultSettings;
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
   * Reset model settings to config file defaults
   * @param {string} platformId Platform ID
   * @param {string} modelId Model ID
   * @returns {Promise<boolean>} Success indicator
   */
  async resetModelToDefaults(platformId, modelId) {
    try {
      // Get defaults from config file
      const defaultSettings = this.getModelDefaultSettings(platformId, modelId);
      
      // Apply settings from config file
      if (modelId === 'default') {
        // Reset platform default settings
        this.advancedSettings[platformId].default = { ...defaultSettings };
      } else {
        // Reset model-specific settings
        this.advancedSettings[platformId].models[modelId] = { ...defaultSettings };
      }
      
      // Save to storage
      await chrome.storage.sync.set({
        [this.API_SETTINGS_KEY]: this.advancedSettings
      });
      
      // Notify success
      this.notificationManager.success(`Reset ${modelId} to configuration defaults`);
      
      // Publish event
      this.eventBus.publish('api:settings:updated', {
        platformId,
        modelId,
        settings: defaultSettings
      });
      
      return true;
    } catch (error) {
      console.error('Error resetting model settings:', error);
      this.notificationManager.error(`Failed to reset model settings: ${error.message}`);
      return false;
    }
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
    
    // Get platform model config
    const platformModels = this.platformConfig?.aiPlatforms?.[platformId]?.api?.models;
    if (platformModels && platformModels.length > 0) {
      const defaultModel = platformModels.find(m => m.id === platformModels[0].id);
      if (defaultModel && defaultModel.maxTokens) {
        return defaultModel.maxTokens;
      }
    }
    
    // Fallback defaults
    return 2048;
  }
  
  /**
   * Get context window for a model from the config file
   * @param {string} platformId Platform ID
   * @param {Object} modelConfig Model configuration object
   * @returns {number} Context window size
   */
  getContextWindow(platformId, modelConfig = null) {
    // If model config provides a value, use it
    if (modelConfig && modelConfig.contextWindow) {
      return modelConfig.contextWindow;
    }
    
    // Get platform model config
    const platformModels = this.platformConfig?.aiPlatforms?.[platformId]?.api?.models;
    if (platformModels && platformModels.length > 0) {
      const defaultModel = platformModels.find(m => m.id === platformModels[0].id);
      if (defaultModel && defaultModel.contextWindow) {
        return defaultModel.contextWindow;
      }
    }
    
    // Fallback defaults
    return 16000;
  }
}

export default ApiSettingsController;
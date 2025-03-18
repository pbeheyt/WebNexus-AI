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
   * Save advanced settings for a platform
   * @param {string} platformId Platform ID
   * @param {Object} settings Settings object
   * @returns {Promise<boolean>} Success indicator
   */
  async saveAdvancedSettings(platformId, settings) {
    try {
      // Load current settings
      await this.loadAdvancedSettings();
      
      // Update settings for this platform
      this.advancedSettings[platformId] = {
        ...this.advancedSettings[platformId],
        ...settings
      };
      
      // Save to storage
      await chrome.storage.sync.set({
        [this.API_SETTINGS_KEY]: this.advancedSettings
      });
      
      // Notify success
      this.notificationManager.success(`Advanced settings saved for ${this.getPlatformName(platformId)}`);
      
      // Publish event
      this.eventBus.publish('api:settings:updated', {
        platformId,
        settings: this.advancedSettings[platformId]
      });
      
      return true;
    } catch (error) {
      console.error('Error saving advanced settings:', error);
      this.notificationManager.error(`Failed to save advanced settings: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get advanced settings for a platform
   * @param {string} platformId Platform ID
   * @returns {Object} Advanced settings
   */
  getAdvancedSettings(platformId) {
    return this.advancedSettings[platformId] || {};
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
}

export default ApiSettingsController;
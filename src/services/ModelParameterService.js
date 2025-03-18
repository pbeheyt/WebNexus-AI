// src/services/ModelParameterService.js
const TokenCalculationService = require('./TokenCalculationService');

/**
 * Service for managing model-specific parameters
 */
class ModelParameterService {
  constructor() {
    this.cachedConfig = null;
    this.STORAGE_KEY = 'model_specific_settings';
  }

  /**
   * Load platform configuration
   * @returns {Promise<Object>} Platform configuration
   */
  async loadPlatformConfig() {
    if (this.cachedConfig) return this.cachedConfig;
    
    try {
      const response = await fetch(chrome.runtime.getURL('platform-config.json'));
      this.cachedConfig = await response.json();
      return this.cachedConfig;
    } catch (error) {
      console.error('Error loading platform config:', error);
      throw error;
    }
  }

  /**
   * Get model configuration for a specific model
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID
   * @returns {Promise<Object|null>} Model configuration or null if not found
   */
  async getModelConfig(platformId, modelId) {
    const config = await this.loadPlatformConfig();
    
    if (!config?.aiPlatforms?.[platformId]?.api?.models) return null;
    
    const platformConfig = config.aiPlatforms[platformId];
    return TokenCalculationService.getModelConfig(platformConfig, modelId);
  }

  /**
   * Get user-defined model settings
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID
   * @returns {Promise<Object>} User settings for the model
   */
  async getUserModelSettings(platformId, modelId) {
    try {
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      const allSettings = result[this.STORAGE_KEY] || {};
      
      // Return model-specific settings or empty object if not found
      return allSettings[`${platformId}_${modelId}`] || {};
    } catch (error) {
      console.error('Error getting user model settings:', error);
      return {};
    }
  }

  /**
   * Save user-defined model settings
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID
   * @param {Object} settings - Settings to save
   * @returns {Promise<boolean>} Success indicator
   */
  async saveUserModelSettings(platformId, modelId, settings) {
    try {
      // Get existing settings
      const result = await chrome.storage.sync.get(this.STORAGE_KEY);
      const allSettings = result[this.STORAGE_KEY] || {};
      
      // Update settings for this model
      allSettings[`${platformId}_${modelId}`] = settings;
      
      // Save back to storage
      await chrome.storage.sync.set({ [this.STORAGE_KEY]: allSettings });
      
      return true;
    } catch (error) {
      console.error('Error saving user model settings:', error);
      return false;
    }
  }

  /**
   * Resolve parameters for a specific model, combining defaults and user settings
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID
   * @param {string} prompt - The prompt to send (for token calculations)
   * @returns {Promise<Object>} Resolved parameters
   */
  async resolveParameters(platformId, modelId, prompt) {
    try {
      // Get model config from platform config
      const modelConfig = await this.getModelConfig(platformId, modelId);
      if (!modelConfig) {
        throw new Error(`Model configuration not found for ${modelId}`);
      }
      
      // Get user settings for this model
      const userSettings = await this.getUserModelSettings(platformId, modelId);
      
      // Start with model defaults
      const params = {
        maxTokens: modelConfig.maxTokens || 4000,
        temperature: modelConfig.temperature || 0.7,
        topP: modelConfig.topP || 1.0,
        parameterStyle: modelConfig.parameterStyle || 'standard',
        tokenParameter: modelConfig.tokenParameter || 'max_tokens',
        contextWindow: modelConfig.contextWindow || 8192,
        supportsTemperature: modelConfig.supportsTemperature !== false,
        supportsTopP: modelConfig.supportsTopP !== false
      };
      
      // Override with user settings if provided
      if (userSettings.maxTokens) params.maxTokens = userSettings.maxTokens;
      if (userSettings.temperature && params.supportsTemperature) params.temperature = userSettings.temperature;
      if (userSettings.topP && params.supportsTopP) params.topP = userSettings.topP;
      
      // Calculate available completion tokens based on prompt size
      if (prompt) {
        params.effectiveMaxTokens = TokenCalculationService.calculateAvailableCompletionTokens(
          prompt, 
          params.contextWindow, 
          params.maxTokens
        );
      } else {
        params.effectiveMaxTokens = params.maxTokens;
      }
      
      return params;
    } catch (error) {
      console.error('Error resolving parameters:', error);
      
      // Return reasonable defaults if resolution fails
      return {
        maxTokens: 4000,
        effectiveMaxTokens: 4000,
        temperature: 0.7,
        topP: 1.0,
        parameterStyle: 'standard',
        tokenParameter: 'max_tokens',
        supportsTemperature: true,
        supportsTopP: true
      };
    }
  }
}

module.exports = new ModelParameterService();
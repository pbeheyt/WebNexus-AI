// src/services/ModelParameterService.js
const { STORAGE_KEYS, INTERFACE_SOURCES } = require('../shared/constants');
const logger = require('../shared/logger.js').service;

/**
 * Service for managing model-specific parameters
 */
class ModelParameterService {
  constructor() {
    this.cachedConfig = null;
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
      logger.error('Error loading platform config:', error);
      throw error;
    }
  }

  /**
   * Centralized model resolution method with clear priority hierarchy
   * @param {string} platformId - Platform ID
   * @param {Object} options - Additional options
   * @param {number} [options.tabId] - Tab ID for tab-specific preferences
   * @param {string} [options.source] - Interface source (popup or sidebar)
   * @returns {Promise<string>} Resolved model ID
   */
  async resolveModel(platformId, options = {}) {
    const { tabId, source } = options;
    let modelId = null;
    
    // 1. Try tab-specific model preference (highest priority)
    if (tabId) {
      try {
        const tabPrefs = await chrome.storage.local.get(STORAGE_KEYS.TAB_MODEL_PREFERENCES);
        const tabModels = tabPrefs[STORAGE_KEYS.TAB_MODEL_PREFERENCES] || {};
        
        if (tabModels[tabId] && tabModels[tabId][platformId]) {
          modelId = tabModels[tabId][platformId];
          logger.info(`Using tab-specific model for ${platformId}: ${modelId}`);
          return modelId;
        }
      } catch (error) {
        logger.error('Error getting tab-specific model:', error);
      }
    }
    
    // 2. Try source-specific global preference (Sidebar only)
    if (source === INTERFACE_SOURCES.SIDEBAR) {
      const storageKey = STORAGE_KEYS.SIDEBAR_MODEL;
        
      try {
        const sourcePrefs = await chrome.storage.sync.get(storageKey);
        const sourcePref = sourcePrefs[storageKey] || {};
        
        if (sourcePref[platformId]) {
          modelId = sourcePref[platformId];
          logger.info(`Using ${source} model preference for ${platformId}: ${modelId}`);
          return modelId;
        }
      } catch (error) {
        logger.error(`Error getting ${source} model preference:`, error);
      }
    }
    
    // 3. Use platform default from config
    try {
      const config = await this.loadPlatformConfig();
      modelId = config?.aiPlatforms?.[platformId]?.api?.defaultModel;
      
      if (modelId) {
        logger.info(`Using platform default model for ${platformId}: ${modelId}`);
        return modelId;
      }
    } catch (error) {
      logger.error('Error loading platform config:', error);
    }
    
    // 4. Last resort fallbacks
    const fallbackMap = {
      'chatgpt': 'gpt-4o',
      'claude': 'claude-3-7-sonnet-latest',
      'gemini': 'gemini-1.5-flash',
      'mistral': 'mistral-large-latest',
      'deepseek': 'deepseek-chat',
      'grok': 'grok-2-1212'
    };
    
    modelId = fallbackMap[platformId] || 'gpt-4o';
    logger.info(`Using fallback model for ${platformId}: ${modelId}`);
    return modelId;
  }

  /**
   * Get model configuration for a specific model
   * @param {string} platformId - Platform ID
   * @param {string} modelIdOrObject - Model ID or object containing model ID
   * @returns {Promise<Object|null>} Model configuration or null if not found
   */
  async getModelConfig(platformId, modelIdOrObject) {
    const config = await this.loadPlatformConfig();

    if (!config?.aiPlatforms?.[platformId]?.api?.models) return null;

    // Normalize input - handle both string IDs and model objects
    const modelId = typeof modelIdOrObject === 'object' && modelIdOrObject !== null
      ? modelIdOrObject.id || modelIdOrObject.model || String(modelIdOrObject)
      : modelIdOrObject;

    logger.info(`Resolving model config for: ${platformId}/${modelId}`);

    const platformConfig = config.aiPlatforms[platformId];
    
    // Find model in array of objects (directly implemented, no longer calling TokenCalculationService)
    return platformConfig.api.models.find(model => model.id === modelId) || null;
  }

  /**
   * Get user-defined model settings
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID
   * @returns {Promise<Object>} User settings for the model
   */
  async getUserModelSettings(platformId, modelId) {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.API_ADVANCED_SETTINGS);
      const advancedSettings = result[STORAGE_KEYS.API_ADVANCED_SETTINGS] || {};

      // Get platform settings
      const platformSettings = advancedSettings[platformId] || {};

      // First try model-specific settings, then fall back to default settings
      const modelSettings =
        (platformSettings.models && platformSettings.models[modelId]) ||
        platformSettings.default ||
        {};

      logger.info(`Settings for ${platformId}/${modelId}:`, modelSettings);

      return modelSettings;
    } catch (error) {
      logger.error('Error getting user model settings:', error);
      return {};
    }
  }

  /**
   * Save model preference for a specific tab
   * @param {number} tabId - Tab ID
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID to save
   * @returns {Promise<boolean>} Success indicator
   */
  async saveTabModelPreference(tabId, platformId, modelId) {
    try {
      // Get current tab preferences
      const tabPrefs = await chrome.storage.local.get(STORAGE_KEYS.TAB_MODEL_PREFERENCES);
      const tabModels = tabPrefs[STORAGE_KEYS.TAB_MODEL_PREFERENCES] || {};
      
      // Initialize tab entry if needed
      if (!tabModels[tabId]) {
        tabModels[tabId] = {};
      }
      
      // Save model preference
      tabModels[tabId][platformId] = modelId;
      
      // Store updated preferences
      await chrome.storage.local.set({
        [STORAGE_KEYS.TAB_MODEL_PREFERENCES]: tabModels,
        [STORAGE_KEYS.LAST_ACTIVE_TAB]: tabId
      });
      
      logger.info(`Saved tab model preference: Tab ${tabId}, Platform ${platformId}, Model ${modelId}`);
      return true;
    } catch (error) {
      logger.error('Error saving tab model preference:', error);
      return false;
    }
  }

  /**
   * Save global model preference for a source
   * @param {string} source - Interface source (popup or sidebar)
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID to save
   * @returns {Promise<boolean>} Success indicator
   */
  async saveSourceModelPreference(source, platformId, modelId) {
    try {
      const storageKey = source === INTERFACE_SOURCES.SIDEBAR 
        ? STORAGE_KEYS.SIDEBAR_MODEL 
        : STORAGE_KEYS.API_MODE_PREFERENCE;
      
      // Get current preferences
      const prefs = await chrome.storage.sync.get(storageKey);
      const modelPrefs = prefs[storageKey] || {};
      
      // Update preference
      modelPrefs[platformId] = modelId;
      
      // Save updated preferences
      await chrome.storage.sync.set({ [storageKey]: modelPrefs });
      
      logger.info(`Saved ${source} model preference: Platform ${platformId}, Model ${modelId}`);
      return true;
    } catch (error) {
      logger.error(`Error saving ${source} model preference:`, error);
      return false;
    }
  }

  /**
   * Resolve parameters for a specific model, combining defaults and user settings
   * @param {string} platformId - Platform ID
   * @param {string} modelOverride - Optional model override
   * @param {string} prompt - The prompt to send (for token calculations)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Resolved parameters
   */
  async resolveParameters(platformId, modelOverride, options = {}) {
    try {
      const { tabId, source } = options;
      logger.info(`Resolving parameters for ${platformId}`);
      
      // Determine model to use
      const modelToUse = modelOverride || await this.resolveModel(platformId, { tabId, source });
      logger.info(`Model to use: ${modelToUse}`);
      
      // Get model config from platform config for the resolved model
      const modelConfig = await this.getModelConfig(platformId, modelToUse);
      if (!modelConfig) {
        throw new Error(`Model configuration not found for ${modelToUse}`);
      }
  
      // Get user settings for this model
      const userSettings = await this.getUserModelSettings(platformId, modelToUse);
  
      // Start with model defaults
      const params = {
        maxTokens: modelConfig.maxTokens || 4000,
        temperature: modelConfig.temperature || 0.7,
        topP: modelConfig.topP || 1.0,
        parameterStyle: modelConfig.parameterStyle || 'standard',
        tokenParameter: modelConfig.tokenParameter || 'max_tokens',
        contextWindow: modelConfig.contextWindow || 8192,
        supportsTemperature: modelConfig.supportsTemperature !== false,
        supportsTopP: modelConfig.supportsTopP !== false,
        model: modelToUse // Add the resolved model to params
      };
  
      // Override with user settings if provided
      if (userSettings.maxTokens !== undefined) params.maxTokens = userSettings.maxTokens;
      if (userSettings.contextWindow !== undefined) params.contextWindow = userSettings.contextWindow;
      if (userSettings.temperature !== undefined && params.supportsTemperature) params.temperature = userSettings.temperature;
      if (userSettings.topP !== undefined && params.supportsTopP) params.topP = userSettings.topP;
  
      // Add system prompt if provided
      if (userSettings.systemPrompt !== undefined) params.systemPrompt = userSettings.systemPrompt;
  
      logger.info(`Resolved parameters for ${platformId}/${modelToUse}:`, params);
      return params;
    } catch (error) {
      logger.error('Error resolving parameters:', error);
  
      // Return reasonable defaults if resolution fails
      return {
        maxTokens: 4000,
        temperature: 0.7,
        topP: 1.0,
        parameterStyle: 'standard',
        tokenParameter: 'max_tokens',
        supportsTemperature: true,
        supportsTopP: true,
        model: modelOverride || await this.resolveModel(platformId, options)
      };
    }
  }
}

module.exports = new ModelParameterService();

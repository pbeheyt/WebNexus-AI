// src/services/ModelParameterService.js
const TokenCalculationService = require('./TokenCalculationService');
const { STORAGE_KEYS } = require('../shared/constants');

/**
 * Service for managing model-specific parameters
 */
class ModelParameterService {
  constructor() {
    this.cachedConfig = null;
    // Remove hardcoded keys, use constants instead
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
  async getModelConfig(platformId, modelIdOrObject) {
    const config = await this.loadPlatformConfig();

    if (!config?.aiPlatforms?.[platformId]?.api?.models) return null;

    // Normalize input - handle both string IDs and model objects
    const modelId = typeof modelIdOrObject === 'object' && modelIdOrObject !== null
      ? modelIdOrObject.id || modelIdOrObject.model || String(modelIdOrObject)
      : modelIdOrObject;

    console.log(`[ModelParameterService] Resolving model config for: ${platformId}/${modelId}`);

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
      const result = await chrome.storage.sync.get(STORAGE_KEYS.API_ADVANCED_SETTINGS);
      const advancedSettings = result[STORAGE_KEYS.API_ADVANCED_SETTINGS] || {};

      // Get platform settings
      const platformSettings = advancedSettings[platformId] || {};

      // First try model-specific settings, then fall back to default settings
      const modelSettings =
        (platformSettings.models && platformSettings.models[modelId]) ||
        platformSettings.default ||
        {};

      console.log(`[ModelParameterService] Settings for ${platformId}/${modelId}:`, modelSettings);

      return modelSettings;
    } catch (error) {
      console.error('Error getting user model settings:', error);
      return {};
    }
  }

  /**
   * Get sidebar-selected model if available
   * @param {string} platformId - Platform ID
   * @returns {Promise<string|null>} Selected model or null
   */
  async getSidebarModelSelection(platformId) {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.SIDEBAR_MODEL);
      const modelPreferences = result[STORAGE_KEYS.SIDEBAR_MODEL] || {};

      // Check if a model is selected for this platform
      if (modelPreferences[platformId]) {
        const selectedModel = modelPreferences[platformId];
        console.log(`[ModelParameterService] Found sidebar model selection for ${platformId}: ${selectedModel}`);
        return selectedModel;
      }

      return null;
    } catch (error) {
      console.error('Error getting sidebar model selection:', error);
      return null;
    }
  }

  /**
   * Determine which model to use based on all available sources
   * @param {string} platformId - Platform ID
   * @param {number} [tabId] - Optional tab ID for tab-specific preferences
   * @returns {Promise<string>} Model ID to use
   */
  async determineModelToUse(platformId, tabId = null) {
    // Priority order - updated:
    // 1. Tab-specific model (if tabId provided)
    // 2. Sidebar-selected model (if available)
    // 3. User settings from advanced settings
    // 4. Default model from platform config

    // Check for tab-specific model if tabId provided
    if (tabId) {
      try {
        const tabModelPreferences = await chrome.storage.local.get(STORAGE_KEYS.TAB_MODEL_PREFERENCES);
        const tabModelPrefs = tabModelPreferences[STORAGE_KEYS.TAB_MODEL_PREFERENCES] || {};
        const tabPlatformModels = tabModelPrefs[tabId] || {};

        if (tabPlatformModels[platformId]) {
          console.log(`[ModelParameterService] Using tab-specific model for tab ${tabId}: ${tabPlatformModels[platformId]}`);
          return tabPlatformModels[platformId];
        }
      } catch (error) {
        console.error('Error getting tab-specific model:', error);
      }
    }

    // Check for sidebar selection
    const sidebarModel = await this.getSidebarModelSelection(platformId);
    if (sidebarModel) {
      console.log(`[ModelParameterService] Using sidebar-selected model: ${sidebarModel}`);
      return sidebarModel;
    }

    // Try to get user settings
    const userSettings = await this.getUserModelSettings(platformId, null);
    if (userSettings.model) {
      console.log(`[ModelParameterService] Using model from user settings: ${userSettings.model}`);
      return userSettings.model;
    }

    // Fall back to default model from platform config
    const config = await this.loadPlatformConfig();
    const defaultModel = config?.aiPlatforms?.[platformId]?.api?.defaultModel;

    if (defaultModel) {
      console.log(`[ModelParameterService] Using default model from config: ${defaultModel}`);
      return defaultModel;
    }

    // Fallback to hardcoded defaults
    const defaults = {
      'chatgpt': 'gpt-4o',
      'claude': 'claude-3-7-sonnet-latest',
      'gemini': 'gemini-1.5-flash',
      'mistral': 'mistral-large-latest',
      'deepseek': 'deepseek-chat',
      'grok': 'grok-2-1212'
    };

    console.log(`[ModelParameterService] Using fallback default model: ${defaults[platformId] || 'gpt-4o'}`);
    return defaults[platformId] || 'gpt-4o';
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
      const result = await chrome.storage.sync.get(STORAGE_KEYS.API_ADVANCED_SETTINGS);
      const advancedSettings = result[STORAGE_KEYS.API_ADVANCED_SETTINGS] || {};

      // Ensure platform settings exist
      if (!advancedSettings[platformId]) {
        advancedSettings[platformId] = {
          default: {},
          models: {}
        };
      }

      // Ensure models object exists
      if (!advancedSettings[platformId].models) {
        advancedSettings[platformId].models = {};
      }

      // Update model settings
      advancedSettings[platformId].models[modelId] = settings;

      // Save back to storage
      await chrome.storage.sync.set({ [STORAGE_KEYS.API_ADVANCED_SETTINGS]: advancedSettings });

      return true;
    } catch (error) {
      console.error('Error saving user model settings:', error);
      return false;
    }
  }

  /**
   * Save default settings for a platform
   * @param {string} platformId - Platform ID
   * @param {Object} settings - Default settings to save
   * @returns {Promise<boolean>} Success indicator
   */
  async saveDefaultSettings(platformId, settings) {
    try {
      // Get existing settings
      const result = await chrome.storage.sync.get(STORAGE_KEYS.API_ADVANCED_SETTINGS);
      const advancedSettings = result[STORAGE_KEYS.API_ADVANCED_SETTINGS] || {};

      // Ensure platform settings exist
      if (!advancedSettings[platformId]) {
        advancedSettings[platformId] = {
          default: {},
          models: {}
        };
      }

      // Update default settings
      advancedSettings[platformId].default = settings;

      // Save back to storage
      await chrome.storage.sync.set({ [STORAGE_KEYS.API_ADVANCED_SETTINGS]: advancedSettings });

      return true;
    } catch (error) {
      console.error('Error saving default settings:', error);
      return false;
    }
  }

  /**
   * Resolve parameters for a specific model, combining defaults and user settings
   * @param {string} platformId - Platform ID
   * @param {string} prompt - The prompt to send (for token calculations)
   * @returns {Promise<Object>} Resolved parameters
   */
  async resolveParameters(platformId, modelToUse, prompt) {
    try {
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

      console.log(`[ModelParameterService] Resolved parameters for ${platformId}/${modelToUse}:`, params);

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
        supportsTopP: true,
        model: await this.determineModelToUse(platformId) // Use determined model even in error case
      };
    }
  }

  /**
   * Clear model settings for a specific model
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID
   * @returns {Promise<boolean>} Success indicator
   */
  async clearModelSettings(platformId, modelId) {
    try {
      // Get existing settings
      const result = await chrome.storage.sync.get(STORAGE_KEYS.API_ADVANCED_SETTINGS);
      const advancedSettings = result[STORAGE_KEYS.API_ADVANCED_SETTINGS] || {};

      // Check if platform and model settings exist
      if (
        advancedSettings[platformId] &&
        advancedSettings[platformId].models &&
        advancedSettings[platformId].models[modelId]
      ) {
        // Remove model settings
        delete advancedSettings[platformId].models[modelId];

        // Save back to storage
        await chrome.storage.sync.set({ [STORAGE_KEYS.API_ADVANCED_SETTINGS]: advancedSettings });
      }

      return true;
    } catch (error) {
      console.error('Error clearing model settings:', error);
      return false;
    }
  }
}

module.exports = new ModelParameterService();
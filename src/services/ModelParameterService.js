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

    // Find model in array of objects
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

      logger.info(`User settings retrieved for ${platformId}/${modelId}:`, modelSettings);

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
    // Only save for sidebar, popup uses last selected via settings or default
    if (source !== INTERFACE_SOURCES.SIDEBAR) {
        logger.warn(`Not saving model preference for non-sidebar source: ${source}`);
        return false;
    }

    try {
      const storageKey = STORAGE_KEYS.SIDEBAR_MODEL;

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
   * @param {string} prompt - The prompt to send (for token calculations) - *Parameter Removed*
   * @param {Object} options - Additional options
   * @param {number} [options.tabId] - Tab ID for tab-specific preferences
   * @param {string} [options.source] - Interface source (popup or sidebar)
   * @param {Array} [options.conversationHistory] - Optional conversation history for context
   * @returns {Promise<Object>} Resolved parameters object for API calls
   */
  async resolveParameters(platformId, modelOverride, options = {}) { // Removed prompt parameter
    try {
      const { tabId, source, conversationHistory } = options; // Added conversationHistory
      logger.info(`Resolving parameters for ${platformId}, Source: ${source || 'N/A'}, Tab: ${tabId || 'N/A'}`);

      // Determine model to use
      const modelToUse = modelOverride || await this.resolveModel(platformId, { tabId, source });
      logger.info(`Model to use: ${modelToUse}`);

      // Get the full platform config first
      const config = await this.loadPlatformConfig();
      const platformConfig = config?.aiPlatforms?.[platformId];
      if (!platformConfig) {
        throw new Error(`Platform configuration not found for ${platformId}`);
      }
      const platformApiConfig = platformConfig.api; // Get the platform's API config

      // Get model config from platform config for the resolved model
      const modelConfig = platformApiConfig?.models?.find(model => model.id === modelToUse);
      if (!modelConfig) {
        throw new Error(`Model configuration not found for ${modelToUse}`);
      }

      // Get user settings for this model
      const userSettings = await this.getUserModelSettings(platformId, modelToUse);

      // Determine effective toggle values, defaulting to true if not set
      const effectiveIncludeTemperature = userSettings.includeTemperature ?? true;
      const effectiveIncludeTopP = userSettings.includeTopP ?? false; // Changed default to false

      // Start with base parameters
      const params = {
        model: modelToUse, // Always include the model
        parameterStyle: modelConfig.parameterStyle || 'standard',
        tokenParameter: modelConfig.tokenParameter || 'max_tokens',
        maxTokens: userSettings.maxTokens !== undefined ? userSettings.maxTokens : (modelConfig.maxTokens || 4000),
        contextWindow: modelConfig.contextWindow || 8192, // Mostly for internal use, not sent to API
        modelSupportsSystemPrompt: modelConfig?.supportsSystemPrompt ?? false, // Add the new flag here
      };

      // Add temperature ONLY if model supports it AND user included it
      const modelSupportsTemperature = modelConfig?.supportsTemperature !== false;
      if (modelSupportsTemperature && effectiveIncludeTemperature) {
        // Prioritize user setting, then platform default
        params.temperature = userSettings.temperature !== undefined
          ? userSettings.temperature
          : (platformApiConfig?.temperature !== undefined ? platformApiConfig.temperature : 0.7); // Final fallback
      }

      // Add topP ONLY if model supports it AND user included it
      const modelSupportsTopP = modelConfig?.supportsTopP === true; // Explicitly check for true
      if (modelSupportsTopP && effectiveIncludeTopP) {
        // Prioritize user setting, then platform default
        params.topP = userSettings.topP !== undefined
          ? userSettings.topP
          : (platformApiConfig?.topP !== undefined ? platformApiConfig.topP : 1.0); // Final fallback
      }

      // Add system prompt ONLY if platform supports it, model supports it, AND user provided one
      const platformSupportsSystemPrompt = platformApiConfig?.hasSystemPrompt !== false; // Keep this check
      // Replace the old modelSupportsSystemPrompt check with the one from params
      if (platformSupportsSystemPrompt && params.modelSupportsSystemPrompt === true && userSettings.systemPrompt) {
          params.systemPrompt = userSettings.systemPrompt;
      }

      // Add conversation history if provided in options
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        params.conversationHistory = conversationHistory;
      }

      // Include tabId if provided (useful for downstream token tracking)
      if (tabId) {
          params.tabId = tabId;
      }

      logger.info(`FINAL Resolved parameters for ${platformId}/${modelToUse}:`, { ...params }); 
      return params;

    } catch (error) {
      logger.error('Error resolving parameters:', error);

      // Minimal fallback - should be improved if possible
      const fallbackConfig = await this.loadPlatformConfig().catch(() => null);
      const fallbackPlatformApiConfig = fallbackConfig?.aiPlatforms?.[platformId]?.api;
      const finalFallbackModel = modelOverride || await this.resolveModel(platformId, options);

      return {
        model: finalFallbackModel,
        maxTokens: 4000,
        temperature: fallbackPlatformApiConfig?.temperature !== undefined ? fallbackPlatformApiConfig.temperature : 0.7, // Default include temp
        topP: fallbackPlatformApiConfig?.topP !== undefined ? fallbackPlatformApiConfig.topP : 1.0, // Default include topP
        parameterStyle: 'standard',
        tokenParameter: 'max_tokens',
      };
    }
  }
}

module.exports = new ModelParameterService();

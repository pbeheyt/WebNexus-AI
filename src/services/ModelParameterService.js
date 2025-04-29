// src/services/ModelParameterService.js
const { STORAGE_KEYS, INTERFACE_SOURCES } = require('../shared/constants');
const logger = require('../shared/logger.js').service;

const ConfigService = require('./ConfigService');

/**
 * Service for managing model-specific parameters
 */
class ModelParameterService {
  constructor() {
    this.cachedConfig = null;
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
        const tabPrefs = await chrome.storage.local.get(
          STORAGE_KEYS.TAB_MODEL_PREFERENCES
        );
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
          logger.info(
            `Using ${source} model preference for ${platformId}: ${modelId}`
          );
          return modelId;
        }
      } catch (error) {
        logger.error(`Error getting ${source} model preference:`, error);
      }
    }
  }

  /**
   * Get model configuration for a specific model
   * @param {string} platformId - Platform ID
   * @param {string} modelIdOrObject - Model ID or object containing model ID
   * @returns {Promise<Object|null>} Model configuration or null if not found
   */
  async getModelConfig(platformId, modelIdOrObject) {
    const config = await ConfigService.getApiConfig();

    // Access models directly under the platform ID in the API config
    if (!config?.aiPlatforms?.[platformId]?.models) return null;

    // Normalize input - handle both string IDs and model objects
    const modelId =
      typeof modelIdOrObject === 'object' && modelIdOrObject !== null
        ? modelIdOrObject.id || modelIdOrObject.model || String(modelIdOrObject)
        : modelIdOrObject;

    logger.info(`Resolving model config for: ${platformId}/${modelId}`);

    const platformApiConfig = config.aiPlatforms[platformId];

    // Find model in array of objects within the API config
    return (
      platformApiConfig.models.find((model) => model.id === modelId) || null
    );
  }

  /**
   * Get user-defined model settings
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID
   * @returns {Promise<Object>} User settings for the model
   */
  async getUserModelSettings(platformId, modelId) {
    try {
      const result = await chrome.storage.sync.get(
        STORAGE_KEYS.API_ADVANCED_SETTINGS
      );
      const advancedSettings = result[STORAGE_KEYS.API_ADVANCED_SETTINGS] || {};

      // Get platform settings
      const platformSettings = advancedSettings[platformId] || {};

      // First try model-specific settings, then fall back to default settings
      const modelSettings =
        (platformSettings.models && platformSettings.models[modelId]) ||
        platformSettings.default ||
        {};

      logger.info(
        `User settings retrieved for ${platformId}/${modelId}:`,
        modelSettings
      );

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
      const tabPrefs = await chrome.storage.local.get(
        STORAGE_KEYS.TAB_MODEL_PREFERENCES
      );
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
      });

      logger.info(
        `Saved tab model preference: Tab ${tabId}, Platform ${platformId}, Model ${modelId}`
      );
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
      logger.warn(
        `Not saving model preference for non-sidebar source: ${source}`
      );
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

      logger.info(
        `Saved ${source} model preference: Platform ${platformId}, Model ${modelId}`
      );
      return true;
    } catch (error) {
      logger.error(`Error saving ${source} model preference:`, error);
      return false;
    }
  }

  /**
   * Resolve parameters for a specific model, combining defaults and user settings
   * @param {string} platformId - Platform ID
   * @param {string} modelId - The specific model ID to use.
   * @param {Object} options - Additional options
   * @param {number} [options.tabId] - Tab ID for context (e.g., token tracking)
   * @param {string} [options.source] - Interface source (popup or sidebar)
   * @param {Array} [options.conversationHistory] - Optional conversation history for context
   * @returns {Promise<Object>} Resolved parameters object for API calls
   */
  async resolveParameters(platformId, modelId, options = {}) {
    // Add immediate check for modelId
    if (!modelId) {
      throw new Error('Model ID must be provided to resolveParameters');
    }

    try {
      const { tabId, source, conversationHistory } = options;
      logger.info(
        `Resolving parameters for ${platformId}/${modelId}, Source: ${source || 'N/A'}, Tab: ${tabId || 'N/A'}`
      );

      // Get the full platform config first
      const config = await ConfigService.getApiConfig();
      const platformApiConfig = config?.aiPlatforms?.[platformId];
      if (!platformApiConfig) {
        throw new Error(
          `Platform API configuration not found for ${platformId}`
        );
      }

      // Get model config directly from the platform's API config
      const modelConfig = platformApiConfig?.models?.find(
        (model) => model.id === modelId
      );
      if (!modelConfig) {
        throw new Error(`Model configuration not found for ${modelId}`);
      }

      // Get user settings for this model using the provided modelId
      const userSettings = await this.getUserModelSettings(platformId, modelId);

      // Determine effective toggle values, defaulting to true if not set
      const effectiveIncludeTemperature =
        userSettings.includeTemperature ?? true;
      const effectiveIncludeTopP = userSettings.includeTopP ?? false; // TopP default to false

      // Start with base parameters
      const params = {
        model: modelId,
        parameterStyle: modelConfig.parameterStyle,
        tokenParameter: modelConfig.tokenParameter,
        maxTokens:
          userSettings.maxTokens !== undefined
            ? userSettings.maxTokens
            : modelConfig.maxTokens,
        contextWindow: modelConfig.contextWindow,
        modelSupportsSystemPrompt: modelConfig?.supportsSystemPrompt ?? false,
      };

      // Add temperature ONLY if model supports it AND user included it
      const modelSupportsTemperature =
        modelConfig?.supportsTemperature !== false;
      if (modelSupportsTemperature && effectiveIncludeTemperature) {
        params.temperature =
          userSettings.temperature !== undefined
            ? userSettings.temperature
            : platformApiConfig.temperature;
      }

      // Add topP ONLY if model supports it AND user included it
      const modelSupportsTopP = modelConfig?.supportsTopP === true;
      if (modelSupportsTopP && effectiveIncludeTopP) {
        params.topP =
          userSettings.topP !== undefined
            ? userSettings.topP
            : platformApiConfig.topP;
      }

      // Calculate effective system prompt support
      const platformSupportsSystemPrompt =
        platformApiConfig?.hasSystemPrompt !== false;
      const modelExplicitlyForbidsSystemPrompt =
        modelConfig?.supportsSystemPrompt === false;
      const effectiveModelSupportsSystemPrompt =
        platformSupportsSystemPrompt && !modelExplicitlyForbidsSystemPrompt;

      // Update modelSupportsSystemPrompt with the calculated value
      params.modelSupportsSystemPrompt = effectiveModelSupportsSystemPrompt;

      // Add system prompt ONLY if effectively supported AND user provided one
      if (params.modelSupportsSystemPrompt && userSettings.systemPrompt) {
        params.systemPrompt = userSettings.systemPrompt;
        logger.info(`Adding system prompt for ${platformId}/${modelId}.`);
      } else if (userSettings.systemPrompt) {
        if (!platformSupportsSystemPrompt) {
          logger.warn(
            `System prompt provided but platform ${platformId} does not support it.`
          );
        } else if (modelExplicitlyForbidsSystemPrompt) {
          logger.warn(
            `System prompt provided but model ${modelId} explicitly forbids it.`
          );
        } else {
          logger.warn(
            `System prompt provided but effective support is false for ${platformId}/${modelId}.`
          );
        }
      }

      // Add conversation history if provided in options
      if (
        conversationHistory &&
        Array.isArray(conversationHistory) &&
        conversationHistory.length > 0
      ) {
        params.conversationHistory = conversationHistory;
      }

      // Include tabId if provided (useful for downstream token tracking)
      if (tabId) {
        params.tabId = tabId;
      }

      logger.info(`FINAL Resolved parameters for ${platformId}/${modelId}:`, {
        ...params,
      });
      return params;
    } catch (error) {
      logger.error(
        `Error resolving parameters for ${platformId}/${modelId}:`,
        error
      );
      throw error;
    }
  }
}

module.exports = new ModelParameterService();

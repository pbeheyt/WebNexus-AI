// src/services/ModelParameterService.js
import { STORAGE_KEYS, INTERFACE_SOURCES } from '../shared/constants.js';
import { logger } from '../shared/logger.js';

import ConfigService from './ConfigService.js';

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
          logger.service.info(`Using tab-specific model for ${platformId}: ${modelId}`);
          return modelId;
        }
      } catch (error) {
        logger.service.error('Error getting tab-specific model:', error);
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
          logger.service.info(
            `Using ${source} model preference for ${platformId}: ${modelId}`
          );
          return modelId;
        }
      } catch (error) {
        logger.service.error(`Error getting ${source} model preference:`, error);
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

    logger.service.info(`Resolving model config for: ${platformId}/${modelId}`);

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
      const result = await chrome.storage.local.get(
        STORAGE_KEYS.API_MODEL_PARAMETERS
      );
      const advancedSettings = result[STORAGE_KEYS.API_MODEL_PARAMETERS] || {};

      // Get platform settings
      const platformSettings = advancedSettings[platformId] || {};

      // First try model-specific settings, then fall back to default settings
      const modelSettings =
        (platformSettings.models && platformSettings.models[modelId]) ||
        platformSettings.default ||
        {};

      logger.service.info(
        `User settings retrieved for ${platformId}/${modelId}:`,
        modelSettings
      );

      return modelSettings;
    } catch (error) {
      logger.service.error('Error getting user model settings:', error);
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

      logger.service.info(
        `Saved tab model preference: Tab ${tabId}, Platform ${platformId}, Model ${modelId}`
      );
      return true;
    } catch (error) {
      logger.service.error('Error saving tab model preference:', error);
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
      logger.service.warn(
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

      logger.service.info(
        `Saved ${source} model preference: Platform ${platformId}, Model ${modelId}`
      );
      return true;
    } catch (error) {
      logger.service.error(`Error saving ${source} model preference:`, error);
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
    const { tabId, source, conversationHistory, useThinkingMode } = options;
    if (!modelId) {
      throw new Error('Model ID must be provided to resolveParameters');
    }

    try {
        logger.service.info(
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

      // Determine mode key based on Thinking Mode toggle
      const modeKey = useThinkingMode && modelConfig?.thinking?.toggleable ? 'thinking' : 'base';
        logger.service.info(`Resolving parameters using mode: ${modeKey}`);


      // Get user settings for this model using the provided modelId
      const advancedSettingsResult = await chrome.storage.local.get(STORAGE_KEYS.API_MODEL_PARAMETERS);
      const allAdvancedSettings = advancedSettingsResult[STORAGE_KEYS.API_MODEL_PARAMETERS] || {};
      const platformSettings = allAdvancedSettings[platformId] || {}; // Get settings for the specific platform

      // Get the mode-specific settings
      const modelModeSettings = platformSettings.models?.[modelId]?.[modeKey] || {};

      // Use only model-specific settings (no platform defaults)
      const userSettings = { ...modelModeSettings };
      logger.service.info(`User settings retrieved for ${platformId}/${modelId} (mode: ${modeKey}):`, userSettings);

      // Determine effective toggle values, defaulting to true if not set
      const effectiveIncludeTemperature =
        userSettings.includeTemperature ?? true;
      const effectiveIncludeTopP = userSettings.includeTopP ?? false; // TopP default to false

      // Start with base parameters
      const params = {
        model: modelId,
        tokenParameter: modelConfig.tokens.parameterName,
        maxTokens:
          userSettings.maxTokens !== undefined
            ? userSettings.maxTokens
            : (modeKey === 'thinking' && modelConfig.thinking?.maxOutput !== undefined)
              ? modelConfig.thinking.maxOutput
              : modelConfig.tokens.maxOutput,
        contextWindow: modelConfig.tokens.contextWindow,
        modelSupportsSystemPrompt: modelConfig?.capabilities?.supportsSystemPrompt ?? false,
      };

      // Conditionally add modelType if it exists in the config
      if (modelConfig?.modelType) {
        params.modelType = modelConfig.modelType;
      }

      // Determine if thinking mode overrides parameter support
      let thinkingOverridesTemperature = false;
      let thinkingOverridesTopP = false;

      if (modeKey === 'thinking' && modelConfig?.thinking) {
          logger.service.info(`Checking Thinking Mode parameter overrides for ${platformId}/${modelId}`);
          if (modelConfig.thinking.supportsTemperature === false) {
              thinkingOverridesTemperature = true;
              logger.service.info(`Thinking mode explicitly disables Temperature for ${modelId}.`);
          }
          if (modelConfig.thinking.supportsTopP === false) {
              thinkingOverridesTopP = true;
              logger.service.info(`Thinking mode explicitly disables TopP for ${modelId}.`);
          }
      }

      // Add temperature ONLY if model supports it AND user included it AND thinking mode doesn't override it
      const modelSupportsTemperature =
        modelConfig?.capabilities?.supportsTemperature !== false;
      if (modelSupportsTemperature && effectiveIncludeTemperature && !thinkingOverridesTemperature) {
        params.temperature =
          userSettings.temperature !== undefined
            ? userSettings.temperature
            : platformApiConfig.temperature.default;
      } else if (thinkingOverridesTemperature && effectiveIncludeTemperature) {
        logger.service.warn(`Temperature included by user but overridden by thinking mode for ${modelId}.`);
      }

      // Add topP ONLY if model supports it AND user included it AND thinking mode doesn't override it
      const modelSupportsTopP = modelConfig?.capabilities?.supportsTopP === true;
      if (modelSupportsTopP && effectiveIncludeTopP && !thinkingOverridesTopP) {
        params.topP =
          userSettings.topP !== undefined
            ? userSettings.topP
            : platformApiConfig.topP.default;
      } else if (thinkingOverridesTopP && effectiveIncludeTopP) {
        logger.service.warn(`TopP included by user but overridden by thinking mode for ${modelId}.`);
      }

      // Add thinking budget if model supports it, thinking is available, AND (it's not toggleable OR thinking is enabled for this request)
      if (modelConfig?.thinking?.budget && modelConfig?.thinking?.available === true && (!modelConfig?.thinking?.toggleable || params.isThinkingEnabledForRequest)) {
        const userBudget = userSettings.thinkingBudget;
        const budgetValue = userBudget !== undefined 
          ? userBudget 
          : modelConfig.thinking.budget.default;
        params.thinkingBudget = budgetValue;
        logger.service.info(`Resolved thinking budget: ${budgetValue}`);
      }

      // Add reasoning effort if model supports it, thinking is available, AND (it's not toggleable OR thinking is enabled for this request)
      if (modelConfig?.thinking?.reasoningEffort && modelConfig?.thinking?.available === true && (!modelConfig?.thinking?.toggleable || params.isThinkingEnabledForRequest)) {
        const userEffort = userSettings.reasoningEffort;
        if (userEffort !== undefined && userEffort !== null) {
          params.reasoningEffort = userEffort;
          logger.service.info(`Resolved reasoning effort: ${userEffort}`);
        }
      }

      // Calculate effective system prompt support
      const platformSupportsSystemPrompt =
        platformApiConfig?.apiStructure?.supportsSystemPrompt !== false;
      const modelExplicitlyForbidsSystemPrompt =
        modelConfig?.capabilities?.supportsSystemPrompt === false;
      const effectiveModelSupportsSystemPrompt =
        platformSupportsSystemPrompt && !modelExplicitlyForbidsSystemPrompt;

      // Update modelSupportsSystemPrompt with the calculated value
      params.modelSupportsSystemPrompt = effectiveModelSupportsSystemPrompt;

      // Add system prompt ONLY if effectively supported AND user provided one
      if (params.modelSupportsSystemPrompt && userSettings.systemPrompt) {
        params.systemPrompt = userSettings.systemPrompt;
        logger.service.info(`Adding system prompt for ${platformId}/${modelId}.`);
      } else if (userSettings.systemPrompt) {
        if (!platformSupportsSystemPrompt) {
          logger.service.warn(
            `System prompt provided but platform ${platformId} does not support it.`
          );
        } else if (modelExplicitlyForbidsSystemPrompt) {
          logger.service.warn(
            `System prompt provided but model ${modelId} explicitly forbids it.`
          );
        } else {
          logger.service.warn(
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

      // Set thinking mode flag if enabled and available for this model
      // Add thinking budget if in thinking mode and model supports it
    if (modeKey === 'thinking' && modelConfig?.thinking?.budget) {
      const userBudget = userSettings.thinkingBudget;
      // Use user setting if defined, otherwise use default from config, ensure it's not undefined/null before assigning
      const budgetValue = userBudget !== undefined && userBudget !== null
        ? userBudget
        : modelConfig.thinking.budget.default;

      // Add to params only if budgetValue is a valid number (including 0)
      if (typeof budgetValue === 'number') {
          params.thinkingBudget = budgetValue;
          logger.service.info(`Resolved thinking budget: ${budgetValue}`);
      } else {
           logger.service.warn(`Could not resolve a valid thinking budget for ${platformId}/${modelId}. UserSetting: ${userBudget}, Default: ${modelConfig.thinking.budget.default}`);
           // Optionally set to null or don't add the key if resolution fails
           // params.thinkingBudget = null;
      }
    } else if (modeKey === 'thinking') {
        logger.service.info(`Thinking mode active for ${platformId}/${modelId}, but model config does not specify a budget.`);
    }

    // Add reasoning effort if model supports it
    if (modelConfig?.thinking?.reasoningEffort) {
      const userEffort = userSettings.reasoningEffort;
      // Use user setting if defined and valid, otherwise use default from config
      const allowedValues = modelConfig.thinking.reasoningEffort.allowedValues || [];
      const defaultValue = modelConfig.thinking.reasoningEffort.default;

      if (userEffort !== undefined && userEffort !== null && allowedValues.includes(userEffort)) {
          params.reasoningEffort = userEffort;
          logger.service.info(`Resolved reasoning effort from user settings: ${userEffort}`);
      } else if (defaultValue !== undefined && defaultValue !== null && allowedValues.includes(defaultValue)) {
          params.reasoningEffort = defaultValue;
          logger.service.info(`Resolved reasoning effort from model default: ${defaultValue}`);
          if (userEffort !== undefined && userEffort !== null) {
              logger.service.warn(`User reasoning effort '${userEffort}' is invalid, falling back to default '${defaultValue}'. Allowed: ${allowedValues.join(', ')}`);
          }
      } else {
          logger.service.warn(`Could not resolve a valid reasoning effort for ${platformId}/${modelId}. UserSetting: ${userEffort}, Default: ${defaultValue}, Allowed: ${allowedValues.join(', ')}`);
          // Do not add the key if resolution fails
      }
    }

    params.isThinkingEnabledForRequest = useThinkingMode && modelConfig?.thinking?.available === true;

      return params;
    } catch (error) {
      logger.service.error(
        `Error resolving parameters for ${platformId}/${modelId}:`,
        error
      );
      throw error;
    }
  }
}

export default new ModelParameterService();

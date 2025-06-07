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
   * @param {string} [options.source] - Interface source (popup or sidepanel)
   * @returns {Promise<string>} Resolved model ID
   */
  async resolveModel(platformId, options = {}) {
    const { source } = options;
    let modelId = null;

    // Try source-specific global preference (Sidepanel only)
    if (source === INTERFACE_SOURCES.SIDEPANEL) {
      const storageKey = STORAGE_KEYS.SIDEPANEL_DEFAULT_MODEL_ID_BY_PLATFORM;

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
        logger.service.error(
          `Error getting ${source} model preference:`,
          error
        );
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
        STORAGE_KEYS.MODEL_PARAMETER_SETTINGS
      );
      const modelParameterSettingsData =
        result[STORAGE_KEYS.MODEL_PARAMETER_SETTINGS] || {};

      // Get platform model parameters
      const platformModelParameters =
        modelParameterSettingsData[platformId] || {};

      // First try model-specific settings, then fall back to default settings
      const modelSettings =
        (platformModelParameters.models &&
          platformModelParameters.models[modelId]) ||
        platformModelParameters.default ||
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
   * Save global model preference for a source
   * @param {string} source - Interface source (popup or sidepanel)
   * @param {string} platformId - Platform ID
   * @param {string} modelId - Model ID to save
   * @returns {Promise<boolean>} Success indicator
   */
  async saveSourceModelPreference(source, platformId, modelId) {
    // Only save for sidepanel, popup uses last selected via settings or default
    if (source !== INTERFACE_SOURCES.SIDEPANEL) {
      logger.service.warn(
        `Not saving model preference for non-sidepanel source: ${source}`
      );
      return false;
    }

    try {
      const storageKey = STORAGE_KEYS.SIDEPANEL_DEFAULT_MODEL_ID_BY_PLATFORM;

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
   * @param {string} [options.source] - Interface source (popup or sidepanel)
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
        `Resolving parameters for ${platformId}/${modelId}, Source: ${source || 'N/A'}, Tab: ${tabId || 'N/A'}, useThinkingMode: ${!!useThinkingMode}`
      );

      const config = await ConfigService.getApiConfig();
      const platformApiConfig = config?.aiPlatforms?.[platformId];
      if (!platformApiConfig) {
        throw new Error(
          `Platform API configuration not found for ${platformId}`
        );
      }

      const modelConfig = platformApiConfig?.models?.find(
        (model) => model.id === modelId
      );
      if (!modelConfig) {
        throw new Error(`Model configuration not found for ${modelId}`);
      }

      // Explicitly get thinking capability flags from modelConfig
      const modelHasThinkingAvailable =
        modelConfig?.thinking?.available === true;
      const modelThinkingIsUserToggleable =
        modelConfig?.thinking?.toggleable === true;

      // This flag determines if API-level thinking features (like budget/effort) should be activated
      // because the user *explicitly enabled a toggleable thinking mode*.
      // If thinking is available but not toggleable, its parameters from config are part of base defaults.
      const isThinkingEnabledForThisRequest =
        modelHasThinkingAvailable &&
        modelThinkingIsUserToggleable &&
        useThinkingMode;

      // This key determines which set of user preferences to load ('base' or 'thinking').
      // It's 'thinking' only if the model has thinking available, it's user-toggleable, AND the user has it enabled.
      let modeKey = 'base';
      if (isThinkingEnabledForThisRequest) {
        modeKey = 'thinking';
      }

      logger.service.info(
        `Resolving parameters for ${platformId}/${modelId}. ` +
          `Config: thinking.available=${modelHasThinkingAvailable}, thinking.toggleable=${modelThinkingIsUserToggleable}. ` +
          `User choice (useThinkingMode): ${!!useThinkingMode}. ` +
          `Result: API thinking features active for this request=${isThinkingEnabledForThisRequest}, User preferences loaded from modeKey='${modeKey}'.`
      );

      const modelParametersResult = await chrome.storage.local.get(
        STORAGE_KEYS.MODEL_PARAMETER_SETTINGS
      );
      const allModelParameterSettings =
        modelParametersResult[STORAGE_KEYS.MODEL_PARAMETER_SETTINGS] || {};
      const platformModelParameters =
        allModelParameterSettings[platformId] || {};
      const userModelModeSettings =
        platformModelParameters.models?.[modelId]?.[modeKey] || {};
      logger.service.info(
        `User settings retrieved for ${platformId}/${modelId} (modeKey: ${modeKey}):`,
        userModelModeSettings
      );

      const effectiveIncludeTemperature =
        userModelModeSettings.includeTemperature ?? true;
      const effectiveIncludeTopP = userModelModeSettings.includeTopP ?? false;

      const params = {
        model: modelId,
        tokenParameter: modelConfig.tokens.parameterName,
        maxTokens:
          userModelModeSettings.maxTokens !== undefined
            ? userModelModeSettings.maxTokens
            : modeKey === 'thinking' &&
                modelConfig.thinking?.maxOutput !== undefined
              ? modelConfig.thinking.maxOutput
              : modelConfig.tokens.maxOutput,
        contextWindow: modelConfig.tokens.contextWindow,
        modelSupportsSystemPrompt:
          modelConfig?.capabilities?.supportsSystemPrompt ?? false, // Initial assumption
        isThinkingEnabledForRequest: isThinkingEnabledForThisRequest, // Store the determined flag
      };

      if (modelConfig?.modelType) {
        params.modelType = modelConfig.modelType;
      }

      let thinkingOverridesTemperature = false;
      let thinkingOverridesTopP = false;

      if (isThinkingEnabledForThisRequest && modelConfig?.thinking) {
        logger.service.info(
          `Checking Thinking Mode parameter overrides for ${platformId}/${modelId}`
        );
        if (modelConfig.thinking.supportsTemperature === false) {
          thinkingOverridesTemperature = true;
          logger.service.info(
            `Thinking mode explicitly disables Temperature for ${modelId}.`
          );
        }
        if (modelConfig.thinking.supportsTopP === false) {
          thinkingOverridesTopP = true;
          logger.service.info(
            `Thinking mode explicitly disables TopP for ${modelId}.`
          );
        }
      }

      const modelGenerallySupportsTemperature =
        modelConfig?.capabilities?.supportsTemperature !== false;
      if (
        modelGenerallySupportsTemperature &&
        effectiveIncludeTemperature &&
        !thinkingOverridesTemperature
      ) {
        params.temperature =
          userModelModeSettings.temperature !== undefined
            ? userModelModeSettings.temperature
            : platformApiConfig.temperature.default;
      } else if (
        effectiveIncludeTemperature &&
        (thinkingOverridesTemperature || !modelGenerallySupportsTemperature)
      ) {
        logger.service.info(
          `Temperature not applied for ${modelId}: modelSupports=${modelGenerallySupportsTemperature}, userIncluded=${effectiveIncludeTemperature}, thinkingOverride=${thinkingOverridesTemperature}`
        );
      }

      const modelGenerallySupportsTopP =
        modelConfig?.capabilities?.supportsTopP === true;
      if (
        modelGenerallySupportsTopP &&
        effectiveIncludeTopP &&
        !thinkingOverridesTopP
      ) {
        params.topP =
          userModelModeSettings.topP !== undefined
            ? userModelModeSettings.topP
            : platformApiConfig.topP.default;
      } else if (
        effectiveIncludeTopP &&
        (thinkingOverridesTopP || !modelGenerallySupportsTopP)
      ) {
        logger.service.info(
          `TopP not applied for ${modelId}: modelSupports=${modelGenerallySupportsTopP}, userIncluded=${effectiveIncludeTopP}, thinkingOverride=${thinkingOverridesTopP}`
        );
      }

      // Add thinking budget if thinking is enabled for this request and the model has budget config
      if (isThinkingEnabledForThisRequest && modelConfig?.thinking?.budget) {
        const userBudget = userModelModeSettings.thinkingBudget;
        const budgetValue =
          userBudget !== undefined
            ? userBudget
            : modelConfig.thinking.budget.default;
        params.thinkingBudget = budgetValue;
        logger.service.info(`Resolved thinking budget: ${budgetValue}`);
      } else if (
        useThinkingMode &&
        modelHasThinkingAvailable &&
        !modelConfig?.thinking?.budget
      ) {
        logger.service.info(
          `Thinking mode requested for ${platformId}/${modelId}, but model has no budget configuration.`
        );
      }

      // Add reasoning effort if thinking is enabled for this request and the model has reasoningEffort config
      if (
        isThinkingEnabledForThisRequest &&
        modelConfig?.thinking?.reasoningEffort
      ) {
        const userEffort = userModelModeSettings.reasoningEffort;
        // Use userEffort if defined, otherwise fallback to model's default reasoning effort
        const effortValue =
          userEffort !== undefined
            ? userEffort
            : modelConfig.thinking.reasoningEffort.default;

        if (effortValue !== undefined && effortValue !== null) {
          // Validate against allowedValues if they exist
          const allowedValues =
            modelConfig.thinking.reasoningEffort.allowedValues;
          if (
            Array.isArray(allowedValues) &&
            allowedValues.length > 0 &&
            !allowedValues.includes(effortValue)
          ) {
            logger.service.warn(
              `User/default reasoningEffort "${effortValue}" for ${modelId} is not in allowedValues. Using model's default: ${modelConfig.thinking.reasoningEffort.default}`
            );
            params.reasoningEffort =
              modelConfig.thinking.reasoningEffort.default;
          } else {
            params.reasoningEffort = effortValue;
            logger.service.info(`Resolved reasoning effort: ${effortValue}`);
          }
        }
      } else if (
        useThinkingMode &&
        modelHasThinkingAvailable &&
        !modelConfig?.thinking?.reasoningEffort
      ) {
        logger.service.info(
          `Thinking mode requested for ${platformId}/${modelId}, but model has no reasoningEffort configuration.`
        );
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
      if (
        params.modelSupportsSystemPrompt &&
        userModelModeSettings.systemPrompt
      ) {
        params.systemPrompt = userModelModeSettings.systemPrompt;
        logger.service.info(
          `Adding system prompt for ${platformId}/${modelId}.`
        );
      } else if (userModelModeSettings.systemPrompt) {
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

      // Include tabId if provided
      if (tabId) {
        params.tabId = tabId;
      }

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
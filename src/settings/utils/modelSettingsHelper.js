// src/settings/utils/modelSettingsHelper.js
import { logger } from '../../shared/logger';
import { MAX_SYSTEM_PROMPT_LENGTH } from '../../shared/constants';

/**
 * Derives comprehensive model settings including resolved configuration, defaults,
 * display specifications, parameter constraints, and capabilities.
 *
 * @param {object} params - The parameters object.
 * @param {object} params.platformApiConfig - The `apiConfig` object for the current platform.
 * @param {string} params.modelId - The ID of the currently selected model.
 * @param {string} params.editingMode - The current editing mode ('base' or 'thinking').
 * @param {Array<object>} params.modelsFromPlatform - The array of model configurations from platformApiConfig.models.
 * @returns {object|null} A comprehensive object with derived settings, or null if modelId is invalid.
 */
export function getDerivedModelSettings({
  platformApiConfig,
  modelId,
  editingMode,
  modelsFromPlatform,
}) {
  if (!platformApiConfig || !modelsFromPlatform || !modelId) {
    logger.settings.error(
      'getDerivedModelSettings: Missing critical parameters.',
      { platformApiConfig, modelId, editingMode, modelsFromPlatform }
    );
    return null;
  }

  const baseModelConfig = modelsFromPlatform.find((m) => m.id === modelId);

  if (!baseModelConfig) {
    logger.settings.warn(
      `getDerivedModelSettings: No base configuration found for modelId: ${modelId}`
    );
    return null;
  }

  let resolvedModelConfig = { ...baseModelConfig };
  let currentPricing = { ...baseModelConfig.pricing };
  let currentTokens = { ...baseModelConfig.tokens };
  let currentCapabilities = { ...baseModelConfig.capabilities };
  let currentThinkingConfig = baseModelConfig.thinking
    ? { ...baseModelConfig.thinking }
    : null;

  // Apply thinking mode overrides if applicable
  if (editingMode === 'thinking' && currentThinkingConfig?.available) {
    currentPricing = {
      ...currentPricing,
      ...(currentThinkingConfig.pricing || {}),
    };
    currentTokens = {
      ...currentTokens,
      maxOutput:
        currentThinkingConfig.maxOutput !== undefined
          ? currentThinkingConfig.maxOutput
          : currentTokens.maxOutput,
      contextWindow:
        currentThinkingConfig.contextWindow !== undefined
          ? currentThinkingConfig.contextWindow
          : currentTokens.contextWindow,
    };
    currentCapabilities = {
      ...currentCapabilities,
      supportsTemperature:
        currentThinkingConfig.supportsTemperature !== undefined
          ? currentThinkingConfig.supportsTemperature
          : currentCapabilities.supportsTemperature,
      supportsTopP:
        currentThinkingConfig.supportsTopP !== undefined
          ? currentThinkingConfig.supportsTopP
          : currentCapabilities.supportsTopP,
      // System prompt support is usually not overridden by thinking mode, but can be if needed
      supportsSystemPrompt:
        currentThinkingConfig.supportsSystemPrompt !== undefined
          ? currentThinkingConfig.supportsSystemPrompt
          : currentCapabilities.supportsSystemPrompt,
    };
    // Update resolvedModelConfig with these thinking-mode specific values
    resolvedModelConfig.pricing = currentPricing;
    resolvedModelConfig.tokens = currentTokens;
    resolvedModelConfig.capabilities = currentCapabilities;
    // Ensure the 'thinking' part of resolvedModelConfig reflects the active thinking config
    resolvedModelConfig.thinking = currentThinkingConfig;
  } else if (editingMode === 'base') {
    // Ensure resolvedModelConfig uses base thinking details if not in 'thinking' mode
    // or if thinking is not available/toggleable for this model.
    // This is important if the model *has* a thinking block but it's not currently active.
    resolvedModelConfig.thinking = baseModelConfig.thinking;
  }


  // --- Calculate Default Settings ---
  const defaultSettings = {
    maxTokens: currentTokens.maxOutput,
    contextWindow: currentTokens.contextWindow, // This is informational, not directly a form field
    systemPrompt: '', // Always default to empty
    includeTemperature: true, // Default to true if temperature is supported
    includeTopP: false, // Default to false if topP is supported
    thinkingBudget: currentThinkingConfig?.budget?.default ?? null,
    reasoningEffort: currentThinkingConfig?.reasoningEffort?.default ?? null,
  };

  if (currentCapabilities.supportsTemperature !== false) {
    defaultSettings.temperature = platformApiConfig.temperature.default;
  } else {
    // If not supported, ensure includeTemperature is false and temp is not set
    defaultSettings.includeTemperature = false;
    delete defaultSettings.temperature;
  }

  if (currentCapabilities.supportsTopP === true) {
    defaultSettings.topP = platformApiConfig.topP.default;
  } else {
    // If not supported, ensure includeTopP is false and topP is not set
    defaultSettings.includeTopP = false;
    delete defaultSettings.topP;
  }

  // --- Derive Display Specs ---
  const displaySpecs = {
    contextWindow: currentTokens.contextWindow,
    inputPrice: currentPricing.inputTokenPrice,
    outputPrice: currentPricing.outputTokenPrice,
    maxOutputTokens: currentTokens.maxOutput,
  };

  // --- Derive Parameter Specs (for sliders, inputs) ---
  const parameterSpecs = {
    maxTokens: {
      min: 1,
      max: currentTokens.maxOutput,
      step: 1,
      parameterName: currentTokens.parameterName,
    },
    temperature: currentCapabilities.supportsTemperature !== false ? {
      min: platformApiConfig.temperature.min,
      max: platformApiConfig.temperature.max,
      step: 0.01,
    } : null,
    topP: currentCapabilities.supportsTopP === true ? {
      min: platformApiConfig.topP.min,
      max: platformApiConfig.topP.max,
      step: 0.01,
    } : null,
    systemPrompt: platformApiConfig.apiStructure?.supportsSystemPrompt !== false && currentCapabilities.supportsSystemPrompt !== false ? {
      maxLength: MAX_SYSTEM_PROMPT_LENGTH,
    } : null,
    thinkingBudget: currentThinkingConfig?.budget ? {
      min: currentThinkingConfig.budget.min,
      max: currentThinkingConfig.budget.max,
      default: currentThinkingConfig.budget.default,
      step: 1, // Assuming integer steps for budget
    } : null,
    reasoningEffort: currentThinkingConfig?.reasoningEffort ? {
        allowedValues: currentThinkingConfig.reasoningEffort.allowedValues,
        default: currentThinkingConfig.reasoningEffort.default,
    } : null,
  };

  return {
    resolvedModelConfig, // The model config after applying mode-specific overrides
    defaultSettings,     // Default values for form fields
    displaySpecs,        // Specs for UI display (pricing, context window)
    parameterSpecs,      // Constraints for form inputs (min/max/step)
    capabilities: currentCapabilities, // Effective capabilities for the current model/mode
  };
}

/**
 * Checks if the current form values are at the default settings for the model and mode.
 * @param {object} formValues - The current form values.
 * @param {object} defaultSettings - The default settings derived by getDerivedModelSettings.
 * @param {object} capabilities - The capabilities derived by getDerivedModelSettings.
 * @param {object} platformApiConfig - The platform's API configuration.
 * @returns {boolean} True if form values match defaults, false otherwise.
 */
export function checkAreFormValuesAtDefaults(formValues, defaultSettings, capabilities, platformApiConfig) {
  if (!formValues || !defaultSettings || !capabilities || !platformApiConfig) return true;

  if (formValues.maxTokens !== defaultSettings.maxTokens) return false;

  if (capabilities.supportsTemperature !== false) {
    if (formValues.temperature !== defaultSettings.temperature) return false;
    if (formValues.includeTemperature !== (defaultSettings.includeTemperature ?? true)) return false;
  }

  if (capabilities.supportsTopP === true) {
    if (formValues.topP !== defaultSettings.topP) return false;
    if (formValues.includeTopP !== (defaultSettings.includeTopP ?? false)) return false;
  }

  if (platformApiConfig.apiStructure?.supportsSystemPrompt !== false && capabilities.supportsSystemPrompt !== false) {
    if ((formValues.systemPrompt || '').trim() !== (defaultSettings.systemPrompt || '').trim()) return false;
  }
  
  // Check thinkingBudget only if it's part of defaultSettings (meaning model supports it)
  if (defaultSettings.thinkingBudget !== null && defaultSettings.thinkingBudget !== undefined) {
    if (formValues.thinkingBudget !== defaultSettings.thinkingBudget) return false;
  }

  // Check reasoningEffort only if it's part of defaultSettings
  if (defaultSettings.reasoningEffort !== null && defaultSettings.reasoningEffort !== undefined) {
     if (formValues.reasoningEffort !== defaultSettings.reasoningEffort) return false;
  }

  return true;
}

/**
 * Checks if there are any meaningful changes between current and original form values.
 * @param {object} currentValues - The current form values.
 * @param {object} originalValues - The original form values.
 * @returns {boolean} True if there are changes, false otherwise.
 */
export function checkForFormChanges(currentValues, originalValues) {
  if (!currentValues || !originalValues) return false;

  for (const key in currentValues) {
    if (key === 'contextWindow') continue; // contextWindow is informational

    const currentValue = currentValues[key];
    const originalValue = originalValues[key];

    if (currentValue === undefined && originalValue === undefined) continue;
    if (currentValue === null && originalValue === null) continue;

    if (typeof currentValue === 'string') {
      if (currentValue.trim() !== (originalValue || '').trim()) return true;
    } else if (typeof currentValue === 'number') {
      if (!Object.is(currentValue, originalValue)) return true;
    } else if (typeof currentValue === 'boolean') {
      if (currentValue !== originalValue) return true;
    } else if (currentValue !== originalValue) { // Fallback for other types, though less common
      return true;
    }
  }
  return false;
}

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
      `getDerivedModelSettings: No base configuration found for modelId: ${modelId} on platform ${platformApiConfig?.id || 'Unknown'}`
    );
    return null;
  }

  let resolvedModelConfig = { ...baseModelConfig }; // Start with a shallow copy
  // Deep copy nested objects that will be modified
  resolvedModelConfig.pricing = { ...(baseModelConfig.pricing || {}) };
  resolvedModelConfig.tokens = { ...(baseModelConfig.tokens || {}) };
  resolvedModelConfig.capabilities = { ...(baseModelConfig.capabilities || {}) };
  resolvedModelConfig.thinking = baseModelConfig.thinking ? { ...baseModelConfig.thinking } : null;


  // Apply thinking mode overrides if applicable
  if (editingMode === 'thinking' && resolvedModelConfig.thinking?.available) {
    const thinkingConfig = resolvedModelConfig.thinking;

    resolvedModelConfig.pricing = {
      ...resolvedModelConfig.pricing,
      ...(thinkingConfig.pricing || {}),
    };
    resolvedModelConfig.tokens.maxOutput =
        thinkingConfig.maxOutput !== undefined
          ? thinkingConfig.maxOutput
          : resolvedModelConfig.tokens.maxOutput;
    // contextWindow is typically not overridden by thinking mode, but can be if needed:
    // resolvedModelConfig.tokens.contextWindow = thinkingConfig.contextWindow ?? resolvedModelConfig.tokens.contextWindow;

    resolvedModelConfig.capabilities.supportsTemperature =
        thinkingConfig.supportsTemperature !== undefined
          ? thinkingConfig.supportsTemperature
          : resolvedModelConfig.capabilities.supportsTemperature;
    resolvedModelConfig.capabilities.supportsTopP =
        thinkingConfig.supportsTopP !== undefined
          ? thinkingConfig.supportsTopP
          : resolvedModelConfig.capabilities.supportsTopP;
    resolvedModelConfig.capabilities.supportsSystemPrompt =
        thinkingConfig.supportsSystemPrompt !== undefined
          ? thinkingConfig.supportsSystemPrompt
          : resolvedModelConfig.capabilities.supportsSystemPrompt;
  }
  // currentTokens, currentPricing, currentCapabilities are now effectively resolvedModelConfig.tokens etc.


  // --- Calculate Default Settings (based on resolvedModelConfig) ---
  const defaultSettings = {
    maxTokens: resolvedModelConfig.tokens.maxOutput,
    contextWindow: resolvedModelConfig.tokens.contextWindow, // Informational
    systemPrompt: '', // Always default to empty for user input
    includeTemperature: true, // Default to true if temperature is supported by model & platform
    includeTopP: false, // Default to false
    thinkingBudget: resolvedModelConfig.thinking?.budget?.default ?? null,
    reasoningEffort: resolvedModelConfig.thinking?.reasoningEffort?.default ?? null,
  };

  if (resolvedModelConfig.capabilities.supportsTemperature !== false && platformApiConfig.temperature) {
    defaultSettings.temperature = platformApiConfig.temperature.default;
  } else {
    defaultSettings.includeTemperature = false;
    // delete defaultSettings.temperature; // No need to delete, just won't be used if includeTemperature is false
  }

  if (resolvedModelConfig.capabilities.supportsTopP === true && platformApiConfig.topP) {
    defaultSettings.topP = platformApiConfig.topP.default;
  } else {
    defaultSettings.includeTopP = false;
    // delete defaultSettings.topP;
  }


  // --- Derive Display Specs ---
  const displaySpecs = {
    contextWindow: resolvedModelConfig.tokens.contextWindow,
    inputPrice: resolvedModelConfig.pricing.inputTokenPrice,
    outputPrice: resolvedModelConfig.pricing.outputTokenPrice,
    maxOutputTokens: resolvedModelConfig.tokens.maxOutput,
  };

  // --- Derive Parameter Specs (for sliders, inputs) ---
  const parameterSpecs = {
    maxTokens: {
      min: 1, // Or a more sensible minimum like 16, or from config if available
      max: resolvedModelConfig.tokens.maxOutput,
      step: 1,
      parameterName: resolvedModelConfig.tokens.parameterName,
    },
    temperature: (resolvedModelConfig.capabilities.supportsTemperature !== false && platformApiConfig.temperature) ? {
      min: platformApiConfig.temperature.min,
      max: platformApiConfig.temperature.max,
      step: 0.01, // Or from config if available
    } : null,
    topP: (resolvedModelConfig.capabilities.supportsTopP === true && platformApiConfig.topP) ? {
      min: platformApiConfig.topP.min,
      max: platformApiConfig.topP.max,
      step: 0.01, // Or from config if available
    } : null,
    systemPrompt: (platformApiConfig.apiStructure?.supportsSystemPrompt !== false && resolvedModelConfig.capabilities.supportsSystemPrompt !== false) ? {
      maxLength: MAX_SYSTEM_PROMPT_LENGTH,
    } : null,
    thinkingBudget: resolvedModelConfig.thinking?.budget ? {
      min: resolvedModelConfig.thinking.budget.min,
      max: resolvedModelConfig.thinking.budget.max,
      default: resolvedModelConfig.thinking.budget.default,
      step: resolvedModelConfig.thinking.budget.step || 1,
    } : null,
    reasoningEffort: resolvedModelConfig.thinking?.reasoningEffort ? {
        allowedValues: resolvedModelConfig.thinking.reasoningEffort.allowedValues,
        default: resolvedModelConfig.thinking.reasoningEffort.default,
    } : null,
  };

  return {
    resolvedModelConfig, // The model config after applying mode-specific overrides
    defaultSettings,     // Default values for form fields (config-derived, not user-saved)
    displaySpecs,        // Specs for UI display (pricing, context window)
    parameterSpecs,      // Constraints for form inputs (min/max/step)
    capabilities: resolvedModelConfig.capabilities, // Effective capabilities for the current model/mode
  };
}

/**
 * Checks if the current form values are at the default settings for the model and mode.
 * @param {object} formValues - The current form values.
 * @param {object} configDefaults - The default settings derived purely from config by getDerivedModelSettings.
 * @param {object} capabilities - The capabilities derived by getDerivedModelSettings.
 * @param {object} platformApiConfig - The platform's API configuration (for platform-level defaults if needed).
 * @returns {boolean} True if form values match config-derived defaults, false otherwise.
 */
export function checkAreFormValuesAtDefaults(formValues, configDefaults, capabilities, platformApiConfig) {
  if (!formValues || !configDefaults || !capabilities || !platformApiConfig) return true; // Or false, depending on desired strictness

  // Check maxTokens
  if (formValues.maxTokens !== configDefaults.maxTokens) return false;

  // Check temperature settings
  if (capabilities.supportsTemperature !== false) {
    if (formValues.temperature !== configDefaults.temperature) return false;
    if (formValues.includeTemperature !== (configDefaults.includeTemperature ?? true)) return false;
  } else {
    // If temp not supported, includeTemperature should ideally be false in formValues if at defaults
    if (formValues.includeTemperature !== false) return false;
  }

  // Check topP settings
  if (capabilities.supportsTopP === true) {
    if (formValues.topP !== configDefaults.topP) return false;
    if (formValues.includeTopP !== (configDefaults.includeTopP ?? false)) return false;
  } else {
     // If topP not supported, includeTopP should ideally be false
    if (formValues.includeTopP !== false) return false;
  }

  // Check systemPrompt
  if (platformApiConfig.apiStructure?.supportsSystemPrompt !== false && capabilities.supportsSystemPrompt !== false) {
    if ((formValues.systemPrompt || '').trim() !== (configDefaults.systemPrompt || '').trim()) return false;
  } else {
    // If system prompt not supported, it should be empty if at defaults
    if ((formValues.systemPrompt || '').trim() !== '') return false;
  }
  
  // Check thinkingBudget
  if (configDefaults.thinkingBudget !== null && configDefaults.thinkingBudget !== undefined) { // Check if model supports it via configDefaults
    if (formValues.thinkingBudget !== configDefaults.thinkingBudget) return false;
  } else {
    // If not supported by model (i.e., configDefaults.thinkingBudget is null/undefined),
    // formValue should also be null/undefined or match if it was explicitly set to a non-default null.
    if (formValues.thinkingBudget !== null && formValues.thinkingBudget !== undefined) return false;
  }


  // Check reasoningEffort
  if (configDefaults.reasoningEffort !== null && configDefaults.reasoningEffort !== undefined) {
     if (formValues.reasoningEffort !== configDefaults.reasoningEffort) return false;
  } else {
    if (formValues.reasoningEffort !== null && formValues.reasoningEffort !== undefined) return false;
  }

  return true;
}

/**
 * Checks if there are any meaningful changes between current and original form values.
 * Original values are typically what was last saved or initially loaded (config defaults + user overrides).
 * @param {object} currentValues - The current form values.
 * @param {object} originalValues - The original form values to compare against.
 * @returns {boolean} True if there are changes, false otherwise.
 */
export function checkForFormChanges(currentValues, originalValues) {
  if (!currentValues || !originalValues) return false; // Or true if one is null and other is not

  const keys = new Set([...Object.keys(currentValues), ...Object.keys(originalValues)]);

  for (const key of keys) {
    if (key === 'contextWindow') continue; // contextWindow is informational, not a user setting

    const currentValue = currentValues[key];
    const originalValue = originalValues[key];

    // Handle cases where a key might exist in one but not the other,
    // especially for booleans (includeTemperature/TopP) which might default if not present.
    // A robust check considers effective values. For simplicity here, direct comparison.
    // For booleans, treat undefined/null as potentially different from explicit true/false.
    if (typeof currentValue === 'boolean' || typeof originalValue === 'boolean') {
        if (currentValue !== originalValue) return true;
        continue;
    }
    
    if (currentValue === undefined && originalValue === undefined) continue;
    if (currentValue === null && originalValue === null) continue;
    // If one is null/undefined and other is not (and not boolean already handled)
    if ((currentValue == null && originalValue != null) || (currentValue != null && originalValue == null)) return true;


    if (typeof currentValue === 'string') {
      if (currentValue.trim() !== (originalValue || '').trim()) return true;
    } else if (typeof currentValue === 'number') {
      // Use Object.is for precise comparison, handles NaN correctly (though unlikely here)
      // Also handles 0 vs -0 if that were a concern.
      // For simple numeric fields, direct inequality is fine.
      if (!Object.is(currentValue, originalValue)) return true;
    } else if (currentValue !== originalValue) { 
      // Fallback for other types or if one is defined and the other isn't (after null/undefined checks)
      return true;
    }
  }
  return false;
}
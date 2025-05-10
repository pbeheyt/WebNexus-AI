// src/shared/utils/importValidationUtils.js
import { CONTENT_TYPES, AI_PLATFORMS, MAX_PROMPT_NAME_LENGTH, MAX_PROMPT_CONTENT_LENGTH, MAX_SYSTEM_PROMPT_LENGTH } from '../constants';
import ConfigService from '../../services/ConfigService';

export function validateCredentialsData(data) {
  if (typeof data !== 'object' || data === null) {
    return { isValid: false, error: 'Credentials data must be an object.' };
  }

  const knownPlatformIds = Object.values(AI_PLATFORMS);

  for (const platformId in data) {
    if (Object.prototype.hasOwnProperty.call(data, platformId)) {
      if (!knownPlatformIds.includes(platformId)) {
        return { isValid: false, error: `Invalid platform ID "${platformId}" found in credentials data. Supported platforms are: ${knownPlatformIds.join(', ')}.` };
      }
      const platformCreds = data[platformId];
      if (typeof platformCreds !== 'object' || platformCreds === null) {
        return { isValid: false, error: `Credentials for platform "${platformId}" must be an object.` };
      }
      if (typeof platformCreds.apiKey !== 'string' || platformCreds.apiKey.trim() === '') {
        return { isValid: false, error: `API key for platform "${platformId}" must be a non-empty string.` };
      }
    }
  }
  return { isValid: true };
}

export async function validateModelParametersSettingsData(data) {
  let apiConfig;
  try {
    apiConfig = await ConfigService.getApiConfig();
    if (!apiConfig || !apiConfig.aiPlatforms) {
      return { isValid: false, error: 'Failed to load or parse API configuration for validation.' };
    }
  } catch (e) {
    return { isValid: false, error: `Error loading API configuration: ${e.message}` };
  }

  if (typeof data !== 'object' || data === null) {
    return { isValid: false, error: 'Model parameters settings data must be an object.' };
  }

  const knownPlatformIds = Object.values(AI_PLATFORMS);

  for (const platformId in data) {
    if (Object.prototype.hasOwnProperty.call(data, platformId)) {
      if (!knownPlatformIds.includes(platformId)) {
        return { isValid: false, error: `Invalid platform ID "${platformId}" found in model parameters data. Supported platforms are: ${knownPlatformIds.join(', ')}.` };
      }
      const platformParams = data[platformId];
      if (typeof platformParams !== 'object' || platformParams === null) {
        return { isValid: false, error: `Parameters for platform "${platformId}" must be an object.` };
      }
      
      // The 'models' key must exist, even if it's an empty object {}
      if (!Object.prototype.hasOwnProperty.call(platformParams, 'models') || typeof platformParams.models !== 'object' || platformParams.models === null) {
         // Allow platform entry to be completely empty if it has no models and no other keys.
         if (Object.keys(platformParams).length === 0 && platformParams.constructor === Object) {
             continue; // Valid empty platform entry
         }
        return { isValid: false, error: `The "models" property for platform "${platformId}" must be an object (can be empty {}).` };
      }
      
      if (platformParams.models) { // Iterate only if models object exists
        for (const modelId in platformParams.models) {
          if (Object.prototype.hasOwnProperty.call(platformParams.models, modelId)) {
            const modelSettings = platformParams.models[modelId];
            if (typeof modelSettings !== 'object' || modelSettings === null) {
              return { isValid: false, error: `Settings for model "${modelId}" on platform "${platformId}" must be an object.` };
            }

            for (const mode of ['base', 'thinking']) {
              if (Object.prototype.hasOwnProperty.call(modelSettings, mode)) {
                const modeSettings = modelSettings[mode];
                if (typeof modeSettings !== 'object' || modeSettings === null) {
                  return { isValid: false, error: `Settings for "${mode}" mode of model "${modelId}" on platform "${platformId}" must be an object.` };
                }

                const platformApiSettings = apiConfig.aiPlatforms[platformId];
                // The existing check for knownPlatformIds already handles if platformApiSettings is undefined.

                const modelApiSettings = platformApiSettings?.models?.find(m => m.id === modelId);
                if (!modelApiSettings) {
                  return { isValid: false, error: `Model ID "${modelId}" not found in current API configuration for platform "${platformId}".` };
                }

                // Determine effective model settings for the current mode (base or thinking)
                let effectiveModelTokensConfig = { ...(modelApiSettings.tokens || {}) };
                let effectiveModelCapabilities = { ...(modelApiSettings.capabilities || {}) };
                let effectiveModelThinkingConfig = modelApiSettings.thinking;

                if (mode === 'thinking' && modelApiSettings.thinking?.available) {
                  if (modelApiSettings.thinking.maxOutput !== undefined) {
                    effectiveModelTokensConfig.maxOutput = modelApiSettings.thinking.maxOutput;
                  }
                  if (modelApiSettings.thinking.supportsTemperature !== undefined) {
                    effectiveModelCapabilities.supportsTemperature = modelApiSettings.thinking.supportsTemperature;
                  }
                  if (modelApiSettings.thinking.supportsTopP !== undefined) {
                    effectiveModelCapabilities.supportsTopP = modelApiSettings.thinking.supportsTopP;
                  }
                }

                // Parameter type and range checks
                for (const paramKey of Object.keys(modeSettings)) {
                  const value = modeSettings[paramKey];

                  switch (paramKey) {
                    case 'maxTokens':
                      if (!(typeof value === 'number' || value === null)) return { isValid: false, error: `maxTokens for ${platformId}/${modelId}/${mode} must be a number or null.` };
                      if (typeof value === 'number') {
                        const minTokens = 1;
                        const maxModelTokens = effectiveModelTokensConfig.maxOutput;
                        if (maxModelTokens === undefined) return { isValid: false, error: `maxOutput configuration missing for ${platformId}/${modelId}/${mode}.`};
                        if (value < minTokens || value > maxModelTokens) {
                          return { isValid: false, error: `maxTokens for ${platformId}/${modelId}/${mode} must be between ${minTokens} and ${maxModelTokens}. Found: ${value}.` };
                        }
                      }
                      break;
                    case 'temperature':
                      if (!(typeof value === 'number' || value === null)) return { isValid: false, error: `temperature for ${platformId}/${modelId}/${mode} must be a number or null.` };
                      if (typeof value === 'number' && modeSettings.includeTemperature === true) {
                        if (effectiveModelCapabilities.supportsTemperature !== false && platformApiSettings.temperature) {
                          if (value < platformApiSettings.temperature.min || value > platformApiSettings.temperature.max) {
                            return { isValid: false, error: `temperature for ${platformId}/${modelId}/${mode} must be between ${platformApiSettings.temperature.min} and ${platformApiSettings.temperature.max}. Found: ${value}.` };
                          }
                        } else if (effectiveModelCapabilities.supportsTemperature === false) {
                          return { isValid: false, error: `temperature is set for ${platformId}/${modelId}/${mode}, but this model/mode does not support it.` };
                        }
                      }
                      break;
                    case 'topP':
                      if (!(typeof value === 'number' || value === null)) return { isValid: false, error: `topP for ${platformId}/${modelId}/${mode} must be a number or null.` };
                      if (typeof value === 'number' && modeSettings.includeTopP === true) {
                        if (effectiveModelCapabilities.supportsTopP === true && platformApiSettings.topP) {
                          if (value < platformApiSettings.topP.min || value > platformApiSettings.topP.max) {
                            return { isValid: false, error: `topP for ${platformId}/${modelId}/${mode} must be between ${platformApiSettings.topP.min} and ${platformApiSettings.topP.max}. Found: ${value}.` };
                          }
                        } else if (effectiveModelCapabilities.supportsTopP === false || !platformApiSettings.topP) {
                          return { isValid: false, error: `topP is set for ${platformId}/${modelId}/${mode}, but this model/mode does not support it or platform has no topP config.` };
                        }
                      }
                      break;
                    case 'thinkingBudget':
                      if (value !== null && value !== undefined) { 
                        if (!effectiveModelThinkingConfig?.budget) {
                          return { isValid: false, error: `thinkingBudget is defined in import for ${platformId}/${modelId}/${mode}, but this model/mode does not support a thinking budget.` };
                        }
                        if (typeof value !== 'number') return { isValid: false, error: `thinkingBudget for ${platformId}/${modelId}/${mode} must be a number.` };
                        if (value < effectiveModelThinkingConfig.budget.min || value > effectiveModelThinkingConfig.budget.max) {
                          return { isValid: false, error: `thinkingBudget for ${platformId}/${modelId}/${mode} must be between ${effectiveModelThinkingConfig.budget.min} and ${effectiveModelThinkingConfig.budget.max}. Found: ${value}.` };
                        }
                      }
                      break;
                    case 'reasoningEffort':
                      if (value !== null && value !== undefined) { 
                        const modelReasoningEffortConfig = effectiveModelThinkingConfig?.reasoningEffort;
                        if (!modelReasoningEffortConfig || !Array.isArray(modelReasoningEffortConfig.allowedValues) || modelReasoningEffortConfig.allowedValues.length === 0) {
                          return { isValid: false, error: `reasoningEffort is defined in import for ${platformId}/${modelId}/${mode}, but this model/mode does not support or has no configured allowed values for reasoning effort.` };
                        }
                        if (typeof value !== 'string') return { isValid: false, error: `reasoningEffort for ${platformId}/${modelId}/${mode} must be a string.` };
                        if (!modelReasoningEffortConfig.allowedValues.includes(value)) {
                          return { isValid: false, error: `Invalid reasoningEffort value "${value}" for ${platformId}/${modelId}/${mode}. Allowed values are: ${modelReasoningEffortConfig.allowedValues.join(', ')}.` };
                        }
                      }
                      break;
                    case 'systemPrompt':
                      if (!(typeof value === 'string' || value === null)) return { isValid: false, error: `systemPrompt for ${platformId}/${modelId}/${mode} must be a string or null.` };
                      if (typeof value === 'string' && value.length > MAX_SYSTEM_PROMPT_LENGTH) {
                        return { isValid: false, error: `systemPrompt for ${platformId}/${modelId}/${mode} exceeds maximum length of ${MAX_SYSTEM_PROMPT_LENGTH} characters.` };
                      }
                      break;
                    case 'includeTemperature':
                    case 'includeTopP':
                      if (typeof value !== 'boolean') return { isValid: false, error: `"${paramKey}" for ${platformId}/${modelId}/${mode} must be a boolean.` };
                      break;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return { isValid: true };
}

export function validatePromptsData(data) {
  if (typeof data !== 'object' || data === null) {
    return { isValid: false, error: 'Prompts data must be an object.' };
  }

  const definedContentTypes = Object.values(CONTENT_TYPES);

  // Check 1: All defined CONTENT_TYPES must be present as keys in the imported prompts data.
  for (const expectedContentType of definedContentTypes) {
    if (!Object.prototype.hasOwnProperty.call(data, expectedContentType)) {
      return { isValid: false, error: `Missing required content type "${expectedContentType}" in prompts data.` };
    }
  }

  // Check 2 & 3: Validate structure of each content type.
  for (const contentTypeKey in data) {
    if (Object.prototype.hasOwnProperty.call(data, contentTypeKey)) {
      // Ensure no unknown content types are present.
      if (!definedContentTypes.includes(contentTypeKey)) {
        return { isValid: false, error: `Invalid content type "${contentTypeKey}" found in prompts data. Supported types are: ${definedContentTypes.join(', ')}.` };
      }

      const typeData = data[contentTypeKey];
      if (typeof typeData !== 'object' || typeData === null) {
        return { isValid: false, error: `Data for content type "${contentTypeKey}" must be an object.` };
      }

      // Collect actual prompt IDs for the current content type
      const actualPromptIdsInType = [];
      for (const key in typeData) {
        if (Object.prototype.hasOwnProperty.call(typeData, key) && key !== '_defaultPromptId_') {
          actualPromptIdsInType.push(key);
        }
      }

      // Each content type must have at least one actual prompt defined.
      if (actualPromptIdsInType.length === 0) {
        return { isValid: false, error: `Content type "${contentTypeKey}" must contain at least one prompt definition.` };
      }

      // Each content type must have a _defaultPromptId_ key.
      if (!Object.prototype.hasOwnProperty.call(typeData, '_defaultPromptId_')) {
        return { isValid: false, error: `Content type "${contentTypeKey}" is missing the required "_defaultPromptId_" key.` };
      }

      const defaultIdValue = typeData['_defaultPromptId_'];
      if (typeof defaultIdValue !== 'string' || defaultIdValue.trim() === '') {
        return { isValid: false, error: `_defaultPromptId_ for content type "${contentTypeKey}" must be a non-empty string.` };
      }

      // The _defaultPromptId_ must correspond to an actual prompt ID within that content type.
      if (!actualPromptIdsInType.includes(defaultIdValue)) {
        return { isValid: false, error: `_defaultPromptId_ "${defaultIdValue}" for content type "${contentTypeKey}" does not match any existing prompt ID in that type.` };
      }

      // Validate individual prompt objects
      for (const promptId of actualPromptIdsInType) {
        const promptObj = typeData[promptId];
        if (typeof promptObj !== 'object' || promptObj === null) {
          return { isValid: false, error: `Prompt "${promptId}" for content type "${contentTypeKey}" must be an object.` };
        }
        if (typeof promptObj.name !== 'string' || promptObj.name.trim() === '') {
          return { isValid: false, error: `Name for prompt "${promptId}" in "${contentTypeKey}" must be a non-empty string (max ${MAX_PROMPT_NAME_LENGTH} chars).` };
        }
        if (promptObj.name.length > MAX_PROMPT_NAME_LENGTH) {
          return { isValid: false, error: `Name for prompt "${promptId}" in "${contentTypeKey}" exceeds ${MAX_PROMPT_NAME_LENGTH} characters.` };
        }
        if (typeof promptObj.content !== 'string' || promptObj.content.trim() === '') {
          return { isValid: false, error: `Content for prompt "${promptId}" in "${contentTypeKey}" must be a non-empty string (max ${MAX_PROMPT_CONTENT_LENGTH} chars).` };
        }
        if (promptObj.content.length > MAX_PROMPT_CONTENT_LENGTH) {
          return { isValid: false, error: `Content for prompt "${promptId}" in "${contentTypeKey}" exceeds ${MAX_PROMPT_CONTENT_LENGTH} characters.` };
        }
        if (typeof promptObj.createdAt !== 'string' || isNaN(new Date(promptObj.createdAt).getTime())) {
          return { isValid: false, error: `createdAt for prompt "${promptId}" in "${contentTypeKey}" must be a valid ISO date string.` };
        }
        if (typeof promptObj.updatedAt !== 'string' || isNaN(new Date(promptObj.updatedAt).getTime())) {
          return { isValid: false, error: `updatedAt for prompt "${promptId}" in "${contentTypeKey}" must be a valid ISO date string.` };
        }
      }
    }
  }
  return { isValid: true };
}

export async function validateAllSettingsData(data) {
  if (typeof data !== 'object' || data === null) {
    return { isValid: false, error: 'AllSettings data bundle must be an object.' };
  }

  const requiredKeys = ['prompts', 'credentials', 'modelParametersSettings'];
  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      return { isValid: false, error: `AllSettings data bundle is missing required key: "${key}".` };
    }
  }

  const promptsValidation = validatePromptsData(data.prompts);
  if (!promptsValidation.isValid) {
    return promptsValidation;
  }

  const credentialsValidation = validateCredentialsData(data.credentials);
  if (!credentialsValidation.isValid) {
    return credentialsValidation;
  }

  const modelParamsValidation = await validateModelParametersSettingsData(data.modelParametersSettings);
  if (!modelParamsValidation.isValid) {
    return modelParamsValidation;
  }

  return { isValid: true };
}

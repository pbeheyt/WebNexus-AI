// src/shared/utils/importValidationUtils.js
import { CONTENT_TYPES, MAX_PROMPT_NAME_LENGTH, MAX_PROMPT_CONTENT_LENGTH } from '../constants';
import { logger } from '../logger';

export function validateCredentialsData(data) {
  if (typeof data !== 'object' || data === null) {
    return { isValid: false, error: 'Credentials data must be an object.' };
  }

  for (const platformId in data) {
    if (Object.prototype.hasOwnProperty.call(data, platformId)) {
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

export function validateModelParametersSettingsData(data) {
  if (typeof data !== 'object' || data === null) {
    return { isValid: false, error: 'Model parameters settings data must be an object.' };
  }

  for (const platformId in data) {
    if (Object.prototype.hasOwnProperty.call(data, platformId)) {
      const platformParams = data[platformId];
      if (typeof platformParams !== 'object' || platformParams === null) {
        return { isValid: false, error: `Parameters for platform "${platformId}" must be an object.` };
      }
      if (typeof platformParams.models !== 'object' || platformParams.models === null) {
        if (Object.keys(platformParams).length > 0) {
          return { isValid: false, error: `The "models" property for platform "${platformId}" must be an object.` };
        }
      }
      
      if (platformParams.models) {
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
                
                const params = ['maxTokens', 'temperature', 'topP', 'systemPrompt', 'includeTemperature', 'includeTopP', 'thinkingBudget', 'reasoningEffort'];
                for (const paramKey of params) {
                  if (Object.prototype.hasOwnProperty.call(modeSettings, paramKey)) {
                    const value = modeSettings[paramKey];
                    switch (paramKey) {
                      case 'maxTokens':
                      case 'thinkingBudget':
                        if (!(typeof value === 'number' || value === null)) return { isValid: false, error: `"${paramKey}" for ${platformId}/${modelId}/${mode} must be a number or null.` };
                        break;
                      case 'temperature':
                      case 'topP':
                        if (!(typeof value === 'number' || value === null)) return { isValid: false, error: `"${paramKey}" for ${platformId}/${modelId}/${mode} must be a number or null.` };
                        break;
                      case 'includeTemperature':
                      case 'includeTopP':
                        if (typeof value !== 'boolean') return { isValid: false, error: `"${paramKey}" for ${platformId}/${modelId}/${mode} must be a boolean.` };
                        break;
                      case 'systemPrompt':
                      case 'reasoningEffort':
                        if (!(typeof value === 'string' || value === null)) return { isValid: false, error: `"${paramKey}" for ${platformId}/${modelId}/${mode} must be a string or null.` };
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
  }
  return { isValid: true };
}

export function validatePromptsData(data) {
  if (typeof data !== 'object' || data === null) {
    return { isValid: false, error: 'Prompts data must be an object.' };
  }

  for (const contentType in data) {
    if (Object.prototype.hasOwnProperty.call(data, contentType)) {
      if (!Object.values(CONTENT_TYPES).includes(contentType)) {
        logger.warn(`Unknown content type "${contentType}" found during prompt import validation.`);
      }
      const typeData = data[contentType];
      if (typeof typeData !== 'object' || typeData === null) {
        return { isValid: false, error: `Data for content type "${contentType}" must be an object.` };
      }

      for (const promptId in typeData) {
        if (Object.prototype.hasOwnProperty.call(typeData, promptId)) {
          if (promptId === '_defaultPromptId_') {
            if (typeof typeData[promptId] !== 'string') {
              return { isValid: false, error: `_defaultPromptId_ for content type "${contentType}" must be a string.` };
            }
            continue;
          }

          const promptObj = typeData[promptId];
          if (typeof promptObj !== 'object' || promptObj === null) {
            return { isValid: false, error: `Prompt "${promptId}" for content type "${contentType}" must be an object.` };
          }
          if (typeof promptObj.name !== 'string' || promptObj.name.trim() === '') {
            return { isValid: false, error: `Name for prompt "${promptId}" in "${contentType}" must be a non-empty string (max ${MAX_PROMPT_NAME_LENGTH} chars).` };
          }
          if (promptObj.name.length > MAX_PROMPT_NAME_LENGTH) {
            return { isValid: false, error: `Name for prompt "${promptId}" in "${contentType}" exceeds ${MAX_PROMPT_NAME_LENGTH} characters.` };
          }
          if (typeof promptObj.content !== 'string' || promptObj.content.trim() === '') {
            return { isValid: false, error: `Content for prompt "${promptId}" in "${contentType}" must be a non-empty string (max ${MAX_PROMPT_CONTENT_LENGTH} chars).` };
          }
          if (promptObj.content.length > MAX_PROMPT_CONTENT_LENGTH) {
            return { isValid: false, error: `Content for prompt "${promptId}" in "${contentType}" exceeds ${MAX_PROMPT_CONTENT_LENGTH} characters.` };
          }
          if (typeof promptObj.createdAt !== 'string' || isNaN(new Date(promptObj.createdAt).getTime())) {
            return { isValid: false, error: `createdAt for prompt "${promptId}" in "${contentType}" must be a valid ISO date string.` };
          }
          if (typeof promptObj.updatedAt !== 'string' || isNaN(new Date(promptObj.updatedAt).getTime())) {
            return { isValid: false, error: `updatedAt for prompt "${promptId}" in "${contentType}" must be a valid ISO date string.` };
          }
        }
      }
    }
  }
  return { isValid: true };
}

export function validateAllSettingsData(data) {
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

  const modelParamsValidation = validateModelParametersSettingsData(data.modelParametersSettings);
  if (!modelParamsValidation.isValid) {
    return modelParamsValidation;
  }

  return { isValid: true };
}

// src/settings/hooks/useModelParametersSettings.js
import { useState, useEffect, useCallback, useMemo } from 'react';

import { logger } from '../../shared/logger';
import {
  getDerivedModelSettings,
  checkAreFormValuesAtDefaults,
  checkForFormChanges,
  getParameterDisplayName,
} from '../utils/modelSettingsHelper';
import { MAX_SYSTEM_PROMPT_LENGTH } from '../../shared/constants';
import { useNotification } from '../../components/feedback/NotificationContext';
import useMinimumLoadingTime from '../../hooks/useMinimumLoadingTime';

export function useModelParametersSettings({
  platform,
  selectedModelId,
  modelParametersForPlatform,
  onSave,
  onReset,
}) {
  const { error: showNotificationError } = useNotification();
  const [currentEditingMode, setCurrentEditingMode] = useState('base');
  const [formValues, setFormValues] = useState({});
  const [originalValues, setOriginalValues] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isAtDefaults, setIsAtDefaults] = useState(true);
  
  const [isSavingActual, setIsSavingActual] = useState(false);
  const [isResettingActual, setIsResettingActual] = useState(false);
  
  const shouldShowSaving = useMinimumLoadingTime(isSavingActual);
  const shouldShowResetting = useMinimumLoadingTime(isResettingActual);

  const [isAnimatingReset, setIsAnimatingReset] = useState(false);
  const [isFormReady, setIsFormReady] = useState(false);

  useEffect(() => {
    setCurrentEditingMode('base');
  }, [selectedModelId]);

  const modelsFromPlatform = useMemo(
    () => platform.apiConfig?.models || [],
    [platform.apiConfig?.models]
  );

  const derivedSettings = useMemo(() => {
    if (!selectedModelId || !modelsFromPlatform.find(m => m.id === selectedModelId)) {
        const firstModelId = modelsFromPlatform.length > 0 ? modelsFromPlatform[0].id : null;
        if (!firstModelId) {
            logger.settings.warn(`useModelParametersSettings: No valid model found for platform ${platform.id}. Cannot derive settings.`);
            return null;
        }
        logger.settings.info(`useModelParametersSettings: selectedModelId '${selectedModelId}' invalid or not found, attempting to use first model '${firstModelId}' for derivation for platform ${platform.id}.`);
         return getDerivedModelSettings({
           platformApiConfig: platform.apiConfig,
           modelId: firstModelId,
           editingMode: currentEditingMode,
           modelsFromPlatform,
         });
    }
    return getDerivedModelSettings({
      platformApiConfig: platform.apiConfig,
      modelId: selectedModelId,
      editingMode: currentEditingMode,
      modelsFromPlatform,
    });
  }, [
    platform.apiConfig,
    platform.id,
    selectedModelId,
    currentEditingMode,
    modelsFromPlatform,
  ]);

  useEffect(() => {
    setIsFormReady(false);
    if (!derivedSettings || !selectedModelId) {
      setFormValues({});
      setOriginalValues({});
      setIsFormReady(true);
      return;
    }

    const { defaultSettings: configDefaults } = derivedSettings;
    let userStoredSettingsForModelMode = {};
    if (modelParametersForPlatform?.models?.[selectedModelId]?.[currentEditingMode]) {
      userStoredSettingsForModelMode = modelParametersForPlatform.models[selectedModelId][currentEditingMode];
    }

    const initialFormValues = {
      maxTokens: userStoredSettingsForModelMode.maxTokens ?? configDefaults.maxTokens,
      temperature: userStoredSettingsForModelMode.temperature ?? configDefaults.temperature,
      topP: userStoredSettingsForModelMode.topP ?? configDefaults.topP,
      systemPrompt: userStoredSettingsForModelMode.systemPrompt ?? configDefaults.systemPrompt,
      includeTemperature: userStoredSettingsForModelMode.includeTemperature ?? configDefaults.includeTemperature,
      includeTopP: userStoredSettingsForModelMode.includeTopP ?? configDefaults.includeTopP,
      thinkingBudget: userStoredSettingsForModelMode.thinkingBudget ?? configDefaults.thinkingBudget,
      reasoningEffort: userStoredSettingsForModelMode.reasoningEffort ?? configDefaults.reasoningEffort,
    };
    
    Object.keys(initialFormValues).forEach(key => {
        if (initialFormValues[key] === undefined && !(key in configDefaults)) {
            if ((key === 'maxTokens' || key === 'thinkingBudget') && initialFormValues[key] == null) initialFormValues[key] = derivedSettings.parameterSpecs?.[key]?.min ?? 0;
            if ((key === 'temperature' || key === 'topP') && initialFormValues[key] == null) initialFormValues[key] = derivedSettings.parameterSpecs?.[key]?.min ?? 0;
            if (key === 'systemPrompt' && initialFormValues[key] == null) initialFormValues[key] = '';
        }
    });

    setFormValues(initialFormValues);
    setOriginalValues({ ...initialFormValues });
    setIsFormReady(true);
  }, [selectedModelId, currentEditingMode, platform.apiConfig, platform.id, modelParametersForPlatform, derivedSettings]);

  useEffect(() => {
    if (!derivedSettings) {
      setHasChanges(false);
      setIsAtDefaults(true);
      return;
    }
    const { defaultSettings: configDefaults, capabilities } = derivedSettings;
    setHasChanges(checkForFormChanges(formValues, originalValues));
    setIsAtDefaults(
      checkAreFormValuesAtDefaults(formValues, configDefaults, capabilities, platform.apiConfig)
    );
  }, [formValues, originalValues, derivedSettings, platform.apiConfig]);

  const handleChange = useCallback(
    (name, newValue) => {
      setFormValues((prevValues) => {
        const updatedValues = { ...prevValues };
        const paramSpec = derivedSettings?.parameterSpecs?.[name];

        if (name === 'maxTokens' || name === 'thinkingBudget') {
          const parsedValue = parseInt(newValue, 10);
          updatedValues[name] = (newValue === '' || newValue === null) ? null : (isNaN(parsedValue) ? prevValues[name] : parsedValue);
        } else if (name === 'temperature' || name === 'topP') {
          const parsedValue = parseFloat(newValue);
           if (paramSpec && !isNaN(parsedValue)) {
            updatedValues[name] = Math.max(paramSpec.min, Math.min(paramSpec.max, parsedValue));
           } else {
            updatedValues[name] = isNaN(parsedValue) ? prevValues[name] : parsedValue;
           }
        } else if (name === 'reasoningEffort') {
          const allowed = paramSpec?.allowedValues ?? [];
          updatedValues[name] = (newValue === '' || newValue === null || !allowed.includes(newValue)) ? null : newValue;
        } else if (name === 'includeTemperature' || name === 'includeTopP') {
          updatedValues[name] = newValue;
        } else {
          updatedValues[name] = newValue;
        }
        return updatedValues;
      });
    },
    [derivedSettings]
  );

  const handleSubmit = useCallback(async (event) => {
    if (event) event.preventDefault();
    if (!derivedSettings || !selectedModelId) {
        showNotificationError('Cannot save: Model configuration not fully loaded.');
        return;
    }
    setIsSavingActual(true);

    const { parameterSpecs, capabilities } = derivedSettings;

    try {
      if (formValues.maxTokens === null || formValues.maxTokens === undefined || isNaN(formValues.maxTokens)) {
        throw new Error('Max Tokens is required and must be a number.');
      }
      if (formValues.maxTokens < parameterSpecs.maxTokens.min || formValues.maxTokens > parameterSpecs.maxTokens.max) {
        throw new Error(`Max tokens must be between ${parameterSpecs.maxTokens.min} and ${parameterSpecs.maxTokens.max}.`);
      }
      if (capabilities.supportsTemperature !== false && formValues.includeTemperature) {
        if (formValues.temperature === null || formValues.temperature === undefined || isNaN(formValues.temperature)) {
          throw new Error('Temperature is required when enabled and must be a number.');
        }
        if (formValues.temperature < parameterSpecs.temperature.min || formValues.temperature > parameterSpecs.temperature.max) {
          throw new Error(`Temperature must be between ${parameterSpecs.temperature.min} and ${parameterSpecs.temperature.max}.`);
        }
      }
      if (capabilities.supportsTopP === true && formValues.includeTopP) {
         if (formValues.topP === null || formValues.topP === undefined || isNaN(formValues.topP)) {
           throw new Error('Top P is required when enabled and must be a number.');
         }
        if (formValues.topP < parameterSpecs.topP.min || formValues.topP > parameterSpecs.topP.max) {
          throw new Error(`Top P must be between ${parameterSpecs.topP.min} and ${parameterSpecs.topP.max}.`);
        }
      }
      if (platform.apiConfig?.apiStructure?.supportsSystemPrompt !== false && capabilities.supportsSystemPrompt !== false && formValues.systemPrompt && formValues.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
        throw new Error(`System Prompt cannot exceed ${MAX_SYSTEM_PROMPT_LENGTH} characters.`);
      }
      if (parameterSpecs.thinkingBudget) {
          if(formValues.thinkingBudget === null || formValues.thinkingBudget === undefined || isNaN(formValues.thinkingBudget)) {
            throw new Error('Thinking Budget is required and must be a number.');
          }
          if (formValues.thinkingBudget < parameterSpecs.thinkingBudget.min || formValues.thinkingBudget > parameterSpecs.thinkingBudget.max) {
            throw new Error(`Thinking Budget must be between ${parameterSpecs.thinkingBudget.min} and ${parameterSpecs.thinkingBudget.max}.`);
          }
      }
      if (parameterSpecs.reasoningEffort) {
          if(formValues.reasoningEffort === null || formValues.reasoningEffort === undefined) {
            throw new Error('Reasoning Effort is required.');
          }
          if (!parameterSpecs.reasoningEffort.allowedValues.includes(formValues.reasoningEffort)) {
            throw new Error(`Reasoning Effort must be one of: ${parameterSpecs.reasoningEffort.allowedValues.join(', ')}.`);
          }
      }

      const settingsToSave = { ...formValues };
      delete settingsToSave.contextWindow;

      // Determine changed parameters for notification
      const changedParamsList = [];
      if (originalValues) {
        for (const key in formValues) {
          if (Object.prototype.hasOwnProperty.call(formValues, key) && key !== 'contextWindow') {
            const currentValue = formValues[key];
            const originalValue = originalValues[key];
            let paramChanged = false;

            if (typeof currentValue === 'boolean') {
              if (currentValue !== originalValue) {
                paramChanged = true;
              }
            } else if (typeof currentValue === 'string') {
              if (currentValue.trim() !== (originalValue || '').trim()) {
                paramChanged = true;
              }
            } else if (typeof currentValue === 'number') {
               // Handle null original values correctly when comparing with numbers
              if (originalValue === null && currentValue !== null) {
                  paramChanged = true;
              } else if (!Object.is(currentValue, originalValue)) {
                  paramChanged = true;
              }
            } else if (currentValue !== originalValue) { // Fallback for other types or null/undefined mismatches
              paramChanged = true;
            }
            
            if (paramChanged) {
              changedParamsList.push(getParameterDisplayName(key));
            }
          }
        }
      }
      // End - Determine changed parameters

      const success = await onSave(platform.id, selectedModelId, currentEditingMode, settingsToSave, changedParamsList);
      if (success) {
        setOriginalValues({ ...formValues });
      }
    } catch (err) {
      logger.settings.error('Error saving model parameters in hook:', err);
      showNotificationError(err.message || 'An unknown error occurred during save.');
    } finally {
      setIsSavingActual(false);
    }
  }, [formValues, originalValues, platform, selectedModelId, currentEditingMode, onSave, derivedSettings, showNotificationError]);

  const handleResetClick = useCallback(async () => {
    if (isAtDefaults || !derivedSettings || !selectedModelId) return;
    setIsResettingActual(true);
    setIsAnimatingReset(true);

    try {
      const success = await onReset(platform.id, selectedModelId, currentEditingMode);
      if (success) {
        const { defaultSettings: configDefaults } = derivedSettings;
        setFormValues({ ...configDefaults });
        setOriginalValues({ ...configDefaults });
      }
    } catch (err) {
        logger.settings.error('Error resetting model parameters in hook:', err);
        showNotificationError('Failed to reset model parameters.');
    } finally {
      setIsResettingActual(false);
      setTimeout(() => setIsAnimatingReset(false), 500); // Animation duration
    }
  }, [isAtDefaults, platform.id, selectedModelId, currentEditingMode, onReset, derivedSettings, showNotificationError]);
  
  const toggleEditingMode = useCallback(() => {
    if (derivedSettings?.resolvedModelConfig?.thinking?.toggleable) {
        setCurrentEditingMode(prev => prev === 'base' ? 'thinking' : 'base');
    }
  }, [derivedSettings]);

  const showThinkingModeToggle = derivedSettings?.resolvedModelConfig?.thinking?.toggleable ?? false;
  const isThinkingModeActive = currentEditingMode === 'thinking';

  const modelSupportsTemp = derivedSettings?.capabilities?.supportsTemperature !== false ?? true;
  const modelSupportsTopP = derivedSettings?.capabilities?.supportsTopP === true ?? false;
  const modelSupportsSystemPrompt = (derivedSettings?.capabilities?.supportsSystemPrompt !== false && platform.apiConfig?.apiStructure?.supportsSystemPrompt !== false) ?? true;

  const thinkingOverridesTemp = isThinkingModeActive && (derivedSettings?.resolvedModelConfig?.thinking?.supportsTemperature === false);
  const thinkingOverridesTopP = isThinkingModeActive && (derivedSettings?.resolvedModelConfig?.thinking?.supportsTopP === false);
  
  const showTempSection = modelSupportsTemp && !thinkingOverridesTemp;
  const showTopPSection = modelSupportsTopP && !thinkingOverridesTopP;
  
  const showBudgetSlider = derivedSettings?.parameterSpecs?.thinkingBudget && derivedSettings?.resolvedModelConfig?.thinking?.available === true && (isThinkingModeActive || !derivedSettings?.resolvedModelConfig?.thinking?.toggleable);
  const showReasoningEffort = derivedSettings?.parameterSpecs?.reasoningEffort && derivedSettings?.resolvedModelConfig?.thinking?.available === true && (isThinkingModeActive || !derivedSettings?.resolvedModelConfig?.thinking?.toggleable);

  return {
    formValues,
    currentEditingMode,
    derivedSettings,
    handleChange,
    handleSubmit,
    handleResetClick,
    toggleEditingMode,
    isSaving: shouldShowSaving, // Use derived state for UI
    isResetting: shouldShowResetting, // Use derived state for UI
    isAnimatingReset,
    hasChanges,
    isAtDefaults,
    showThinkingModeToggle,
    isThinkingModeActive,
    showTempSection,
    showTopPSection,
    showBudgetSlider,
    showReasoningEffort,
    modelSupportsSystemPrompt,
    modelsFromPlatform,
    isFormReady,
  };
}

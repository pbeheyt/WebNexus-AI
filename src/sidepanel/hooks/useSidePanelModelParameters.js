// src/sidepanel/hooks/useSidePanelModelParameters.js
import { useState, useEffect, useCallback, useMemo } from 'react';

import { logger } from '../../shared/logger';
import {
  getDerivedModelSettings,
  checkAreFormValuesAtDefaults,
  checkForFormChanges,
  getParameterDisplayName,
} from '../../settings/utils/model-settings-helper-utils';
import { STORAGE_KEYS, MAX_SYSTEM_PROMPT_LENGTH } from '../../shared/constants';
import { useNotification } from '../../components';
import useMinimumLoadingTime from '../../hooks/useMinimumLoadingTime';

export function useSidePanelModelParameters({
  platform, // Full platform config object
  selectedModelId, // String ID of the selected model
  currentEditingMode, // 'base' or 'thinking'
  modelConfigData, // Full config for the selectedModelId (from SidePanelChatContext)
  onReady, // Callback when hook is ready
}) {
  const { success: showSuccessNotification, error: showNotificationError } =
    useNotification();

  const [formValues, setFormValues] = useState({});
  const [originalValues, setOriginalValues] = useState({});
  const [derivedSettings, setDerivedSettings] = useState(null);

  const [hasChanges, setHasChanges] = useState(false);
  const [isAtDefaults, setIsAtDefaults] = useState(true);
  const [isFormReady, setIsFormReady] = useState(false);

  const [isSavingActual, setIsSavingActual] = useState(false);
  const [isResettingActual, setIsResettingActual] = useState(false);
  const shouldShowSaving = useMinimumLoadingTime(isSavingActual, 750);
  const shouldShowResetting = useMinimumLoadingTime(isResettingActual, 750);
  const [isAnimatingReset, setIsAnimatingReset] = useState(false);

  const modelsFromPlatform = useMemo(
    () => platform?.apiConfig?.models || [],
    [platform?.apiConfig?.models]
  );

  // Effect for initial load and when key dependencies change
  useEffect(() => {
    setIsFormReady(false); // Mark as not ready while recalculating
    if (!platform || !selectedModelId || !currentEditingMode || !modelConfigData) {
      logger.sidepanel.debug(
        'useSidePanelModelParameters: Skipping derived settings calculation due to missing dependencies.', { platformExists: !!platform, selectedModelId, currentEditingMode, modelConfigDataExists: !!modelConfigData }
      );
      setDerivedSettings(null);
      setFormValues({});
      setOriginalValues({});
      // Do not call onReady here as critical data is missing
      return;
    }

    logger.sidepanel.debug(
      `useSidePanelModelParameters: Recalculating derived settings for ${platform.id}/${selectedModelId}, mode: ${currentEditingMode}`
    );

    const newDerivedSettings = getDerivedModelSettings({
      platformIdForLogging: platform.id,
      platformApiConfig: platform.apiConfig,
      modelId: selectedModelId,
      editingMode: currentEditingMode,
      modelsFromPlatform,
    });
    setDerivedSettings(newDerivedSettings);

    if (!newDerivedSettings) {
      setFormValues({});
      setOriginalValues({});
      setIsFormReady(true); // Still mark as ready even if no settings derived (e.g. model not found)
      if (typeof onReady === 'function') onReady();
      return;
    }

    const { defaultSettings: configDefaults } = newDerivedSettings;
    let userStoredSettingsForModelMode = {};

    // Asynchronously load user-stored settings
    const loadUserStoredSettings = async () => {
      try {
        const settingsResult = await chrome.storage.local.get(STORAGE_KEYS.MODEL_PARAMETER_SETTINGS);
        const allModelParameterSettings = settingsResult[STORAGE_KEYS.MODEL_PARAMETER_SETTINGS] || {};
        const platformModelParameters = allModelParameterSettings[platform.id] || {};
        userStoredSettingsForModelMode = platformModelParameters.models?.[selectedModelId]?.[currentEditingMode] || {};
      } catch (err) {
        logger.sidepanel.error("Error loading user stored model parameters:", err);
        // Continue with config defaults if loading fails
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
      
      Object.keys(initialFormValues).forEach((key) => {
        if (initialFormValues[key] === undefined && !(key in configDefaults)) {
            if ((key === 'maxTokens' || key === 'thinkingBudget') && initialFormValues[key] == null) initialFormValues[key] = newDerivedSettings.parameterSpecs?.[key]?.min ?? 0;
            if ((key === 'temperature' || key === 'topP') && initialFormValues[key] == null) initialFormValues[key] = newDerivedSettings.parameterSpecs?.[key]?.min ?? 0;
            if (key === 'systemPrompt' && initialFormValues[key] == null) initialFormValues[key] = '';
        }
      });

      setFormValues(initialFormValues);
      setOriginalValues({ ...initialFormValues });
      setIsFormReady(true);
      if (typeof onReady === 'function') onReady();
    };

    loadUserStoredSettings();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform?.id, platform?.apiConfig, selectedModelId, currentEditingMode, modelConfigData, modelsFromPlatform]);


  // Effect to update hasChanges and isAtDefaults
  useEffect(() => {
    if (!derivedSettings || !isFormReady) {
      setHasChanges(false);
      setIsAtDefaults(true);
      return;
    }
    const { defaultSettings: configDefaults, capabilities } = derivedSettings;
    setHasChanges(checkForFormChanges(formValues, originalValues));
    setIsAtDefaults(
      checkAreFormValuesAtDefaults(
        formValues,
        configDefaults,
        capabilities,
        platform?.apiConfig // Use optional chaining for platform
      )
    );
  }, [formValues, originalValues, derivedSettings, platform?.apiConfig, isFormReady]);

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
    if (!derivedSettings || !selectedModelId || !platform) { // Added !platform check
      showNotificationError('Cannot save: Critical configuration missing.');
      return;
    }
    setIsSavingActual(true);

    const { parameterSpecs, capabilities } = derivedSettings;

    try {
      // Basic Validations
      if (formValues.maxTokens === null || formValues.maxTokens === undefined || isNaN(formValues.maxTokens)) throw new Error('Max Tokens is required and must be a number.');
      if (formValues.maxTokens < parameterSpecs.maxTokens.min || formValues.maxTokens > parameterSpecs.maxTokens.max) throw new Error(`Max tokens must be between ${parameterSpecs.maxTokens.min} and ${parameterSpecs.maxTokens.max}.`);
      if (capabilities.supportsTemperature !== false && formValues.includeTemperature) {
        if (formValues.temperature === null || formValues.temperature === undefined || isNaN(formValues.temperature)) throw new Error('Temperature is required when enabled and must be a number.');
        if (formValues.temperature < parameterSpecs.temperature.min || formValues.temperature > parameterSpecs.temperature.max) throw new Error(`Temperature must be between ${parameterSpecs.temperature.min} and ${parameterSpecs.temperature.max}.`);
      }
      if (capabilities.supportsTopP === true && formValues.includeTopP) {
        if (formValues.topP === null || formValues.topP === undefined || isNaN(formValues.topP)) throw new Error('Top P is required when enabled and must be a number.');
        if (formValues.topP < parameterSpecs.topP.min || formValues.topP > parameterSpecs.topP.max) throw new Error(`Top P must be between ${parameterSpecs.topP.min} and ${parameterSpecs.topP.max}.`);
      }
      if (platform.apiConfig?.apiStructure?.supportsSystemPrompt !== false && capabilities.supportsSystemPrompt !== false && formValues.systemPrompt && formValues.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
        throw new Error(`System Prompt cannot exceed ${MAX_SYSTEM_PROMPT_LENGTH} characters.`);
      }
      if (parameterSpecs.thinkingBudget) {
        if (formValues.thinkingBudget === null || formValues.thinkingBudget === undefined || isNaN(formValues.thinkingBudget)) throw new Error('Thinking Budget is required and must be a number.');
        if (formValues.thinkingBudget < parameterSpecs.thinkingBudget.min || formValues.thinkingBudget > parameterSpecs.thinkingBudget.max) throw new Error(`Thinking Budget must be between ${parameterSpecs.thinkingBudget.min} and ${parameterSpecs.thinkingBudget.max}.`);
      }
      if (parameterSpecs.reasoningEffort) {
        if (formValues.reasoningEffort === null || formValues.reasoningEffort === undefined) throw new Error('Reasoning Effort is required.');
        if (!parameterSpecs.reasoningEffort.allowedValues.includes(formValues.reasoningEffort)) throw new Error(`Reasoning Effort must be one of: ${parameterSpecs.reasoningEffort.allowedValues.join(', ')}.`);
      }

      const settingsToSave = { ...formValues };
      delete settingsToSave.contextWindow;

      const changedParamsList = [];
      if (originalValues) {
        for (const key in formValues) {
          if (Object.prototype.hasOwnProperty.call(formValues, key) && key !== 'contextWindow') {
            const currentValue = formValues[key];
            const originalValue = originalValues[key];
            let paramChanged = false;
            if (typeof currentValue === 'boolean') {
              if (currentValue !== originalValue) paramChanged = true;
            } else if (typeof currentValue === 'string') {
              if (currentValue.trim() !== (originalValue || '').trim()) paramChanged = true;
            } else if (typeof currentValue === 'number') {
              if (originalValue === null && currentValue !== null) paramChanged = true;
              else if (!Object.is(currentValue, originalValue)) paramChanged = true;
            } else if (currentValue !== originalValue) paramChanged = true;
            if (paramChanged) changedParamsList.push(getParameterDisplayName(key));
          }
        }
      }

      // Save to chrome.storage.local
      const storageResult = await chrome.storage.local.get(STORAGE_KEYS.MODEL_PARAMETER_SETTINGS);
      const allSettings = storageResult[STORAGE_KEYS.MODEL_PARAMETER_SETTINGS] || {};
      if (!allSettings[platform.id]) allSettings[platform.id] = { models: {} };
      if (!allSettings[platform.id].models) allSettings[platform.id].models = {};
      if (!allSettings[platform.id].models[selectedModelId]) allSettings[platform.id].models[selectedModelId] = {};
      
      allSettings[platform.id].models[selectedModelId][currentEditingMode] = settingsToSave;

      await chrome.storage.local.set({ [STORAGE_KEYS.MODEL_PARAMETER_SETTINGS]: allSettings });
      
      setOriginalValues({ ...formValues });

      let successMessage = `Parameters for '${modelConfigData?.displayName || selectedModelId}' saved.`;
      if (changedParamsList.length > 0) {
        const paramsString = changedParamsList.join(', ');
        successMessage = `Updated ${paramsString} for '${modelConfigData?.displayName || selectedModelId}'.`;
      }
      showSuccessNotification(successMessage);

    } catch (err) {
      logger.sidepanel.error('Error saving model parameters in sidepanel hook:', err);
      showNotificationError(err.message || 'An unknown error occurred during save.');
    } finally {
      setIsSavingActual(false);
    }
  }, [formValues, originalValues, platform, selectedModelId, currentEditingMode, derivedSettings, modelConfigData, showNotificationError, showSuccessNotification]);

  const handleResetClick = useCallback(async () => {
    if (isAtDefaults || !derivedSettings || !selectedModelId || !platform) return; // Added !platform check
    setIsResettingActual(true);
    setIsAnimatingReset(true);

    try {
      const { defaultSettings: configDefaults } = derivedSettings;
      
      const storageResult = await chrome.storage.local.get(STORAGE_KEYS.MODEL_PARAMETER_SETTINGS);
      const allSettings = storageResult[STORAGE_KEYS.MODEL_PARAMETER_SETTINGS] || {};

      let settingsChanged = false;
      if (allSettings[platform.id]?.models?.[selectedModelId]?.[currentEditingMode]) {
        delete allSettings[platform.id].models[selectedModelId][currentEditingMode];
        settingsChanged = true;

        // Clean up model entry if both base and thinking modes are now empty
        const modelEntry = allSettings[platform.id].models[selectedModelId];
        if (modelEntry && Object.keys(modelEntry).every(key => !modelEntry[key] || Object.keys(modelEntry[key]).length === 0)) {
          delete allSettings[platform.id].models[selectedModelId];
        }
        if (allSettings[platform.id].models && Object.keys(allSettings[platform.id].models).length === 0) {
          delete allSettings[platform.id].models;
        }
        if (Object.keys(allSettings[platform.id]).length === 0) {
          delete allSettings[platform.id];
        }
      }
      
      if (settingsChanged) {
        await chrome.storage.local.set({ [STORAGE_KEYS.MODEL_PARAMETER_SETTINGS]: allSettings });
      }
      
      setFormValues({ ...configDefaults });
      setOriginalValues({ ...configDefaults });
      showSuccessNotification(`Parameters for '${modelConfigData?.displayName || selectedModelId}' reset.`);
      
    } catch (err) {
      logger.sidepanel.error('Error resetting model parameters in sidepanel hook:', err);
      showNotificationError('Failed to reset model parameters.');
    } finally {
      setIsResettingActual(false);
      setTimeout(() => setIsAnimatingReset(false), 500);
    }
  }, [isAtDefaults, platform, selectedModelId, currentEditingMode, derivedSettings, modelConfigData, showNotificationError, showSuccessNotification]);

  return {
    formValues,
    derivedSettings,
    handleChange,
    handleSubmit,
    handleResetClick,
    isSaving: shouldShowSaving,
    isResetting: shouldShowResetting,
    isAnimatingReset,
    hasChanges,
    isAtDefaults,
    isFormReady,
  };
}

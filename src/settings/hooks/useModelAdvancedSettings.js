// src/settings/hooks/useModelAdvancedSettings.js
import { useState, useEffect, useCallback, useMemo } from 'react';

import { logger } from '../../shared/logger';
import {
  getDerivedModelSettings,
  checkAreFormValuesAtDefaults,
  checkForFormChanges,
} from '../utils/modelSettingsHelper';
import { MAX_SYSTEM_PROMPT_LENGTH } from '../../shared/constants';

export function useModelAdvancedSettings({
  platform,
  selectedModelId,
  advancedSettingsFromStorage, // This is platform[platformId] from storage
  onSettingsUpdateProp,
  onResetToDefaultsProp,
  showNotificationError, // Pass down the error function from useNotification
}) {
  const [currentEditingMode, setCurrentEditingMode] = useState('base');
  const [formValues, setFormValues] = useState({});
  const [originalValues, setOriginalValues] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isAtDefaults, setIsAtDefaults] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isAnimatingReset, setIsAnimatingReset] = useState(false);

  const modelsFromPlatform = useMemo(
    () => platform.apiConfig?.models || [],
    [platform.apiConfig?.models]
  );

  const derivedSettings = useMemo(() => {
    return getDerivedModelSettings({
      platformApiConfig: platform.apiConfig,
      modelId: selectedModelId,
      editingMode: currentEditingMode,
      modelsFromPlatform,
    });
  }, [
    platform.apiConfig,
    selectedModelId,
    currentEditingMode,
    modelsFromPlatform,
  ]);

  // Initialize and update formValues and originalValues
  useEffect(() => {
    if (!derivedSettings) {
      // Handle case where modelId might be invalid or config not found
      setFormValues({});
      setOriginalValues({});
      return;
    }

    const { defaultSettings: modelDefaults } = derivedSettings;
    
    // Determine current settings from storage for this model and mode
    let currentStoredSettings = {};
    if (advancedSettingsFromStorage) {
        if (selectedModelId === 'default' || !selectedModelId) { // Should ideally always have a selectedModelId
            currentStoredSettings = advancedSettingsFromStorage.default || {};
        } else if (advancedSettingsFromStorage.models?.[selectedModelId]) {
            currentStoredSettings = advancedSettingsFromStorage.models[selectedModelId][currentEditingMode] || {};
        }
    }

    const initialFormValues = {
      maxTokens: currentStoredSettings.maxTokens ?? modelDefaults.maxTokens,
      temperature: currentStoredSettings.temperature ?? modelDefaults.temperature,
      topP: currentStoredSettings.topP ?? modelDefaults.topP,
      systemPrompt: currentStoredSettings.systemPrompt ?? modelDefaults.systemPrompt,
      includeTemperature: currentStoredSettings.includeTemperature ?? modelDefaults.includeTemperature,
      includeTopP: currentStoredSettings.includeTopP ?? modelDefaults.includeTopP,
      thinkingBudget: currentStoredSettings.thinkingBudget ?? modelDefaults.thinkingBudget,
      reasoningEffort: currentStoredSettings.reasoningEffort ?? modelDefaults.reasoningEffort,
    };
    
    // Clean up undefined/null values that might not be in modelDefaults
    Object.keys(initialFormValues).forEach(key => {
      if (initialFormValues[key] === undefined && !(key in modelDefaults)) {
        initialFormValues[key] = null; // Or suitable default like '' for strings
      }
    });

    // Conditional initialization logic
    if (checkForFormChanges(formValues, originalValues)) {
      // Form is dirty, preserve user's current input in formValues.
      // Only update originalValues to reflect the new baseline from storage/defaults.
      setOriginalValues({ ...initialFormValues }); // Update baseline
      // formValues remains untouched. hasChanges and isAtDefaults will be updated by a separate effect.
    } else {
      // Form is clean, proceed with full re-initialization of formValues and originalValues.
      setFormValues(initialFormValues);
      setOriginalValues({ ...initialFormValues });
      // hasChanges and isAtDefaults will be updated by a separate effect.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [derivedSettings, advancedSettingsFromStorage, selectedModelId, currentEditingMode, platform.apiConfig]);

  const handleChange = useCallback(
    (name, newValue) => {
      setFormValues((prevValues) => {
        const updatedValues = { ...prevValues };

        if (name === 'maxTokens' || name === 'thinkingBudget') {
          const parsedValue = parseInt(newValue, 10);
          updatedValues[name] = (newValue === '' || newValue === null) ? null : (isNaN(parsedValue) ? prevValues[name] : parsedValue);
        } else if (name === 'temperature' || name === 'topP') {
          const parsedValue = parseFloat(newValue);
          updatedValues[name] = isNaN(parsedValue) ? prevValues[name] : parsedValue;
        } else if (name === 'reasoningEffort') {
          const allowed = derivedSettings?.parameterSpecs?.reasoningEffort?.allowedValues ?? [];
          updatedValues[name] = (newValue === '' || newValue === null || !allowed.includes(newValue)) ? null : newValue;
        } else if (name === 'includeTemperature' || name === 'includeTopP') {
          updatedValues[name] = newValue; // Boolean toggle
        } else {
          updatedValues[name] = newValue; // systemPrompt and other strings
        }
        
        setHasChanges(checkForFormChanges(updatedValues, originalValues));
        setIsAtDefaults(
          checkAreFormValuesAtDefaults(
            updatedValues,
            derivedSettings.defaultSettings,
            derivedSettings.capabilities,
            platform.apiConfig
          )
        );
        return updatedValues;
      });
    },
    [originalValues, derivedSettings, platform.apiConfig]
  );

  const handleSubmit = useCallback(async (event) => {
    if (event) event.preventDefault();
    setIsSaving(true);

    if (!derivedSettings) {
        showNotificationError('Cannot save: Model configuration not loaded.');
        setIsSaving(false);
        return;
    }
    const { parameterSpecs, capabilities } = derivedSettings;

    try {
      // Validation logic (simplified example, expand as needed)
      if (formValues.maxTokens === null || formValues.maxTokens === undefined || isNaN(formValues.maxTokens)) {
        throw new Error('Max Tokens is required.');
      }
      if (formValues.includeTemperature && (formValues.temperature === null || formValues.temperature === undefined || isNaN(formValues.temperature))) {
        throw new Error('Temperature is required when enabled.');
      }
      if (formValues.includeTopP && capabilities.supportsTopP === true && (formValues.topP === null || formValues.topP === undefined || isNaN(formValues.topP))) {
        throw new Error('Top P is required when enabled.');
      }
      if (capabilities.supportsSystemPrompt !== false && platform.apiConfig?.apiStructure?.supportsSystemPrompt !== false && formValues.systemPrompt && formValues.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
        throw new Error(`System Prompt cannot exceed ${MAX_SYSTEM_PROMPT_LENGTH} characters.`);
      }
      if (formValues.maxTokens < parameterSpecs.maxTokens.min || formValues.maxTokens > parameterSpecs.maxTokens.max) {
        throw new Error(`Max tokens must be between ${parameterSpecs.maxTokens.min} and ${parameterSpecs.maxTokens.max}.`);
      }
      if (formValues.temperature !== undefined && parameterSpecs.temperature) {
        if (formValues.temperature < parameterSpecs.temperature.min || formValues.temperature > parameterSpecs.temperature.max) {
          throw new Error(`Temperature must be between ${parameterSpecs.temperature.min} and ${parameterSpecs.temperature.max}.`);
        }
      }
      if (formValues.topP !== undefined && parameterSpecs.topP) {
         if (formValues.topP < parameterSpecs.topP.min || formValues.topP > parameterSpecs.topP.max) {
           throw new Error(`Top P must be between ${parameterSpecs.topP.min} and ${parameterSpecs.topP.max}.`);
         }
      }
      if (parameterSpecs.thinkingBudget && (formValues.thinkingBudget === null || formValues.thinkingBudget === undefined || isNaN(formValues.thinkingBudget))) {
        throw new Error('Thinking Budget is required.');
      }
      if (parameterSpecs.thinkingBudget && (formValues.thinkingBudget < parameterSpecs.thinkingBudget.min || formValues.thinkingBudget > parameterSpecs.thinkingBudget.max)) {
        throw new Error(`Thinking Budget must be between ${parameterSpecs.thinkingBudget.min} and ${parameterSpecs.thinkingBudget.max}.`);
      }
      if (parameterSpecs.reasoningEffort && (formValues.reasoningEffort === null || formValues.reasoningEffort === undefined)) {
        throw new Error('Reasoning Effort is required.');
      }
      if (parameterSpecs.reasoningEffort && !parameterSpecs.reasoningEffort.allowedValues.includes(formValues.reasoningEffort)) {
        throw new Error(`Reasoning Effort must be one of: ${parameterSpecs.reasoningEffort.allowedValues.join(', ')}.`);
      }

      const settingsToSave = { ...formValues };
      // Remove contextWindow as it's not a setting to be saved
      delete settingsToSave.contextWindow; 

      const success = await onSettingsUpdateProp(selectedModelId, settingsToSave, currentEditingMode);
      if (!success) {
        throw new Error('Failed to save settings via prop.');
      }

      setOriginalValues({ ...formValues });
      setHasChanges(false);
      setIsAtDefaults(
        checkAreFormValuesAtDefaults(
          formValues,
          derivedSettings.defaultSettings,
          capabilities,
          platform.apiConfig
        )
      );
    } catch (err) {
      logger.settings.error('Error saving advanced settings:', err);
      showNotificationError(err.message || 'An unknown error occurred during save.');
    } finally {
      setIsSaving(false);
    }
  }, [formValues, selectedModelId, currentEditingMode, onSettingsUpdateProp, derivedSettings, platform.apiConfig, showNotificationError]);

  // Effect to update hasChanges and isAtDefaults whenever formValues or originalValues change
  useEffect(() => {
    if (!derivedSettings) {
      // If derivedSettings are not yet available, default to clean/at-defaults state
      setHasChanges(false);
      setIsAtDefaults(true);
      return;
    }

    const { defaultSettings: modelDefaults, capabilities } = derivedSettings;

    const currentHasChanges = checkForFormChanges(formValues, originalValues);
    const currentIsAtDefaults = checkAreFormValuesAtDefaults(
      formValues,
      modelDefaults,
      capabilities,
      platform.apiConfig
    );

    setHasChanges(currentHasChanges);
    setIsAtDefaults(currentIsAtDefaults);
  }, [formValues, originalValues, derivedSettings, platform.apiConfig]);

  const handleResetClick = useCallback(async () => {
    if (isAtDefaults || !derivedSettings) return;
    setIsResetting(true);
    setIsAnimatingReset(true);

    try {
      const { defaultSettings: modelDefaults } = derivedSettings;
      setFormValues({ ...modelDefaults });
      setOriginalValues({ ...modelDefaults });
      setHasChanges(false);
      setIsAtDefaults(true);
      await onResetToDefaultsProp(selectedModelId, currentEditingMode);
    } catch (err) {
        logger.settings.error('Error resetting settings in hook:', err);
        showNotificationError('Failed to reset settings.');
    } finally {
      setIsResetting(false);
      setTimeout(() => setIsAnimatingReset(false), 500);
    }
  }, [isAtDefaults, derivedSettings, onResetToDefaultsProp, selectedModelId, currentEditingMode, showNotificationError]);
  
  const toggleEditingMode = useCallback(() => {
    // Only allow toggle if the base model config indicates thinking is toggleable
    if (derivedSettings?.resolvedModelConfig?.thinking?.toggleable) {
        setCurrentEditingMode(prev => prev === 'base' ? 'thinking' : 'base');
    }
  }, [derivedSettings]);

  // Derived booleans for UI rendering
  const showThinkingModeToggle = derivedSettings?.resolvedModelConfig?.thinking?.toggleable;
  const isThinkingModeActive = currentEditingMode === 'thinking';

  const modelSupportsTemp = derivedSettings?.capabilities?.supportsTemperature !== false;
  const modelSupportsTopP = derivedSettings?.capabilities?.supportsTopP === true;
  const modelSupportsSystemPrompt = derivedSettings?.capabilities?.supportsSystemPrompt !== false && platform.apiConfig?.apiStructure?.supportsSystemPrompt !== false;

  // Thinking mode can override base capabilities
  const thinkingOverridesTemp = isThinkingModeActive && derivedSettings?.resolvedModelConfig?.thinking?.supportsTemperature === false;
  const thinkingOverridesTopP = isThinkingModeActive && derivedSettings?.resolvedModelConfig?.thinking?.supportsTopP === false;
  
  const showTempSection = modelSupportsTemp && !thinkingOverridesTemp;
  const showTopPSection = modelSupportsTopP && !thinkingOverridesTopP;
  
  const showBudgetSlider = derivedSettings?.parameterSpecs?.thinkingBudget && derivedSettings?.resolvedModelConfig?.thinking?.available === true && (isThinkingModeActive || !derivedSettings?.resolvedModelConfig?.thinking?.toggleable);
  const showReasoningEffort = derivedSettings?.parameterSpecs?.reasoningEffort && derivedSettings?.resolvedModelConfig?.thinking?.available === true && (isThinkingModeActive || !derivedSettings?.resolvedModelConfig?.thinking?.toggleable);


  return {
    formValues,
    currentEditingMode,
    derivedSettings, // Contains resolvedModelConfig, displaySpecs, parameterSpecs, capabilities, defaultSettings
    handleChange,
    handleSubmit,
    handleResetClick,
    toggleEditingMode,
    isSaving,
    isResetting,
    isAnimatingReset,
    hasChanges,
    isAtDefaults,
    // UI rendering flags
    showThinkingModeToggle,
    isThinkingModeActive,
    showTempSection,
    showTopPSection,
    showBudgetSlider,
    showReasoningEffort,
    modelSupportsSystemPrompt,
    modelsFromPlatform, // Pass this through for the model selector
  };
}

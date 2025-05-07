// src/settings/hooks/useModelAdvancedSettings.js
import { useState, useEffect, useCallback, useMemo } from 'react';

import { logger } from '../../shared/logger';
import {
  getDerivedModelSettings,
  checkAreFormValuesAtDefaults,
  checkForFormChanges,
} from '../utils/modelSettingsHelper';
import { MAX_SYSTEM_PROMPT_LENGTH } from '../../shared/constants';
import { useNotification } from '../../components/feedback/NotificationContext';


export function useModelAdvancedSettings({
  platform, // Full platform config object
  selectedModelId,
  advancedSettingsForPlatform, // User's advanced settings for THIS platform from storage
  onSave, // Prop: async (platformId, modelId, mode, settingsToSave) => Promise<boolean>
  onReset, // Prop: async (platformId, modelId, mode) => Promise<boolean>
  // showNotificationError is implicitly available via useNotification hook
}) {
  const { error: showNotificationError } = useNotification();
  const [currentEditingMode, setCurrentEditingMode] = useState('base');
  const [formValues, setFormValues] = useState({});
  const [originalValues, setOriginalValues] = useState({}); // To track changes from last saved/loaded state
  const [hasChanges, setHasChanges] = useState(false);
  const [isAtDefaults, setIsAtDefaults] = useState(true); // Compared to config file defaults
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isAnimatingReset, setIsAnimatingReset] = useState(false);

  const modelsFromPlatform = useMemo(
    () => platform.apiConfig?.models || [],
    [platform.apiConfig?.models]
  );

  const derivedSettings = useMemo(() => {
    // Ensure selectedModelId is valid before deriving. If not, AdvancedSettings might show loading.
    if (!selectedModelId || !modelsFromPlatform.find(m => m.id === selectedModelId)) {
        // Attempt to find a default model if selectedModelId is invalid or platform changes
        const firstModelId = modelsFromPlatform.length > 0 ? modelsFromPlatform[0].id : null;
        if (!firstModelId) {
            logger.settings.warn(`useModelAdvancedSettings: No valid model found for platform ${platform.id}. Cannot derive settings.`);
            return null;
        }
        // Note: This won't automatically change selectedModelId in PlatformDetails,
        // but prevents errors here. PlatformDetails should handle setting a valid initial selectedModelId.
        logger.settings.info(`useModelAdvancedSettings: selectedModelId '${selectedModelId}' invalid or not found, attempting to use first model '${firstModelId}' for derivation for platform ${platform.id}.`);
        // This path is more of a safeguard; selectedModelId should ideally always be valid from PlatformDetails.
         return getDerivedModelSettings({
           platformApiConfig: platform.apiConfig,
           modelId: firstModelId, // Use first valid model as a fallback for derivation
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

  // Initialize and update formValues and originalValues
  useEffect(() => {
    if (!derivedSettings || !selectedModelId) {
      setFormValues({});
      setOriginalValues({});
      logger.settings.info('useModelAdvancedSettings: derivedSettings or selectedModelId is null, resetting formValues.');
      return;
    }

    const { defaultSettings: configDefaults } = derivedSettings;

    // Get user's stored settings for the current platform -> model -> mode
    let userStoredSettingsForModelMode = {};
    if (advancedSettingsForPlatform && advancedSettingsForPlatform.models && advancedSettingsForPlatform.models[selectedModelId]) {
      userStoredSettingsForModelMode = advancedSettingsForPlatform.models[selectedModelId][currentEditingMode] || {};
    } else if (advancedSettingsForPlatform && selectedModelId === 'default') { // Fallback for 'default' if used
        userStoredSettingsForModelMode = advancedSettingsForPlatform.default || {};
    }


    // Merge: Start with configDefaults, then override with user's stored settings
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
    
    // Clean up undefined/null values that might not be in configDefaults but are in user settings
    Object.keys(initialFormValues).forEach(key => {
        if (initialFormValues[key] === undefined && !(key in configDefaults)) {
            // If a user setting is undefined and not in config defaults, it implies it was perhaps
            // explicitly set to null or removed. Respect this.
            // However, if it's a parameter that *should* have a default from config (like maxTokens),
            // and it's somehow undefined, it implies an issue.
            // For safety, ensure critical numeric fields have a fallback if configDefaults missed them.
            if ((key === 'maxTokens' || key === 'thinkingBudget') && initialFormValues[key] == null) initialFormValues[key] = derivedSettings.parameterSpecs?.[key]?.min ?? 0;
            if ((key === 'temperature' || key === 'topP') && initialFormValues[key] == null) initialFormValues[key] = derivedSettings.parameterSpecs?.[key]?.min ?? 0;
            if (key === 'systemPrompt' && initialFormValues[key] == null) initialFormValues[key] = '';
        }
    });


    setFormValues(initialFormValues);
    setOriginalValues({ ...initialFormValues }); // Base comparison against this merged state
    // hasChanges and isAtDefaults will be updated by a separate effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedSettings, advancedSettingsForPlatform, selectedModelId, currentEditingMode, platform.apiConfig]);


  // Effect to update hasChanges and isAtDefaults whenever formValues, originalValues, or derivedSettings change
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
           // Ensure value stays within min/max if defined, otherwise allow what's typed
           if (paramSpec && !isNaN(parsedValue)) {
            updatedValues[name] = Math.max(paramSpec.min, Math.min(paramSpec.max, parsedValue));
           } else {
            updatedValues[name] = isNaN(parsedValue) ? prevValues[name] : parsedValue;
           }
        } else if (name === 'reasoningEffort') {
          const allowed = paramSpec?.allowedValues ?? [];
          updatedValues[name] = (newValue === '' || newValue === null || !allowed.includes(newValue)) ? null : newValue;
        } else if (name === 'includeTemperature' || name === 'includeTopP') {
          updatedValues[name] = newValue; // Boolean toggle
        } else {
          updatedValues[name] = newValue; // systemPrompt and other strings
        }
        return updatedValues;
      });
    },
    [derivedSettings] // originalValues is handled by the separate effect for hasChanges/isAtDefaults
  );

  const handleSubmit = useCallback(async (event) => {
    if (event) event.preventDefault();
    if (!derivedSettings || !selectedModelId) {
        showNotificationError('Cannot save: Model configuration not fully loaded.');
        return;
    }
    setIsSaving(true);

    const { parameterSpecs, capabilities } = derivedSettings;

    try {
      // Validation (ensure all fields being saved are valid according to parameterSpecs)
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
      // Remove contextWindow as it's not a setting to be saved by the user
      delete settingsToSave.contextWindow;

      // Call the onSave prop (which is saveAdvancedModelSettings from context)
      const success = await onSave(platform.id, selectedModelId, currentEditingMode, settingsToSave);
      if (success) {
        setOriginalValues({ ...formValues }); // Update baseline for "hasChanges" tracking
      } else {
        // Error notification would have been shown by the context action
      }
    } catch (err) {
      logger.settings.error('Error saving advanced settings in hook:', err);
      showNotificationError(err.message || 'An unknown error occurred during save.');
    } finally {
      setIsSaving(false);
    }
  }, [formValues, platform, selectedModelId, currentEditingMode, onSave, derivedSettings, showNotificationError]);


  const handleResetClick = useCallback(async () => {
    if (isAtDefaults || !derivedSettings || !selectedModelId) return;
    setIsResetting(true);
    setIsAnimatingReset(true);

    try {
      // Call the onReset prop (which is resetAdvancedModelSettingsToDefaults from context)
      const success = await onReset(platform.id, selectedModelId, currentEditingMode);
      if (success) {
        // If reset in storage was successful, re-initialize form to config defaults
        const { defaultSettings: configDefaults } = derivedSettings;
        setFormValues({ ...configDefaults });
        setOriginalValues({ ...configDefaults });
        // State for hasChanges and isAtDefaults will be updated by their dedicated effect
      } else {
        // Error notification would have been shown by the context action
      }
    } catch (err) {
        logger.settings.error('Error resetting settings in hook:', err);
        showNotificationError('Failed to reset settings.');
    } finally {
      setIsResetting(false);
      setTimeout(() => setIsAnimatingReset(false), 500); // For animation
    }
  }, [isAtDefaults, platform.id, selectedModelId, currentEditingMode, onReset, derivedSettings, showNotificationError]);
  
  const toggleEditingMode = useCallback(() => {
    if (derivedSettings?.resolvedModelConfig?.thinking?.toggleable) {
        setCurrentEditingMode(prev => prev === 'base' ? 'thinking' : 'base');
    }
  }, [derivedSettings]);

  // Derived booleans for UI rendering, ensuring derivedSettings exists
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
    isSaving,
    isResetting,
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
  };
}
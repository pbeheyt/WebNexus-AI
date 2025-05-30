// src/settings/hooks/useModelParametersSettings.js
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { logger } from '../../shared/logger';
import {
  getDerivedModelSettings,
  checkAreFormValuesAtDefaults,
  checkForFormChanges,
  getParameterDisplayName,
} from '../../shared/utils/model-settings-helper-utils';
import { MAX_SYSTEM_PROMPT_LENGTH } from '../../shared/constants';
import { useNotification } from '../../components/feedback/NotificationContext';
import useMinimumLoadingTime from '../../hooks/useMinimumLoadingTime';

export function useModelParametersSettings({
  platform,
  selectedModelId,
  modelParametersForPlatform,
  onSave,
  onReset,
  onReady,
}) {
  const { error: showNotificationError } = useNotification();

  // Core state
  const [currentEditingMode, setCurrentEditingMode] = useState('base');
  const [formValues, setFormValues] = useState({});
  const [originalValues, setOriginalValues] = useState({}); // For change detection
  const [derivedSettings, setDerivedSettings] = useState(null); // Holds all calculated specs

  // UI interaction state
  const [hasChanges, setHasChanges] = useState(false);
  const [isAtDefaults, setIsAtDefaults] = useState(true);
  const [isFormReady, setIsFormReady] = useState(false);

  // Action loading states
  const [isSavingActual, setIsSavingActual] = useState(false);
  const [isResettingActual, setIsResettingActual] = useState(false);
  const shouldShowSaving = useMinimumLoadingTime(isSavingActual);
  const shouldShowResetting = useMinimumLoadingTime(isResettingActual);
  const [isAnimatingReset, setIsAnimatingReset] = useState(false);

  // Mode transition specific state
  const [isTransitioningMode, setIsTransitioningMode] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);
  const [pendingDerivedSettings, setPendingDerivedSettings] = useState(null);
  const [pendingFormValues, setPendingFormValues] = useState(null);
  const isMounted = useRef(false); // To prevent premature onReady calls during initial mount

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Reset editing mode when model changes
  useEffect(() => {
    if (isMounted.current) {
      // Only reset if mounted and not during initial setup
      setCurrentEditingMode('base');
    }
  }, [selectedModelId]);

  const modelsFromPlatform = useMemo(
    () => platform.apiConfig?.models || [],
    [platform.apiConfig?.models]
  );

  // Effect for initial load and model/platform changes (NOT mode toggles)
  useEffect(() => {
    if (isTransitioningMode) return; // Skip if a mode transition is active

    setIsFormReady(false);
    logger.settings.debug(
      `useMPS: Initial load/model change for ${selectedModelId}. isTransitioningMode: ${isTransitioningMode}`
    );

    const newDerivedSettings = getDerivedModelSettings({
      platformIdForLogging: platform?.id, // Pass platform ID for logging
      platformApiConfig: platform.apiConfig,
      modelId: selectedModelId,
      editingMode: currentEditingMode,
      modelsFromPlatform,
    });
    setDerivedSettings(newDerivedSettings);

    if (!newDerivedSettings || !selectedModelId) {
      setFormValues({});
      setOriginalValues({});
      setIsFormReady(true);
      if (typeof onReady === 'function' && isMounted.current) onReady();
      return;
    }

    const { defaultSettings: configDefaults } = newDerivedSettings;
    let userStoredSettingsForModelMode = {};
    if (
      modelParametersForPlatform?.models?.[selectedModelId]?.[
        currentEditingMode
      ]
    ) {
      userStoredSettingsForModelMode =
        modelParametersForPlatform.models[selectedModelId][currentEditingMode];
    }

    const initialFormValues = {
      maxTokens:
        userStoredSettingsForModelMode.maxTokens ?? configDefaults.maxTokens,
      temperature:
        userStoredSettingsForModelMode.temperature ??
        configDefaults.temperature,
      topP: userStoredSettingsForModelMode.topP ?? configDefaults.topP,
      systemPrompt:
        userStoredSettingsForModelMode.systemPrompt ??
        configDefaults.systemPrompt,
      includeTemperature:
        userStoredSettingsForModelMode.includeTemperature ??
        configDefaults.includeTemperature,
      includeTopP:
        userStoredSettingsForModelMode.includeTopP ??
        configDefaults.includeTopP,
      thinkingBudget:
        userStoredSettingsForModelMode.thinkingBudget ??
        configDefaults.thinkingBudget,
      reasoningEffort:
        userStoredSettingsForModelMode.reasoningEffort ??
        configDefaults.reasoningEffort,
    };

    Object.keys(initialFormValues).forEach((key) => {
      if (initialFormValues[key] === undefined && !(key in configDefaults)) {
        if (
          (key === 'maxTokens' || key === 'thinkingBudget') &&
          initialFormValues[key] == null
        )
          initialFormValues[key] =
            newDerivedSettings.parameterSpecs?.[key]?.min ?? 0;
        if (
          (key === 'temperature' || key === 'topP') &&
          initialFormValues[key] == null
        )
          initialFormValues[key] =
            newDerivedSettings.parameterSpecs?.[key]?.min ?? 0;
        if (key === 'systemPrompt' && initialFormValues[key] == null)
          initialFormValues[key] = '';
      }
    });

    setFormValues(initialFormValues);
    setOriginalValues({ ...initialFormValues });
    setIsFormReady(true);

    if (
      typeof onReady === 'function' &&
      isMounted.current &&
      Object.keys(initialFormValues).length > 0
    ) {
      onReady();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedModelId,
    platform.apiConfig,
    modelParametersForPlatform,
    modelsFromPlatform,
  ]);

  // Effect to recalculate derived settings and form values when pendingMode changes
  useEffect(() => {
    if (isTransitioningMode && pendingMode) {
      logger.settings.debug(
        `useMPS: Recalculating for pendingMode: ${pendingMode}`
      );
      const newPendingDerivedSettings = getDerivedModelSettings({
        platformIdForLogging: platform?.id, // Pass platform ID for logging
        platformApiConfig: platform.apiConfig,
        modelId: selectedModelId,
        editingMode: pendingMode,
        modelsFromPlatform,
      });
      setPendingDerivedSettings(newPendingDerivedSettings);

      if (!newPendingDerivedSettings) {
        setPendingFormValues({});
        return;
      }

      const { defaultSettings: configDefaults } = newPendingDerivedSettings;
      let userStoredSettingsForModelMode = {};
      if (
        modelParametersForPlatform?.models?.[selectedModelId]?.[pendingMode]
      ) {
        userStoredSettingsForModelMode =
          modelParametersForPlatform.models[selectedModelId][pendingMode];
      }

      const newPendingFormVals = {
        maxTokens:
          userStoredSettingsForModelMode.maxTokens ?? configDefaults.maxTokens,
        temperature:
          userStoredSettingsForModelMode.temperature ??
          configDefaults.temperature,
        topP: userStoredSettingsForModelMode.topP ?? configDefaults.topP,
        systemPrompt:
          userStoredSettingsForModelMode.systemPrompt ??
          configDefaults.systemPrompt,
        includeTemperature:
          userStoredSettingsForModelMode.includeTemperature ??
          configDefaults.includeTemperature,
        includeTopP:
          userStoredSettingsForModelMode.includeTopP ??
          configDefaults.includeTopP,
        thinkingBudget:
          userStoredSettingsForModelMode.thinkingBudget ??
          configDefaults.thinkingBudget,
        reasoningEffort:
          userStoredSettingsForModelMode.reasoningEffort ??
          configDefaults.reasoningEffort,
      };
      Object.keys(newPendingFormVals).forEach((key) => {
        if (newPendingFormVals[key] === undefined && !(key in configDefaults)) {
          if (
            (key === 'maxTokens' || key === 'thinkingBudget') &&
            newPendingFormVals[key] == null
          )
            newPendingFormVals[key] =
              newPendingDerivedSettings.parameterSpecs?.[key]?.min ?? 0;
          if (
            (key === 'temperature' || key === 'topP') &&
            newPendingFormVals[key] == null
          )
            newPendingFormVals[key] =
              newPendingDerivedSettings.parameterSpecs?.[key]?.min ?? 0;
          if (key === 'systemPrompt' && newPendingFormVals[key] == null)
            newPendingFormVals[key] = '';
        }
      });
      setPendingFormValues(newPendingFormVals);
    }
  }, [
    isTransitioningMode,
    pendingMode,
    platform.apiConfig,
    platform?.id,
    selectedModelId,
    modelParametersForPlatform,
    modelsFromPlatform,
  ]);

  // Effect to finalize mode transition
  useEffect(() => {
    if (
      isTransitioningMode &&
      pendingMode &&
      pendingDerivedSettings &&
      pendingFormValues
    ) {
      logger.settings.debug(
        `useMPS: Finalizing mode transition to: ${pendingMode}`
      );
      setCurrentEditingMode(pendingMode);
      setDerivedSettings(pendingDerivedSettings);
      setFormValues(pendingFormValues);
      setOriginalValues({ ...pendingFormValues });

      // Reset pending states
      setIsTransitioningMode(false);
      setPendingMode(null);
      setPendingDerivedSettings(null);
      setPendingFormValues(null);
      setIsFormReady(true);

      if (typeof onReady === 'function' && isMounted.current) {
        logger.settings.debug(
          `useMPS: Calling onReady after mode transition to ${pendingMode}`
        );
        onReady();
      }
    }
  }, [
    isTransitioningMode,
    pendingMode,
    pendingDerivedSettings,
    pendingFormValues,
    onReady,
  ]);

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
        platform.apiConfig
      )
    );
  }, [
    formValues,
    originalValues,
    derivedSettings,
    platform.apiConfig,
    isFormReady,
  ]);

  const handleChange = useCallback(
    (name, newValue) => {
      if (isTransitioningMode) return; // Prevent changes while transitioning
      setFormValues((prevValues) => {
        const updatedValues = { ...prevValues };
        const paramSpec = derivedSettings?.parameterSpecs?.[name];

        if (name === 'maxTokens' || name === 'thinkingBudget') {
          const parsedValue = parseInt(newValue, 10);
          updatedValues[name] =
            newValue === '' || newValue === null
              ? null
              : isNaN(parsedValue)
                ? prevValues[name]
                : parsedValue;
        } else if (name === 'temperature' || name === 'topP') {
          const parsedValue = parseFloat(newValue);
          if (paramSpec && !isNaN(parsedValue)) {
            updatedValues[name] = Math.max(
              paramSpec.min,
              Math.min(paramSpec.max, parsedValue)
            );
          } else {
            updatedValues[name] = isNaN(parsedValue)
              ? prevValues[name]
              : parsedValue;
          }
        } else if (name === 'reasoningEffort') {
          const allowed = paramSpec?.allowedValues ?? [];
          updatedValues[name] =
            newValue === '' || newValue === null || !allowed.includes(newValue)
              ? null
              : newValue;
        } else if (name === 'includeTemperature' || name === 'includeTopP') {
          updatedValues[name] = newValue;
        } else {
          updatedValues[name] = newValue;
        }
        return updatedValues;
      });
    },
    [derivedSettings, isTransitioningMode]
  );

  const handleSubmit = useCallback(
    async (event) => {
      if (event) event.preventDefault();
      if (isTransitioningMode) return; // Prevent save while transitioning

      if (!derivedSettings || !selectedModelId) {
        showNotificationError(
          'Cannot save: Model configuration not fully loaded.'
        );
        return;
      }
      setIsSavingActual(true);

      const { parameterSpecs, capabilities } = derivedSettings;

      try {
        if (
          formValues.maxTokens === null ||
          formValues.maxTokens === undefined ||
          isNaN(formValues.maxTokens)
        ) {
          throw new Error('Max Tokens is required and must be a number.');
        }
        if (
          formValues.maxTokens < parameterSpecs.maxTokens.min ||
          formValues.maxTokens > parameterSpecs.maxTokens.max
        ) {
          throw new Error(
            `Max tokens must be between ${parameterSpecs.maxTokens.min} and ${parameterSpecs.maxTokens.max}.`
          );
        }
        if (
          capabilities.supportsTemperature !== false &&
          formValues.includeTemperature
        ) {
          if (
            formValues.temperature === null ||
            formValues.temperature === undefined ||
            isNaN(formValues.temperature)
          ) {
            throw new Error(
              'Temperature is required when enabled and must be a number.'
            );
          }
          if (
            formValues.temperature < parameterSpecs.temperature.min ||
            formValues.temperature > parameterSpecs.temperature.max
          ) {
            throw new Error(
              `Temperature must be between ${parameterSpecs.temperature.min} and ${parameterSpecs.temperature.max}.`
            );
          }
        }
        if (capabilities.supportsTopP === true && formValues.includeTopP) {
          if (
            formValues.topP === null ||
            formValues.topP === undefined ||
            isNaN(formValues.topP)
          ) {
            throw new Error(
              'Top P is required when enabled and must be a number.'
            );
          }
          if (
            formValues.topP < parameterSpecs.topP.min ||
            formValues.topP > parameterSpecs.topP.max
          ) {
            throw new Error(
              `Top P must be between ${parameterSpecs.topP.min} and ${parameterSpecs.topP.max}.`
            );
          }
        }
        if (
          platform.apiConfig?.apiStructure?.supportsSystemPrompt !== false &&
          capabilities.supportsSystemPrompt !== false &&
          formValues.systemPrompt &&
          formValues.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH
        ) {
          throw new Error(
            `System Prompt cannot exceed ${MAX_SYSTEM_PROMPT_LENGTH} characters.`
          );
        }
        if (parameterSpecs.thinkingBudget) {
          if (
            formValues.thinkingBudget === null ||
            formValues.thinkingBudget === undefined ||
            isNaN(formValues.thinkingBudget)
          ) {
            throw new Error(
              'Thinking Budget is required and must be a number.'
            );
          }
          if (
            formValues.thinkingBudget < parameterSpecs.thinkingBudget.min ||
            formValues.thinkingBudget > parameterSpecs.thinkingBudget.max
          ) {
            throw new Error(
              `Thinking Budget must be between ${parameterSpecs.thinkingBudget.min} and ${parameterSpecs.thinkingBudget.max}.`
            );
          }
        }
        if (parameterSpecs.reasoningEffort) {
          if (
            formValues.reasoningEffort === null ||
            formValues.reasoningEffort === undefined
          ) {
            throw new Error('Reasoning Effort is required.');
          }
          if (
            !parameterSpecs.reasoningEffort.allowedValues.includes(
              formValues.reasoningEffort
            )
          ) {
            throw new Error(
              `Reasoning Effort must be one of: ${parameterSpecs.reasoningEffort.allowedValues.join(', ')}.`
            );
          }
        }

        const settingsToSave = { ...formValues };
        delete settingsToSave.contextWindow;

        const changedParamsList = [];
        if (originalValues) {
          for (const key in formValues) {
            if (
              Object.prototype.hasOwnProperty.call(formValues, key) &&
              key !== 'contextWindow'
            ) {
              const currentValue = formValues[key];
              const originalValue = originalValues[key];
              let paramChanged = false;
              if (typeof currentValue === 'boolean') {
                if (currentValue !== originalValue) paramChanged = true;
              } else if (typeof currentValue === 'string') {
                if (currentValue.trim() !== (originalValue || '').trim())
                  paramChanged = true;
              } else if (typeof currentValue === 'number') {
                if (originalValue === null && currentValue !== null)
                  paramChanged = true;
                else if (!Object.is(currentValue, originalValue))
                  paramChanged = true;
              } else if (currentValue !== originalValue) paramChanged = true;
              if (paramChanged)
                changedParamsList.push(getParameterDisplayName(key));
            }
          }
        }

        const success = await onSave(
          platform.id,
          selectedModelId,
          currentEditingMode,
          settingsToSave,
          changedParamsList
        );
        if (success) {
          setOriginalValues({ ...formValues }); // Update baseline on successful save
        }
      } catch (err) {
        logger.settings.error('Error saving model parameters in hook:', err);
        showNotificationError(
          err.message || 'An unknown error occurred during save.'
        );
      } finally {
        setIsSavingActual(false);
      }
    },
    [
      formValues,
      originalValues,
      platform,
      selectedModelId,
      currentEditingMode,
      onSave,
      derivedSettings,
      showNotificationError,
      isTransitioningMode,
    ]
  );

  const handleResetClick = useCallback(async () => {
    if (
      isAtDefaults ||
      !derivedSettings ||
      !selectedModelId ||
      isTransitioningMode
    )
      return;
    setIsResettingActual(true);
    setIsAnimatingReset(true);

    try {
      const success = await onReset(
        platform.id,
        selectedModelId,
        currentEditingMode
      );
      if (success) {
        // Re-fetch default settings based on the current derivedSettings
        // This ensures that if derivedSettings itself has changed (e.g. due to config update),
        // we reset to the *new* defaults.
        const { defaultSettings: newConfigDefaults } = getDerivedModelSettings({
          platformIdForLogging: platform?.id, // Pass platform ID for logging
          platformApiConfig: platform.apiConfig,
          modelId: selectedModelId,
          editingMode: currentEditingMode,
          modelsFromPlatform,
        });

        setFormValues({ ...newConfigDefaults });
        setOriginalValues({ ...newConfigDefaults }); // Update baseline on successful reset
      }
    } catch (err) {
      logger.settings.error('Error resetting model parameters in hook:', err);
      showNotificationError('Failed to reset model parameters.');
    } finally {
      setIsResettingActual(false);
      setTimeout(() => setIsAnimatingReset(false), 500);
    }
  }, [
    isAtDefaults,
    platform.id,
    platform.apiConfig,
    selectedModelId,
    currentEditingMode,
    onReset,
    derivedSettings,
    showNotificationError,
    modelsFromPlatform,
    isTransitioningMode,
  ]);

  const toggleEditingMode = useCallback(() => {
    if (isTransitioningMode) return; // Prevent toggling if already transitioning

    if (derivedSettings?.resolvedModelConfig?.thinking?.toggleable) {
      setIsTransitioningMode(true);
      const targetMode = currentEditingMode === 'base' ? 'thinking' : 'base';
      setPendingMode(targetMode);
      logger.settings.debug(
        `useMPS: Initiating mode transition to: ${targetMode}`
      );
    }
  }, [derivedSettings, currentEditingMode, isTransitioningMode]);

  // Memoized values for UI rendering based on derivedSettings
  const showThinkingModeToggle =
    derivedSettings?.resolvedModelConfig?.thinking?.toggleable ?? false;
  const isThinkingModeActive = currentEditingMode === 'thinking';

  const modelSupportsTemp =
    derivedSettings?.capabilities?.supportsTemperature !== false ?? true;
  const modelSupportsTopP =
    derivedSettings?.capabilities?.supportsTopP === true ?? false;
  const modelSupportsSystemPrompt =
    (derivedSettings?.capabilities?.supportsSystemPrompt !== false &&
      platform.apiConfig?.apiStructure?.supportsSystemPrompt !== false) ??
    true;

  const thinkingOverridesTemp =
    isThinkingModeActive &&
    derivedSettings?.resolvedModelConfig?.thinking?.supportsTemperature ===
      false;
  const thinkingOverridesTopP =
    isThinkingModeActive &&
    derivedSettings?.resolvedModelConfig?.thinking?.supportsTopP === false;

  const showTempSection = modelSupportsTemp && !thinkingOverridesTemp;
  const showTopPSection = modelSupportsTopP && !thinkingOverridesTopP;

  const showBudgetSlider =
    derivedSettings?.parameterSpecs?.thinkingBudget &&
    derivedSettings?.resolvedModelConfig?.thinking?.available === true &&
    (isThinkingModeActive ||
      !derivedSettings?.resolvedModelConfig?.thinking?.toggleable);
  const showReasoningEffort =
    derivedSettings?.parameterSpecs?.reasoningEffort &&
    derivedSettings?.resolvedModelConfig?.thinking?.available === true &&
    (isThinkingModeActive ||
      !derivedSettings?.resolvedModelConfig?.thinking?.toggleable);

  return {
    formValues,
    currentEditingMode,
    derivedSettings,
    handleChange,
    handleSubmit,
    handleResetClick,
    toggleEditingMode,
    isSaving: shouldShowSaving,
    isResetting: shouldShowResetting,
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
    isTransitioningMode,
  };
}

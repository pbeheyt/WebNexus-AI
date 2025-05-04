import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

import { logger } from '../../../../shared/logger';
import { MAX_SYSTEM_PROMPT_LENGTH } from '../../../../shared/constants';
import {
  Button,
  useNotification,
  SliderInput,
  Toggle,
  IconButton,
  RefreshIcon,
} from '../../../../components';
import { CustomSelect } from '../../../../components/core/CustomSelect';

const AdvancedSettings = ({
  platform,
  selectedModelId,
  advancedSettings,
  onModelSelect,
  onSettingsUpdate,
  onResetToDefaults,
}) => {
  const { error } = useNotification();
  const [currentEditingMode, setCurrentEditingMode] = useState('base');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAtDefaults, setIsAtDefaults] = useState(true);
  const [isAnimatingReset, setIsAnimatingReset] = useState(false);
        const models = useMemo(() => platform.apiConfig?.models || [], [platform.apiConfig?.models]);

  // Get model config for selected model
  const modelConfig = models.find((m) => m.id === selectedModelId);

  // Get settings for this model
  const getModelSettings = () => {
    if (!selectedModelId || selectedModelId === 'default') {
      return advancedSettings.default || {};
    }
    return advancedSettings.models?.[selectedModelId]?.[currentEditingMode] || {};
  };

  const settings = getModelSettings();

  // Get default settings from model config
  const getDefaultSettings = useCallback(() => {
    const currentModelConfig = models.find((m) => m.id === selectedModelId);

    const defaults = {
      maxTokens: currentModelConfig.tokens.maxOutput,
      contextWindow: currentModelConfig.tokens.contextWindow,
    };

    // Add temperature and its toggle default only if supported
    if (currentModelConfig?.capabilities?.supportsTemperature !== false) {
      (defaults.temperature = platform.apiConfig.temperature.default),
        (defaults.includeTemperature = true);
    }

    // Add topP and its toggle default only if supported
    if (currentModelConfig?.capabilities?.supportsTopP === true) {
      defaults.topP = platform.apiConfig.topP.default;
      defaults.includeTopP = false; // Default include to false if supported
    }

    // Add systemPrompt only if the platform supports it
    if (platform.apiConfig?.apiStructure?.supportsSystemPrompt !== false) {
      defaults.systemPrompt = ''; // Default is always empty string
    }

    return defaults;
  }, [models, selectedModelId, platform.apiConfig]);

  const defaultSettings = getDefaultSettings();

  // Form state with proper initialization including new toggles
  const [formValues, setFormValues] = useState({
    maxTokens: settings.maxTokens ?? defaultSettings.maxTokens,
    temperature: settings.temperature ?? defaultSettings.temperature,
    topP: settings.topP ?? defaultSettings.topP,
    contextWindow: settings.contextWindow ?? defaultSettings.contextWindow,
    systemPrompt: settings.systemPrompt ?? '',
    includeTemperature: settings.includeTemperature ?? true,
    includeTopP: settings.includeTopP ?? false, // Default to false
  });

  // Original values reference for comparison
  const [originalValues, setOriginalValues] = useState({ ...formValues });

  // Check if current form values match default settings for the selected model
  const checkIfAtDefaults = useCallback((formVals) => {
    const modelDefaults = getDefaultSettings(); // Get defaults for the current model
    const currentModelConfig = models.find((m) => m.id === selectedModelId); // Get config for checks

    // Compare maxTokens
    if (
      !('maxTokens' in formVals) ||
      formVals.maxTokens !== modelDefaults.maxTokens
    ) {
      return false;
    }

    // Compare temperature only if supported
    if (currentModelConfig?.capabilities?.supportsTemperature !== false) {
      if (
        !('temperature' in formVals) ||
        !('temperature' in modelDefaults) ||
        formVals.temperature !== modelDefaults.temperature
      ) {
        return false;
      }
      // Compare includeTemperature (default is true if supported)
      if (
        formVals.includeTemperature !==
        (modelDefaults.includeTemperature ?? true)
      ) {
        return false;
      }
    }

    // Compare topP only if supported
    if (currentModelConfig?.capabilities?.supportsTopP === true) {
      if (
        !('topP' in formVals) ||
        !('topP' in modelDefaults) ||
        formVals.topP !== modelDefaults.topP
      ) {
        return false;
      }
      // Compare includeTopP (default is false if supported)
      if (formVals.includeTopP !== (modelDefaults.includeTopP ?? false)) {
        return false;
      }
    }

    // Compare systemPrompt only if supported
    if (platform.apiConfig?.apiStructure?.supportsSystemPrompt !== false) {
      if (
        !('systemPrompt' in formVals) ||
        formVals.systemPrompt.trim() !== ''
      ) {
        return false;
      }
    }

    // If all relevant checks pass, values are at defaults
    return true;
  }, [getDefaultSettings, models, selectedModelId, platform.apiConfig]);

  // Update form values when selected model or settings change
  useEffect(() => {
    const currentSettings = getModelSettings();
    let modelDefaults = getDefaultSettings();
    
    if (currentEditingMode === 'thinking' && modelConfig?.thinking) {
      modelDefaults = {
        ...modelDefaults,
        maxTokens: modelConfig.thinking.maxOutput ?? modelDefaults.maxTokens,
        contextWindow: modelConfig.thinking.contextWindow ?? modelDefaults.contextWindow
      };
    }

    const newFormValues = {
      maxTokens: currentSettings.maxTokens ?? modelDefaults.maxTokens,
      temperature: currentSettings.temperature ?? modelDefaults.temperature,
      topP: currentSettings.topP ?? modelDefaults.topP,
      contextWindow:
        currentSettings.contextWindow ?? modelDefaults.contextWindow,
      systemPrompt: currentSettings.systemPrompt ?? '',
      includeTemperature: currentSettings.includeTemperature ?? true,
      includeTopP: currentSettings.includeTopP ?? false,
    };

    setFormValues(newFormValues);
    setOriginalValues(newFormValues);
    setHasChanges(false);
    setIsAtDefaults(checkIfAtDefaults(newFormValues));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModelId, currentEditingMode, getDefaultSettings, checkIfAtDefaults]);

  // Check if current form values differ from original values
  const checkForChanges = useCallback((currentValues, originalVals) => {
    for (const key in currentValues) {
      if (currentValues[key] === undefined && originalVals[key] === undefined) {
        continue;
      }
      if (key === 'contextWindow') {
        // Skip contextWindow
        continue;
      }
      if (
        typeof currentValues[key] === 'string' &&
        currentValues[key] !== originalVals[key]
      ) {
        return true;
      }
      if (
        typeof currentValues[key] === 'number' &&
        !Object.is(currentValues[key], originalVals[key])
      ) {
        return true;
      }
      if (
        typeof currentValues[key] === 'boolean' &&
        currentValues[key] !== originalVals[key]
      ) {
        return true;
      }
    }
    return false;
  }, []);

  // Handle changes for all input types including toggles
  const handleChange = useCallback((name, newValue) => {
    const updatedValues = { ...formValues };

    if (name === 'maxTokens') {
      const parsedValue = parseInt(newValue, 10);
      updatedValues[name] = isNaN(parsedValue)
        ? formValues.maxTokens
        : parsedValue;
    } else if (name === 'temperature' || name === 'topP') {
      const parsedValue = parseFloat(newValue);
      updatedValues[name] = isNaN(parsedValue) ? formValues[name] : parsedValue;
    } else if (name === 'systemPrompt') {
      updatedValues[name] = newValue;
    } else if (name === 'includeTemperature' || name === 'includeTopP') {
      updatedValues[name] = newValue;
    } else {
      updatedValues[name] = newValue;
    }

    setFormValues(updatedValues);
    setHasChanges(checkForChanges(updatedValues, originalValues));
    setIsAtDefaults(checkIfAtDefaults(updatedValues));
  }, [formValues, originalValues, checkForChanges, checkIfAtDefaults]);

  const handleModelChange = useCallback((modelId) => {
    onModelSelect(modelId);
  }, [onModelSelect]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Required field checks
      if (formValues.maxTokens === null || formValues.maxTokens === undefined || isNaN(formValues.maxTokens)) {
        throw new Error('Max Tokens is required.');
      }
      if (formValues.includeTemperature && (formValues.temperature === null || formValues.temperature === undefined || isNaN(formValues.temperature))) {
        throw new Error('Temperature is required when enabled.');
      }
      // Check Top P requirement only if supported and enabled
      if (formValues.includeTopP && modelConfig?.supportsTopP === true && (formValues.topP === null || formValues.topP === undefined || isNaN(formValues.topP))) {
        throw new Error('Top P is required when enabled.');
      }

      // Max length check for System Prompt (only if supported)
      if (platform.apiConfig?.hasSystemPrompt !== false && modelConfig?.supportsSystemPrompt !== false && formValues.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
        throw new Error(`System Prompt cannot exceed ${MAX_SYSTEM_PROMPT_LENGTH} characters.`);
      }

      // Range validation checks
      const maxTokensMax = modelConfig.tokens.maxOutput;
      if (formValues.maxTokens < 1 || formValues.maxTokens > maxTokensMax) {
        throw new Error(`Max tokens must be between 1 and ${maxTokensMax}`);
      }
      if (formValues.temperature !== undefined) {
        const minTemp = platform.apiConfig.temperature.min;
        const maxTemp = platform.apiConfig.temperature.max;
        if (
          formValues.temperature < minTemp ||
          formValues.temperature > maxTemp
        ) {
          throw new Error(
            `Temperature must be between ${minTemp} and ${maxTemp}`
          );
        }
      }
      if (formValues.topP !== undefined) {
        const minTopP = platform.apiConfig.topP.min;
        const maxTopP = platform.apiConfig.topP.max;
        if (formValues.topP < minTopP || formValues.topP > maxTopP) {
          throw new Error(`Top P must be between ${minTopP} and ${maxTopP}`);
        }
      }

      // Create settings object including new toggles
      const updateSettings = {};
      if ('maxTokens' in formValues)
        updateSettings.maxTokens = formValues.maxTokens;
      if (
        'temperature' in formValues &&
        modelConfig?.supportsTemperature !== false
      ) {
        updateSettings.temperature = formValues.temperature;
      }
      if ('topP' in formValues && modelConfig?.supportsTopP === true) {
        updateSettings.topP = formValues.topP;
      }
      if (
        'systemPrompt' in formValues &&
        platform.apiConfig?.hasSystemPrompt !== false
      ) {
        updateSettings.systemPrompt = formValues.systemPrompt;
      }
      // Add toggles if they exist in formValues
      if ('includeTemperature' in formValues) {
        updateSettings.includeTemperature = formValues.includeTemperature;
      }
      if ('includeTopP' in formValues) {
        updateSettings.includeTopP = formValues.includeTopP;
      }

      // Save settings
      const success = await onSettingsUpdate(selectedModelId, updateSettings, currentEditingMode);
      if (!success) {
        throw new Error('Failed to save settings');
      }

      setOriginalValues({ ...formValues });
      setHasChanges(false);
      setIsAtDefaults(checkIfAtDefaults(formValues));
    } catch (err) {
      logger.settings.error('Error saving settings:', err);
      error(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValues, selectedModelId, platform.apiConfig, onSettingsUpdate, checkIfAtDefaults, error, modelConfig]);

  const handleResetClick = useCallback(async () => {
    if (isAtDefaults) return; // Prevent action if disabled

    setIsResetting(true);
    setIsAnimatingReset(true); // Start animation

    try {
      // Existing reset logic
    let defaults = getDefaultSettings();
    const currentModelConfig = models.find((m) => m.id === selectedModelId);
    
    if (currentEditingMode === 'thinking' && modelConfig?.thinking) {
      defaults = {
        ...defaults,
        maxTokens: modelConfig.thinking.maxOutput ?? defaults.maxTokens
      };
    }
    
    const resetValues = {
      maxTokens: defaults.maxTokens,
      contextWindow: defaults.contextWindow,
    };
    if (
      currentModelConfig?.capabilities?.supportsTemperature !== false &&
      'temperature' in defaults
    ) {
      resetValues.temperature = defaults.temperature;
      resetValues.includeTemperature = defaults.includeTemperature ?? true;
    }
    if (currentModelConfig?.capabilities?.supportsTopP === true && 'topP' in defaults) {
      resetValues.topP = defaults.topP;
      resetValues.includeTopP = defaults.includeTopP ?? false;
    }
    if (
      platform.apiConfig?.apiStructure?.supportsSystemPrompt !== false &&
      'systemPrompt' in defaults
    ) {
      resetValues.systemPrompt = defaults.systemPrompt;
    }

    setFormValues(resetValues);
    setOriginalValues(resetValues); // Ensure original values are also reset
    setHasChanges(false);
    setIsAtDefaults(true);
    await onResetToDefaults(selectedModelId, currentEditingMode); // Call the prop function

      await onResetToDefaults(selectedModelId); // Call the prop function
    } finally {
      setIsResetting(false);
      // Stop animation after duration
      setTimeout(() => {
        setIsAnimatingReset(false);
      }, 500); // Match duration in iconClassName
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAtDefaults, getDefaultSettings, models, selectedModelId, platform.apiConfig, onResetToDefaults]);

  const formatPrice = (price) => {
    return typeof price === 'number' ? price.toFixed(2) : price;
  };

  // Calculate dynamic specs based on current editing mode
  const displaySpecs = useMemo(() => {
    if (!modelConfig) {
      return {
        contextWindow: 'N/A',
        inputPrice: 0,
        outputPrice: 0,
        maxOutputTokens: 1
      };
    }

    // Get base values
    const baseContextWindow = modelConfig.tokens?.contextWindow;
    const baseInputPrice = modelConfig.pricing?.inputTokenPrice;
    const baseOutputPrice = modelConfig.pricing?.outputTokenPrice;
    const baseMaxOutputTokens = modelConfig.tokens?.maxOutput;

    // Initialize with base values
    let contextWindow = baseContextWindow;
    let inputPrice = baseInputPrice;
    let outputPrice = baseOutputPrice;
    let maxOutputTokens = baseMaxOutputTokens;

    // Override with thinking mode values if applicable
    if (currentEditingMode === 'thinking' && modelConfig.thinking) {
      contextWindow = modelConfig.thinking.contextWindow ?? contextWindow;
      inputPrice = modelConfig.thinking.pricing?.inputTokenPrice ?? inputPrice;
      outputPrice = modelConfig.thinking.pricing?.outputTokenPrice ?? outputPrice;
      maxOutputTokens = modelConfig.thinking.maxOutput ?? maxOutputTokens;
    }

    return {
      contextWindow,
      inputPrice,
      outputPrice,
      maxOutputTokens
    };
  }, [modelConfig, currentEditingMode]);

  return (
    <div className='settings-section bg-theme-surface p-6 rounded-lg border border-theme'>
      <div className='flex justify-between items-center mb-6'>
        <h3 className='section-title text-xl font-semibold text-theme-primary select-none'>
          Advanced Settings
        </h3>

        <IconButton
          icon={RefreshIcon}
          iconClassName={`w-6 h-6 select-none ${isAnimatingReset ? 'animate-rotate-180-once' : ''}`}
          className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          onClick={handleResetClick}
          disabled={isAtDefaults}
          ariaLabel='Reset settings to configuration defaults'
          title='Reset settings to configuration defaults'
        />
      </div>

      <div className='form-group mb-6'>
        <label
          htmlFor={`${platform.id}-settings-model-selector`}
          className='block mb-3 text-base font-medium text-theme-secondary select-none'
        >
          Model to Configure
        </label>
        <div className='inline-block'>
        <CustomSelect
          id={`${platform.id}-settings-model-selector`}
          options={models.map((model) => ({ id: model.id, name: model.id }))}
          selectedValue={selectedModelId}
          onChange={handleModelChange}
          placeholder='Select Model'
          disabled={models.length === 0 || isSaving || isResetting}
        />
        </div>
      </div>

      <form onSubmit={handleSubmit} className='model-advanced-settings' noValidate>
        {modelConfig?.thinking?.toggleable && (
          <div className='mode-toggle-container flex gap-2 mb-6'>
            <button
              type='button'
              className={`px-4 py-2 rounded-md ${currentEditingMode === 'base' ? 'bg-primary text-white' : 'bg-theme-hover text-theme-secondary'}`}
              onClick={() => setCurrentEditingMode('base')}
              aria-pressed={currentEditingMode === 'base'}
            >
              Base Settings
            </button>
            <button
              type='button'
              className={`px-4 py-2 rounded-md ${currentEditingMode === 'thinking' ? 'bg-primary text-white' : 'bg-theme-hover text-theme-secondary'}`}
              onClick={() => setCurrentEditingMode('thinking')}
              aria-pressed={currentEditingMode === 'thinking'}
            >
              Thinking Settings
            </button>
          </div>
        )}
        {/* Model specifications */}
        <div className='model-specs-section p-4 bg-theme-hover rounded-md border border-theme mb-8'>
          <h4 className='specs-title text-base font-semibold mb-3 text-theme-primary select-none'>
            Model Specifications
          </h4>
          <div className='specs-info space-y-2.5'>
            <div className='spec-item flex justify-between text-sm'>
              <span className='spec-label font-medium text-theme-secondary select-none'>
                Context window
              </span>
              <span className='spec-value font-mono select-none'>
                {displaySpecs.contextWindow?.toLocaleString() ?? 'N/A'} tokens
              </span>
            </div>
            {displaySpecs.inputPrice !== undefined && (
              <div className='spec-item flex justify-between text-sm'>
                <span className='spec-label font-medium text-theme-secondary select-none'>
                  Input tokens
                </span>
                <span className='spec-value font-mono select-none'>
                  {Math.abs(displaySpecs.inputPrice) < 0.0001
                    ? 'Free'
                    : `$${formatPrice(displaySpecs.inputPrice)} per 1M tokens`}
                </span>
              </div>
            )}
            {displaySpecs.outputPrice !== undefined && (
              <div className='spec-item flex justify-between text-sm'>
                <span className='spec-label font-medium text-theme-secondary select-none'>
                  Output tokens
                </span>
                <span className='spec-value font-mono select-none'>
                  {Math.abs(displaySpecs.outputPrice) < 0.0001
                    ? 'Free'
                    : `$${formatPrice(displaySpecs.outputPrice)} per 1M tokens`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Max tokens setting */}
        <div className='mb-7'>
          <div className='mb-2'>
            <span className='block mb-3 text-base font-semibold text-theme-secondary select-none'>
              Max Tokens
            </span>
          </div>
          <p className='help-text text-sm text-theme-secondary mb-3 select-none'>
            Maximum number of tokens to generate in the response.
          </p>
          <SliderInput
            label=''
            value={formValues?.maxTokens}
            onChange={(newValue) => handleChange('maxTokens', newValue)}
            min={1}
            max={displaySpecs.maxOutputTokens ?? 1}
            step={1}
            disabled={isSaving || isResetting}
            className='form-group'
          />
        </div>

        {/* Temperature setting (if supported) */}
        {modelConfig?.capabilities?.supportsTemperature !== false && (
          <div className='form-group mb-7'>
            {/* Temperature Toggle - Always visible */}
            <div className='mb-3 flex items-center'>
              <span className='text-base font-semibold text-theme-secondary mr-3 select-none'>
                Temperature
              </span>
              <Toggle
                checked={formValues.includeTemperature}
                onChange={(newCheckedState) =>
                  handleChange('includeTemperature', newCheckedState)
                }
                disabled={isSaving || isResetting}
                id={`${platform.id}-${selectedModelId}-include-temperature`}
              />
            </div>

            {/* Help text - Always visible */}
            <p className='help-text text-sm text-theme-secondary mb-3 select-none'>
              Controls randomness: lower values are more deterministic, higher
              values more creative.
            </p>

            {/* Conditionally render Temperature Slider */}
            {formValues.includeTemperature && (
              <SliderInput
                label=''
                value={formValues.temperature}
                onChange={(newValue) => handleChange('temperature', newValue)}
            min={platform.apiConfig?.temperature?.min}
            max={platform.apiConfig?.temperature?.max}
                step={0.01}
                disabled={isSaving || isResetting}
                className='form-group mt-2'
              />
            )}
          </div>
        )}

        {/* Top P setting (if supported) */}
        {modelConfig?.capabilities?.supportsTopP === true && (
          <div className='form-group mb-7'>
            {/* Top P Toggle - Always visible */}
            <div className='mb-3 flex items-center'>
              <span className='text-base font-semibold text-theme-secondary mr-3 select-none'>
                Top P
              </span>
              <Toggle
                checked={formValues.includeTopP}
                onChange={(newCheckedState) =>
                  handleChange('includeTopP', newCheckedState)
                }
                disabled={isSaving || isResetting}
                id={`${platform.id}-${selectedModelId}-include-topp`}
              />
            </div>

            {/* Help text - Always visible */}
            <p className='help-text text-sm text-theme-secondary mb-3 select-none'>
              Alternative to temperature, controls diversity via nucleus
              sampling.
            </p>

            {/* Conditionally render Top P Slider */}
            {formValues.includeTopP && (
              <SliderInput
                label=''
                value={formValues.topP}
                onChange={(newValue) => handleChange('topP', newValue)}
            min={platform.apiConfig?.topP?.min}
            max={platform.apiConfig?.topP?.max}
                step={0.01}
                disabled={isSaving || isResetting}
                className='form-group mt-2'
              />
            )}
          </div>
        )}

        {/* Warning for using both Temp and TopP */}
        {modelConfig?.capabilities?.supportsTemperature !== false &&
          modelConfig?.capabilities?.supportsTopP === true &&
          formValues.includeTemperature &&
          formValues.includeTopP && (
            <p className='text-amber-600 text-sm -mt-4 mb-10 select-none'>
              It is generally recommended to alter Temperature or Top P, but not
              both.
            </p>
          )}

        {/* System prompt (if supported) */}
        {platform.apiConfig?.apiStructure?.supportsSystemPrompt !== false &&
          modelConfig?.capabilities?.supportsSystemPrompt !== false && (
            <div className='form-group mb-4'>
              <label
                htmlFor={`${platform.id}-${selectedModelId}-system-prompt`}
                className='block mb-3 text-base font-semibold text-theme-secondary select-none'
              >
                System Prompt
              </label>
              <p className='help-text text-sm text-theme-secondary mb-4 select-none'>
                Optional system prompt to provide context for API requests.
              </p>
              <textarea
                id={`${platform.id}-${selectedModelId}-system-prompt`}
                name='systemPrompt'
                className='system-prompt-input w-full min-h-[120px] p-3 bg-gray-50 dark:bg-gray-700 text-sm text-theme-primary border border-theme rounded-md'
                placeholder='Enter a system prompt for API requests'
                value={formValues.systemPrompt}
                onChange={(e) => handleChange('systemPrompt', e.target.value)}
                disabled={isSaving || isResetting}
              />
            </div>
          )}

        <div className='form-actions flex justify-end'>
          <Button
            type='submit'
            disabled={isSaving || !hasChanges}
            variant={!hasChanges ? 'inactive' : 'primary'}
            className='px-5 py-2 select-none'
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
};

AdvancedSettings.propTypes = {
  platform: PropTypes.object.isRequired,
  selectedModelId: PropTypes.string,
  advancedSettings: PropTypes.object.isRequired,
  onModelSelect: PropTypes.func.isRequired,
  onSettingsUpdate: PropTypes.func.isRequired,
  onResetToDefaults: PropTypes.func.isRequired,
};

export default React.memo(AdvancedSettings);

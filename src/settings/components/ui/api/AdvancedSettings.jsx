import React, { useState, useEffect } from 'react';
import { Button, useNotification, SliderInput, Toggle, StatusMessage } from '../../../../components';

const AdvancedSettings = ({
  platform,
  selectedModelId,
  advancedSettings,
  onModelSelect,
  onSettingsUpdate
}) => {
  const { error } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAtDefaults, setIsAtDefaults] = useState(true);
  const models = platform.apiConfig?.models || [];

  // Get model config for selected model
  const modelConfig = models.find(m => m.id === selectedModelId);

  // Get settings for this model
  const getModelSettings = () => {
    if (!selectedModelId || selectedModelId === 'default') {
      return advancedSettings.default || {};
    }
    return advancedSettings.models?.[selectedModelId] || {};
  };

  const settings = getModelSettings();

  // Get default settings from model config
  const getDefaultSettings = () => {
    const currentModelConfig = models.find(m => m.id === selectedModelId);

    const defaults = {
      maxTokens: currentModelConfig?.maxTokens !== undefined ? currentModelConfig.maxTokens : 1000,
      contextWindow: currentModelConfig?.contextWindow !== undefined ? currentModelConfig.contextWindow : 16000,
    };

    // Add temperature and its toggle default only if supported
    if (currentModelConfig?.supportsTemperature !== false) {
      defaults.temperature = platform.apiConfig?.temperature !== undefined ? platform.apiConfig.temperature : 0.7;
      defaults.includeTemperature = true; // Default include to true if supported
    }

    // Add topP and its toggle default only if supported
    if (currentModelConfig?.supportsTopP === true) {
      defaults.topP = platform.apiConfig?.topP !== undefined ? platform.apiConfig.topP : 1.0;
      defaults.includeTopP = false; // Default include to false if supported
    }

    // Add systemPrompt only if the platform supports it
    if (platform.apiConfig?.hasSystemPrompt !== false) {
      defaults.systemPrompt = ''; // Default is always empty string
    }

    return defaults;
  };

  const defaultSettings = getDefaultSettings();

  // Form state with proper initialization including new toggles
  const [formValues, setFormValues] = useState({
    maxTokens: settings.maxTokens ?? defaultSettings.maxTokens,
    temperature: settings.temperature ?? defaultSettings.temperature,
    topP: settings.topP ?? defaultSettings.topP,
    contextWindow: settings.contextWindow ?? defaultSettings.contextWindow,
    systemPrompt: settings.systemPrompt ?? '',
    includeTemperature: settings.includeTemperature ?? true, // Default to true
    includeTopP: settings.includeTopP ?? false,      // Default to false
  });

  // Original values reference for comparison
  const [originalValues, setOriginalValues] = useState({...formValues});

  // Check if current form values match default settings for the selected model
  const checkIfAtDefaults = (formVals) => {
    const modelDefaults = getDefaultSettings(); // Get defaults for the current model
    const currentModelConfig = models.find(m => m.id === selectedModelId); // Get config for checks

    // Compare maxTokens
    if (!('maxTokens' in formVals) || formVals.maxTokens !== modelDefaults.maxTokens) {
      return false;
    }

    // Compare temperature only if supported
    if (currentModelConfig?.supportsTemperature !== false) {
      if (!('temperature' in formVals) || !('temperature' in modelDefaults) || formVals.temperature !== modelDefaults.temperature) {
        return false;
      }
      // Compare includeTemperature (default is true if supported)
      if (formVals.includeTemperature !== (modelDefaults.includeTemperature ?? true)) {
        return false;
      }
    }

    // Compare topP only if supported
    if (currentModelConfig?.supportsTopP === true) {
       if (!('topP' in formVals) || !('topP' in modelDefaults) || formVals.topP !== modelDefaults.topP) {
        return false;
      }
       // Compare includeTopP (default is false if supported)
       if (formVals.includeTopP !== (modelDefaults.includeTopP ?? false)) {
        return false;
      }
    }

    // Compare systemPrompt only if supported
    if (platform.apiConfig?.hasSystemPrompt !== false) {
      if (!('systemPrompt' in formVals) || formVals.systemPrompt.trim() !== '') {
        return false;
      }
    }

    // If all relevant checks pass, values are at defaults
    return true;
  };

  // Update form values when selected model or settings change
  useEffect(() => {
    const currentSettings = getModelSettings();
    const modelDefaults = getDefaultSettings();

    const newFormValues = {
      maxTokens: currentSettings.maxTokens ?? modelDefaults.maxTokens,
      temperature: currentSettings.temperature ?? modelDefaults.temperature,
      topP: currentSettings.topP ?? modelDefaults.topP,
      contextWindow: currentSettings.contextWindow ?? modelDefaults.contextWindow,
      systemPrompt: currentSettings.systemPrompt ?? '',
      includeTemperature: currentSettings.includeTemperature ?? true, // Use ?? true
      includeTopP: currentSettings.includeTopP ?? false,            // Use ?? false
    };

    setFormValues(newFormValues);
    setOriginalValues(newFormValues);
    setHasChanges(false);
    setIsAtDefaults(checkIfAtDefaults(newFormValues));
  }, [selectedModelId, advancedSettings]); // Dependencies remain the same

  // Check if current form values differ from original values
  const checkForChanges = (currentValues, originalVals) => {
    for (const key in currentValues) {
      if (currentValues[key] === undefined && originalVals[key] === undefined) {
        continue;
      }
      if (key === 'contextWindow') { // Skip contextWindow
        continue;
      }
      if (typeof currentValues[key] === 'string' && currentValues[key] !== originalVals[key]) {
        return true;
      }
      if (typeof currentValues[key] === 'number' && !Object.is(currentValues[key], originalVals[key])) {
        return true;
      }
      // Add check for boolean toggles
      if (typeof currentValues[key] === 'boolean' && currentValues[key] !== originalVals[key]) {
        return true;
      }
    }
    return false;
  };

  // Handle changes for all input types including toggles
  const handleChange = (name, newValue) => {
    const updatedValues = { ...formValues };

    if (name === 'maxTokens') {
      const parsedValue = parseInt(newValue, 10);
      updatedValues[name] = isNaN(parsedValue) ? formValues.maxTokens : parsedValue;
    } else if (name === 'temperature' || name === 'topP') {
      const parsedValue = parseFloat(newValue);
      updatedValues[name] = isNaN(parsedValue) ? formValues[name] : parsedValue;
    } else if (name === 'systemPrompt') {
       updatedValues[name] = newValue;
    } else if (name === 'includeTemperature' || name === 'includeTopP') {
       updatedValues[name] = newValue; // Directly use the boolean value
    } else {
       updatedValues[name] = newValue;
    }

    setFormValues(updatedValues);
    setHasChanges(checkForChanges(updatedValues, originalValues));
    setIsAtDefaults(checkIfAtDefaults(updatedValues));
  };

  const handleModelChange = (e) => {
    onModelSelect(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Validations remain mostly the same
      const maxTokensMax = modelConfig?.maxTokens || 32000;
      if (formValues.maxTokens < 1 || formValues.maxTokens > maxTokensMax) {
        throw new Error(`Max tokens must be between 1 and ${maxTokensMax}`);
      }
      if (formValues.temperature !== undefined) {
        const minTemp = platform.apiConfig?.minTemperature ?? 0;
        const maxTemp = platform.apiConfig?.maxTemperature ?? 2;
        if (formValues.temperature < minTemp || formValues.temperature > maxTemp) {
          throw new Error(`Temperature must be between ${minTemp} and ${maxTemp}`);
        }
      }
      if (formValues.topP !== undefined) {
        const minTopP = platform.apiConfig?.minTopP ?? 0;
        const maxTopP = platform.apiConfig?.maxTopP ?? 1;
        if (formValues.topP < minTopP || formValues.topP > maxTopP) {
          throw new Error(`Top P must be between ${minTopP} and ${maxTopP}`);
        }
      }

      // Create settings object including new toggles
      const updateSettings = {};
      if ('maxTokens' in formValues) updateSettings.maxTokens = formValues.maxTokens;
      if ('temperature' in formValues && modelConfig?.supportsTemperature !== false) {
        updateSettings.temperature = formValues.temperature;
      }
      if ('topP' in formValues && modelConfig?.supportsTopP === true) {
        updateSettings.topP = formValues.topP;
      }
      if ('systemPrompt' in formValues && platform.apiConfig?.hasSystemPrompt !== false) {
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
      const success = await onSettingsUpdate(selectedModelId, updateSettings);
      if (!success) {
        throw new Error('Failed to save settings');
      }

      setOriginalValues({...formValues});
      setHasChanges(false);
      setIsAtDefaults(checkIfAtDefaults(formValues));
    } catch (err) {
      console.error('Error saving settings:', err);
      error(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const formatPrice = (price) => {
    return typeof price === 'number' ? price.toFixed(2) : price;
  };

  return (
    <div className="settings-section bg-theme-surface p-6 rounded-lg border border-theme">
      <div className="flex justify-between items-center mb-6">
        <h3 className="section-title text-xl font-semibold text-theme-primary">Advanced Settings</h3>

        <Button
          variant={isAtDefaults ? 'inactive' : 'danger'}
          size="sm"
          disabled={isAtDefaults}
          onClick={() => {
            const defaults = getDefaultSettings();
            const currentModelConfig = models.find(m => m.id === selectedModelId);

            // Construct resetValues including toggles
            const resetValues = {
              maxTokens: defaults.maxTokens,
              contextWindow: defaults.contextWindow,
            };
            if (currentModelConfig?.supportsTemperature !== false && 'temperature' in defaults) {
              resetValues.temperature = defaults.temperature;
              resetValues.includeTemperature = defaults.includeTemperature ?? true; // Reset toggle
            }
            if (currentModelConfig?.supportsTopP === true && 'topP' in defaults) {
              resetValues.topP = defaults.topP;
              resetValues.includeTopP = defaults.includeTopP ?? false; // Reset toggle to false
            }
            if (platform.apiConfig?.hasSystemPrompt !== false && 'systemPrompt' in defaults) {
              resetValues.systemPrompt = defaults.systemPrompt;
            }

            setFormValues(resetValues);
            setOriginalValues(resetValues);
            setHasChanges(false);
            setIsAtDefaults(true);

            onSettingsUpdate(selectedModelId, { __RESET__: true });
          }}
        >
          Reset to Configuration Defaults
        </Button>
      </div>

      <div className="form-group mb-6">
        <label
          htmlFor={`${platform.id}-settings-model-selector`}
          className="block mb-3 text-sm font-medium text-theme-secondary"
        >
          Model to Configure
        </label>
        <div className="inline-block min-w-[200px] max-w-full">
          <select
            id={`${platform.id}-settings-model-selector`}
            className="settings-model-selector w-auto min-w-full p-2 bg-theme-surface text-theme-primary border border-theme rounded-md"
            value={selectedModelId}
            onChange={handleModelChange}
          >
            {models.length > 0 ? (
              models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))
            ) : (
              <option value="default" disabled>
                No models available
              </option>
            )}
          </select>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="model-advanced-settings">
        {/* Model specifications */}
        <div className="model-specs-section p-4 bg-theme-hover rounded-md border border-theme mb-8">
          <h4 className="specs-title text-base font-semibold mb-3 text-theme-primary">Model Specifications</h4>
          <div className="specs-info space-y-2.5">
            <div className="spec-item flex justify-between text-sm">
              <span className="spec-label font-medium text-theme-secondary">Context window</span>
              <span className="spec-value font-mono">
                {formValues.contextWindow?.toLocaleString() || modelConfig?.contextWindow?.toLocaleString() || "16,000"} tokens
              </span>
            </div>
            {modelConfig && modelConfig.inputTokenPrice !== undefined && (
              <div className="spec-item flex justify-between text-sm">
                <span className="spec-label font-medium text-theme-secondary">Input tokens</span>
                <span className="spec-value font-mono">
                  {Math.abs(modelConfig.inputTokenPrice) < 0.0001 ? "Free" : `$${formatPrice(modelConfig.inputTokenPrice)} per 1M tokens`}
                </span>
              </div>
            )}
            {modelConfig && modelConfig.outputTokenPrice !== undefined && (
              <div className="spec-item flex justify-between text-sm">
                <span className="spec-label font-medium text-theme-secondary">Output tokens</span>
                <span className="spec-value font-mono">
                  {Math.abs(modelConfig.outputTokenPrice) < 0.0001 ? "Free" : `$${formatPrice(modelConfig.outputTokenPrice)} per 1M tokens`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Max tokens setting */}
        <div className="mb-7">
          <div className="mb-2">
            <span className="block mb-3 text-sm font-semibold text-theme-secondary">Max Tokens</span>
          </div>
          <p className="help-text text-xs text-theme-secondary mb-3">
            Maximum number of tokens to generate in the response.
          </p>
          <SliderInput
            label=""
            value={formValues.maxTokens}
            onChange={(newValue) => handleChange('maxTokens', newValue)}
            min={1}
            max={modelConfig?.maxTokens}
            step={1}
            disabled={isSaving}
            className="form-group"
          />
        </div>

        {/* Temperature setting (if supported) */}
        {modelConfig?.supportsTemperature !== false && (
          <div className="form-group mb-7">
            {/* Temperature Toggle - Always visible */}
            <div className="mb-3 flex items-center">
              <span className="text-sm font-semibold text-theme-secondary mr-3">Temperature</span>
              <Toggle
                checked={formValues.includeTemperature}
                onChange={(e) => handleChange('includeTemperature', e.target.checked)}
                disabled={isSaving}
                id={`${platform.id}-${selectedModelId}-include-temperature`}
              />
            </div>
            
            {/* Help text - Always visible */}
            <p className="help-text text-xs text-theme-secondary mb-3">
              Controls randomness: lower values are more deterministic, higher values more creative.
            </p>
            
            {/* Conditionally render Temperature Slider */}
            {formValues.includeTemperature && (
              <SliderInput
                label=""
                value={formValues.temperature}
                onChange={(newValue) => handleChange('temperature', newValue)}
                min={platform.apiConfig?.minTemperature ?? 0}
                max={platform.apiConfig?.maxTemperature ?? 2}
                step={0.1}
                disabled={isSaving}
                className="form-group mt-2"
              />
            )}
          </div>
        )}

        {/* Top P setting (if supported) */}
        {modelConfig?.supportsTopP === true && (
          <div className="form-group mb-7">
            {/* Top P Toggle - Always visible */}
            <div className="mb-3 flex items-center">
              <span className="text-sm font-semibold text-theme-secondary mr-3">Top P</span>
              <Toggle
                checked={formValues.includeTopP}
                onChange={(e) => handleChange('includeTopP', e.target.checked)}
                disabled={isSaving}
                id={`${platform.id}-${selectedModelId}-include-topp`}
              />
            </div>
            
            {/* Help text - Always visible */}
            <p className="help-text text-xs text-theme-secondary mb-3">
              Alternative to temperature, controls diversity via nucleus sampling.
            </p>
            
            {/* Conditionally render Top P Slider */}
            {formValues.includeTopP && (
              <SliderInput
                label=""
                value={formValues.topP}
                onChange={(newValue) => handleChange('topP', newValue)}
                min={platform.apiConfig?.minTopP ?? 0}
                max={platform.apiConfig?.maxTopP ?? 1}
                step={0.01}
                disabled={isSaving}
                className="form-group mt-2"
              />
            )}
          </div>
        )}

        {/* Warning for using both Temp and TopP */}
        {modelConfig?.supportsTemperature !== false &&
          modelConfig?.supportsTopP === true &&
          formValues.includeTemperature &&
          formValues.includeTopP && (
            <p className="text-amber-600 text-xs -mt-4 mb-10">
              It is generally recommended to alter Temperature or Top P, but not both.
            </p>
        )}

        {/* System prompt (if supported) */}
        {platform.apiConfig?.hasSystemPrompt !== false && modelConfig?.supportsSystemPrompt !== false && (
          <div className="form-group mb-8">
            <label
              htmlFor={`${platform.id}-${selectedModelId}-system-prompt`}
              className="block mb-3 text-sm font-semibold text-theme-secondary"
            >
              System Prompt
            </label>
            <p className="help-text text-xs text-theme-secondary mb-4">
              Optional system prompt to provide context for API requests.
            </p>
            <textarea
              id={`${platform.id}-${selectedModelId}-system-prompt`}
              name="systemPrompt"
              className="system-prompt-input w-full min-h-[120px] p-3 bg-theme-surface text-theme-primary border border-theme rounded-md"
              placeholder="Enter a system prompt for API requests"
              value={formValues.systemPrompt}
              onChange={(e) => handleChange('systemPrompt', e.target.value)}
            />
          </div>
        )}

        <div className="form-actions flex justify-end mt-8">
          <Button
            type="submit"
            disabled={isSaving || !hasChanges}
            variant={!hasChanges ? 'inactive' : 'primary'}
            className="px-5 py-2"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdvancedSettings;
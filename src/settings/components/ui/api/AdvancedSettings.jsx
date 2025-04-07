import React, { useState, useEffect } from 'react';
import { Button, useNotification, SliderInput } from '../../../../components';

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
    // Get model config again or ensure it's available in scope if needed
    const currentModelConfig = models.find(m => m.id === selectedModelId);

    const defaults = {
      // Use modelConfig value, fallback only if undefined
      maxTokens: currentModelConfig?.maxTokens !== undefined ? currentModelConfig.maxTokens : 1000,
      contextWindow: currentModelConfig?.contextWindow !== undefined ? currentModelConfig.contextWindow : 16000,
    };

    // Add temperature only if supported by the model, use platform default, fallback if needed
    if (currentModelConfig?.supportsTemperature !== false) {
      // Use platform default, fallback to 0.7 if platform default is somehow missing
      defaults.temperature = platform.apiConfig?.temperature !== undefined ? platform.apiConfig.temperature : 0.7;
    }

    // Add topP only if supported by the model, use platform default, fallback if needed
    if (currentModelConfig?.supportsTopP === true) {
       // Use platform default, fallback to 1.0 if platform default is somehow missing
      defaults.topP = platform.apiConfig?.topP !== undefined ? platform.apiConfig.topP : 1.0;
    }

    // Add systemPrompt only if the platform supports it
    if (platform.apiConfig?.hasSystemPrompt !== false) {
      defaults.systemPrompt = ''; // Default is always empty string
    }

    return defaults;
  };
  
  const defaultSettings = getDefaultSettings();
  
  // Form state with proper initialization
  const [formValues, setFormValues] = useState({
    maxTokens: settings.maxTokens || defaultSettings.maxTokens,
    temperature: settings.temperature || defaultSettings.temperature,
    topP: settings.topP || defaultSettings.topP,
    contextWindow: settings.contextWindow || defaultSettings.contextWindow,
    systemPrompt: settings.systemPrompt || ''
  });
  
  // Original values reference for comparison
  const [originalValues, setOriginalValues] = useState({...formValues});
  
  // Check if current form values match default settings for the selected model
  const checkIfAtDefaults = (formVals) => {
    const modelDefaults = getDefaultSettings(); // Get defaults for the current model
    const currentModelConfig = models.find(m => m.id === selectedModelId); // Get config for checks

    // Compare maxTokens (strict equality)
    // Ensure the key exists in formVals before comparing
    if (!('maxTokens' in formVals) || formVals.maxTokens !== modelDefaults.maxTokens) {
      return false;
    }

    // Compare temperature only if supported (strict equality)
    if (currentModelConfig?.supportsTemperature !== false) {
      // Ensure both have the key before comparing
      if (!('temperature' in formVals) || !('temperature' in modelDefaults) || formVals.temperature !== modelDefaults.temperature) {
        return false;
      }
    }

    // Compare topP only if supported (strict equality)
    if (currentModelConfig?.supportsTopP === true) {
      // Ensure both have the key before comparing
       if (!('topP' in formVals) || !('topP' in modelDefaults) || formVals.topP !== modelDefaults.topP) {
        return false;
      }
    }

    // Compare systemPrompt only if supported (check against default empty string)
    if (platform.apiConfig?.hasSystemPrompt !== false) {
      // Default is '', compare trimmed form value to ''
      // Ensure the key exists in formVals before comparing
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
      maxTokens: currentSettings.maxTokens || modelDefaults.maxTokens,
      temperature: currentSettings.temperature !== undefined ? currentSettings.temperature : modelDefaults.temperature,
      topP: currentSettings.topP !== undefined ? currentSettings.topP : modelDefaults.topP,
      contextWindow: currentSettings.contextWindow || modelDefaults.contextWindow,
      systemPrompt: currentSettings.systemPrompt || ''
    };
    
    setFormValues(newFormValues);
    setOriginalValues(newFormValues);
    setHasChanges(false);
    
    // Check if values are already at defaults
    setIsAtDefaults(checkIfAtDefaults(newFormValues));
  }, [selectedModelId, advancedSettings]);
  
  // Check if current form values differ from original values
  const checkForChanges = (currentValues, originalVals) => {
    // Check properties that exist in both objects
    for (const key in currentValues) {
      // Skip comparing undefined values
      if (currentValues[key] === undefined && originalVals[key] === undefined) {
        continue;
      }
      
      // Skip contextWindow as it's no longer editable
      if (key === 'contextWindow') {
        continue;
      }
      
      // For strings (like system prompt), check if they differ
      if (typeof currentValues[key] === 'string' && currentValues[key] !== originalVals[key]) {
        return true;
      }
      
      // For numbers, check if they differ
      if (typeof currentValues[key] === 'number' && 
          (!Object.is(currentValues[key], originalVals[key]))) {
        return true;
      }
    }
    
    return false;
  };

  // Refactored handleChange to accept name and newValue directly
  const handleChange = (name, newValue) => {
    // Calculate the next state based on the current state and the change
    const updatedValues = { ...formValues };

    if (name === 'maxTokens') {
      const parsedValue = parseInt(newValue, 10);
      // Revert to current value in state if parsing fails (e.g., empty input)
      updatedValues[name] = isNaN(parsedValue) ? formValues.maxTokens : parsedValue;
    } else if (name === 'temperature' || name === 'topP') {
      const parsedValue = parseFloat(newValue);
      // Revert to current value in state if parsing fails
      updatedValues[name] = isNaN(parsedValue) ? formValues[name] : parsedValue;
    } else if (name === 'systemPrompt') {
       updatedValues[name] = newValue; // Directly use the string value
    } else {
       // Handle potential other fields if necessary
       updatedValues[name] = newValue;
    }

    // Update form state *first*
    setFormValues(updatedValues);

    // *Then* update dependent states using the calculated `updatedValues`
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
      // Validate inputs
      const maxTokensMax = modelConfig?.maxTokens || 32000;
      // *** MODIFIED LINE: Changed minimum check from 0 to 1 ***
      if (formValues.maxTokens < 1 || formValues.maxTokens > maxTokensMax) { 
        // *** MODIFIED LINE: Updated error message ***
        throw new Error(`Max tokens must be between 1 and ${maxTokensMax}`); 
      }
      
      // Only validate temperature and topP if they exist in the form values
      if (formValues.temperature !== undefined) {
        const minTemp = platform.apiConfig?.minTemperature ?? 0; // Read from platform
        const maxTemp = platform.apiConfig?.maxTemperature ?? 2; // Read from platform
        if (formValues.temperature < minTemp || formValues.temperature > maxTemp) {
          throw new Error(`Temperature must be between ${minTemp} and ${maxTemp}`);
        }
      }
      
      if (formValues.topP !== undefined) {
        const minTopP = platform.apiConfig?.minTopP ?? 0; // Use platform value or default
        const maxTopP = platform.apiConfig?.maxTopP ?? 1; // Use platform value or default
        if (formValues.topP < minTopP || formValues.topP > maxTopP) {
          throw new Error(`Top P must be between ${minTopP} and ${maxTopP}`);
        }
      }
      
      // Create settings object with only the fields that exist in formValues
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
      
      // Save settings
      const success = await onSettingsUpdate(selectedModelId, updateSettings);
      
      if (!success) {
        throw new Error('Failed to save settings');
      }
      
      // Update original values after successful save
      setOriginalValues({...formValues});
      setHasChanges(false);
      
      // Update defaults check
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
            // No need to check !isAtDefaults, button is disabled if true
            const defaults = getDefaultSettings();
            const currentModelConfig = models.find(m => m.id === selectedModelId);

            // Construct resetValues based on defaults and what's supported
            const resetValues = {
              maxTokens: defaults.maxTokens,
              contextWindow: defaults.contextWindow, // Keep context window from defaults
              // Only include supported fields that are present in defaults
            };
            if (currentModelConfig?.supportsTemperature !== false && 'temperature' in defaults) {
              resetValues.temperature = defaults.temperature;
            }
            if (currentModelConfig?.supportsTopP === true && 'topP' in defaults) {
              resetValues.topP = defaults.topP;
            }
            if (platform.apiConfig?.hasSystemPrompt !== false && 'systemPrompt' in defaults) {
              resetValues.systemPrompt = defaults.systemPrompt; // Should be '' from getDefaultSettings
            }

            // Update local state immediately
            setFormValues(resetValues);
            setOriginalValues(resetValues); // Reset original values as well
            setHasChanges(false);
            setIsAtDefaults(true); // We just reset to defaults

            // Signal parent component to reset settings for this model
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
          Configure Settings For:
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
        {/* Model specifications - pricing and context window */}
        <div className="model-specs-section p-4 bg-theme-hover rounded-md border border-theme mb-8">
          <h4 className="specs-title text-base font-semibold mb-3 text-theme-primary">Model Specifications</h4>
          <div className="specs-info space-y-2.5">
            {/* Context window info (now display-only) */}
            <div className="spec-item flex justify-between text-sm">
              <span className="spec-label font-medium text-theme-secondary">Context window:</span>
              <span className="spec-value font-mono">
                {formValues.contextWindow?.toLocaleString() || modelConfig?.contextWindow?.toLocaleString() || "16,000"} tokens
              </span>
            </div>
            
            {/* Token pricing info */}
            {modelConfig && modelConfig.inputTokenPrice !== undefined && (
              <div className="spec-item flex justify-between text-sm">
                <span className="spec-label font-medium text-theme-secondary">Input tokens:</span>
                <span className="spec-value font-mono">
                  {Math.abs(modelConfig.inputTokenPrice) < 0.0001 ? "Free" : `$${formatPrice(modelConfig.inputTokenPrice)} per 1M tokens`}
                </span>
              </div>
            )}
            
            {modelConfig && modelConfig.outputTokenPrice !== undefined && (
              <div className="spec-item flex justify-between text-sm">
                <span className="spec-label font-medium text-theme-secondary">Output tokens:</span>
                <span className="spec-value font-mono">
                  {Math.abs(modelConfig.outputTokenPrice) < 0.0001 ? "Free" : `$${formatPrice(modelConfig.outputTokenPrice)} per 1M tokens`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Max tokens setting - Replaced with SliderInput */}
        <div className="mb-7">
          <SliderInput
            label={platform.id === 'chatgpt' || platform.id === 'grok' ? 'Max Completion Tokens:' : 'Max Tokens:'}
            value={formValues.maxTokens}
            onChange={(newValue) => handleChange('maxTokens', newValue)}
            // *** MODIFIED LINE: Changed min from 0 to 1 ***
            min={1} 
            max={modelConfig?.maxTokens || 32000}
            step={1}
            disabled={isSaving}
            className="form-group"
          />
          <p className="help-text text-xs text-theme-secondary mt-2">
            Maximum number of tokens to generate in the response.
          </p>
        </div>

        {/* Temperature setting (if supported) - Replaced with SliderInput */}
        {modelConfig?.supportsTemperature !== false && (
          <div className="mb-7">
            <SliderInput
              label="Temperature:"
              value={formValues.temperature}
              onChange={(newValue) => handleChange('temperature', newValue)}
              min={platform.apiConfig?.minTemperature ?? 0}
              max={platform.apiConfig?.maxTemperature ?? 2}
              step={0.1}
              disabled={isSaving}
              className="form-group"
            />
            <p className="help-text text-xs text-theme-secondary mt-2">
              Controls randomness: lower values are more deterministic, higher values more creative.
            </p>
          </div>
        )}

        {/* Top P setting (if supported) - Replaced with SliderInput */}
        {modelConfig?.supportsTopP === true && (
          <div className="mb-7">
            <SliderInput
              label="Top P:"
              value={formValues.topP}
              onChange={(newValue) => handleChange('topP', newValue)}
              min={platform.apiConfig?.minTopP ?? 0}
              max={platform.apiConfig?.maxTopP ?? 1}
              step={0.01}
              disabled={isSaving}
              className="form-group"
            />
            <p className="help-text text-xs text-theme-secondary mt-2">
              Alternative to temperature, controls diversity via nucleus sampling.
            </p>
          </div>
        )}

        {/* System prompt (if supported by platform AND model) */}
        {platform.apiConfig?.hasSystemPrompt !== false && modelConfig?.supportsSystemPrompt !== false && (
          <div className="form-group mb-8">
            <label
              htmlFor={`${platform.id}-${selectedModelId}-system-prompt`}
              className="block mb-3 text-sm font-semibold text-theme-secondary"
            >
              System Prompt:
            </label>
            <textarea
              id={`${platform.id}-${selectedModelId}-system-prompt`}
              name="systemPrompt"
              className="system-prompt-input w-full min-h-[120px] p-3 bg-theme-surface text-theme-primary border border-theme rounded-md"
              placeholder="Enter a system prompt for API requests"
              value={formValues.systemPrompt}
              onChange={(e) => handleChange('systemPrompt', e.target.value)}
            />
            <p className="help-text text-xs text-theme-secondary mt-2">
              Optional system prompt to provide context for API requests.
            </p>
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

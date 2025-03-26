import React, { useState, useEffect } from 'react';
import { Button, useNotification } from '../../../../components';

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
  const [isAtDefaults, setIsAtDefaults] = useState(false);
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
    if (!modelConfig) {
      return {
        maxTokens: 1000,
        temperature: 0.7,
        topP: 1.0,
        contextWindow: 16000
      };
    }
    
    // Extract default values from model config
    const defaults = {
      maxTokens: modelConfig.maxTokens || 1000,
      contextWindow: modelConfig.contextWindow || 16000
    };
    
    // Add temperature if supported
    if (modelConfig.supportsTemperature !== false) {
      defaults.temperature = modelConfig.temperature || 0.7;
    }
    
    // Add top_p if supported
    if (modelConfig.supportsTopP === true) {
      defaults.topP = modelConfig.topP || 1.0;
    }
    
    // This ensures complete parameter reset during configuration reversion
    if (platform.apiConfig?.hasSystemPrompt !== false) {
      defaults.systemPrompt = '';
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
  
  // Check if current form values match default settings
  const checkIfAtDefaults = (formVals) => {
    const modelDefaults = getDefaultSettings();
    
    // Check each property that should be compared
    if (formVals.maxTokens !== modelDefaults.maxTokens) return false;
    
    // Only check temperature if it exists in both objects
    if ('temperature' in formVals && 'temperature' in modelDefaults) {
      if (formVals.temperature !== modelDefaults.temperature) return false;
    }
    
    // Only check topP if it exists in both objects
    if ('topP' in formVals && 'topP' in modelDefaults) {
      if (formVals.topP !== modelDefaults.topP) return false;
    }
    
    // Check if system prompt is empty (default state)
    if (formVals.systemPrompt && formVals.systemPrompt.trim() !== '') return false;
    
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
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Create updated values to check for changes
    let updatedValues = {...formValues};
    
    // Convert numeric values
    if (['maxTokens'].includes(name)) {
      updatedValues = {
        ...updatedValues,
        [name]: parseInt(value, 10) || 0
      };
    } else if (['temperature', 'topP'].includes(name)) {
      updatedValues = {
        ...updatedValues,
        [name]: parseFloat(value) || 0
      };
    } else {
      updatedValues = {
        ...updatedValues,
        [name]: value
      };
    }
    
    // Update form values
    setFormValues(updatedValues);
    
    // Check if values have changed from original
    setHasChanges(checkForChanges(updatedValues, originalValues));
    
    // Check if current values match defaults
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
      if (formValues.maxTokens < 0 || formValues.maxTokens > maxTokensMax) {
        throw new Error(`Max tokens must be between 0 and ${maxTokensMax}`);
      }
      
      // Only validate temperature and topP if they exist in the form values
      if (formValues.temperature !== undefined) {
        const minTemp = modelConfig?.minTemperature !== undefined ? modelConfig.minTemperature : 0;
        const maxTemp = modelConfig?.maxTemperature !== undefined ? modelConfig.maxTemperature : 2;
        if (formValues.temperature < minTemp || formValues.temperature > maxTemp) {
          throw new Error(`Temperature must be between ${minTemp} and ${maxTemp}`);
        }
      }
      
      if (formValues.topP !== undefined) {
        if (formValues.topP < 0 || formValues.topP > 1) {
          throw new Error('Top P must be between 0 and 1');
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
    <div className="settings-section bg-theme-surface p-5 rounded-lg border border-theme">
      <div className="flex justify-between items-center mb-4">
        <h4 className="section-subtitle text-lg font-medium">Advanced Settings</h4>
        
        <Button
          variant={isAtDefaults ? "inactive" : "danger"}
          size="sm"
          disabled={isAtDefaults}
          onClick={() => {
            if (!isAtDefaults) {
              // Immediately update form values to defaults
              const defaults = getDefaultSettings();
              setFormValues({
                maxTokens: defaults.maxTokens,
                temperature: defaults.temperature,
                topP: defaults.topP,
                contextWindow: defaults.contextWindow,
                systemPrompt: ''
              });
              
              // Update state tracking
              setOriginalValues({
                maxTokens: defaults.maxTokens,
                temperature: defaults.temperature,
                topP: defaults.topP,
                contextWindow: defaults.contextWindow,
                systemPrompt: ''
              });
              setHasChanges(false);
              setIsAtDefaults(true);
              
              // Signal complete removal of custom settings for this model
              // by passing a special '__RESET__' action parameter
              onSettingsUpdate(selectedModelId, { __RESET__: true });
            }
          }}
        >
          Reset to Configuration Defaults
        </Button>
      </div>
      
      <div className="form-group mb-4">
        <label 
          htmlFor={`${platform.id}-settings-model-selector`}
          className="block mb-2 text-sm font-medium text-theme-secondary"
        >
          Configure Settings For:
        </label>
        <select
          id={`${platform.id}-settings-model-selector`}
          className="settings-model-selector w-full p-2 bg-theme-surface text-theme-primary border border-theme rounded-md"
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
      
      <form onSubmit={handleSubmit} className="model-advanced-settings">
        {/* Model specifications - pricing and context window */}
        <div className="model-specs-section p-3 bg-theme-hover rounded-md border border-theme mb-6">
          <h5 className="specs-title text-sm font-medium mb-2">Model Specifications</h5>
          <div className="specs-info space-y-1.5">
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
        
        {/* Max tokens setting */}
        <div className="form-group mb-4">
          <label 
            htmlFor={`${platform.id}-${selectedModelId}-max-tokens`}
            className="block mb-2 text-sm font-medium text-theme-secondary"
          >
            {platform.id === 'chatgpt' || platform.id === 'grok' ? 'Max Completion Tokens:' : 'Max Tokens:'}
          </label>
          <input
            type="number"
            id={`${platform.id}-${selectedModelId}-max-tokens`}
            name="maxTokens"
            className="settings-input w-32 px-3 py-2 bg-theme-surface text-theme-primary border border-theme rounded-md"
            value={formValues.maxTokens}
            onChange={handleChange}
            min={0}
            max={modelConfig?.maxTokens || 32000}
          />
          <p className="help-text text-xs text-theme-secondary mt-1">
            Maximum number of tokens to generate in the response.
          </p>
        </div>
        
        {/* Temperature setting (if supported) */}
        {modelConfig?.supportsTemperature !== false && (
          <div className="form-group mb-4">
            <label 
              htmlFor={`${platform.id}-${selectedModelId}-temperature`}
              className="block mb-2 text-sm font-medium text-theme-secondary"
            >
              Temperature:
            </label>
            <input
              type="number"
              id={`${platform.id}-${selectedModelId}-temperature`}
              name="temperature"
              className="settings-input w-32 px-3 py-2 bg-theme-surface text-theme-primary border border-theme rounded-md"
              value={formValues.temperature}
              onChange={handleChange}
              min={modelConfig?.minTemperature !== undefined ? modelConfig.minTemperature : 0}
              max={modelConfig?.maxTemperature !== undefined ? modelConfig.maxTemperature : 2}
              step={0.1}
            />
            <p className="help-text text-xs text-theme-secondary mt-1">
              Controls randomness: lower values are more deterministic, higher values more creative.
            </p>
          </div>
        )}
        
        {/* Top P setting (if supported) */}
        {modelConfig?.supportsTopP === true && (
          <div className="form-group mb-4">
            <label 
              htmlFor={`${platform.id}-${selectedModelId}-top-p`}
              className="block mb-2 text-sm font-medium text-theme-secondary"
            >
              Top P:
            </label>
            <input
              type="number"
              id={`${platform.id}-${selectedModelId}-top-p`}
              name="topP"
              className="settings-input w-32 px-3 py-2 bg-theme-surface text-theme-primary border border-theme rounded-md"
              value={formValues.topP}
              onChange={handleChange}
              min={0}
              max={1}
              step={0.01}
            />
            <p className="help-text text-xs text-theme-secondary mt-1">
              Alternative to temperature, controls diversity via nucleus sampling.
            </p>
          </div>
        )}
        
        {/* System prompt (if supported) */}
        {platform.apiConfig?.hasSystemPrompt !== false && (
          <div className="form-group mb-4">
            <label 
              htmlFor={`${platform.id}-${selectedModelId}-system-prompt`}
              className="block mb-2 text-sm font-medium text-theme-secondary"
            >
              System Prompt:
            </label>
            <textarea
              id={`${platform.id}-${selectedModelId}-system-prompt`}
              name="systemPrompt"
              className="system-prompt-input w-full min-h-[100px] p-2 bg-theme-surface text-theme-primary border border-theme rounded-md"
              placeholder="Enter a system prompt for API requests"
              value={formValues.systemPrompt}
              onChange={handleChange}
            />
            <p className="help-text text-xs text-theme-secondary mt-1">
              Optional system prompt to provide context for API requests.
            </p>
          </div>
        )}
        
        <div className="form-actions flex justify-end">
          <Button
            type="submit"
            disabled={isSaving || !hasChanges}
            variant={!hasChanges ? 'inactive' : 'primary'}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdvancedSettings;
// src/settings/components/ui/api/AdvancedSettings.jsx
import React, { useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  useNotification,
  SliderInput,
  Toggle,
  IconButton,
  RefreshIcon,
  CustomSelect,
} from '../../../../components';
import { useModelAdvancedSettings } from '../../../hooks/useModelAdvancedSettings';

const AdvancedSettings = ({
  platform,
  selectedModelId, // This is the actual model ID string from PlatformDetails
  advancedSettings, // This is advancedSettings[platform.id] from PlatformDetails
  onModelSelect, // Prop from PlatformDetails to update its selectedModelId state
  onSettingsUpdate, // Prop from PlatformDetails (handleAdvancedSettingsUpdate)
  onResetToDefaults, // Prop from PlatformDetails (handleResetAdvancedSettings)
}) => {
  const { error: showNotificationError } = useNotification();
  const [displayableDerivedSettings, setDisplayableDerivedSettings] = useState(null);
  const [displayableSelectedModelId, setDisplayableSelectedModelId] = useState(null);

  const {
    formValues,
    currentEditingMode,
    derivedSettings, // This comes from the hook
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
    // isThinkingModeActive, // Not directly used, currentEditingMode is used
    showTempSection,
    showTopPSection,
    showBudgetSlider,
    showReasoningEffort,
    modelSupportsSystemPrompt,
    modelsFromPlatform,
  } = useModelAdvancedSettings({
    platform,
    selectedModelId, // Pass the prop selectedModelId to the hook
    advancedSettingsFromStorage: advancedSettings,
    onSettingsUpdateProp: onSettingsUpdate,
    onResetToDefaultsProp: onResetToDefaults,
    showNotificationError,
  });

  useEffect(() => {
    // Update displayable settings ONLY when derivedSettings from the hook are stable
    // AND match the current prop selectedModelId.
    if (derivedSettings && selectedModelId && derivedSettings.resolvedModelConfig?.id === selectedModelId) {
      setDisplayableDerivedSettings(derivedSettings);
      setDisplayableSelectedModelId(selectedModelId);
    }
    // If derivedSettings are not yet ready for the current selectedModelId,
    // displayableDerivedSettings will retain its previous value, or remain null if initial.
    // The loading condition below will handle showing "Loading..." if necessary.
  }, [derivedSettings, selectedModelId]);


  const handleModelChange = useCallback(
    (modelId) => {
      onModelSelect(modelId); // Call prop from PlatformDetails
    },
    [onModelSelect]
  );

  const formatPrice = (price) => {
    return typeof price === 'number' ? price.toFixed(2) : price;
  };

  if (!displayableDerivedSettings || (selectedModelId && displayableSelectedModelId !== selectedModelId)) {
    // Show loading if displayable settings are not yet available OR
    // if the selectedModelId prop has changed and displayable settings haven't caught up.
    return (
      <div className='settings-section bg-theme-surface p-6 rounded-lg border border-theme'>
        <p className='text-theme-secondary'>Loading model settings...</p>
      </div>
    );
  }

  // Destructure from displayableDerivedSettings for rendering
  const {
    displaySpecs,
    parameterSpecs,
    // capabilities, // Not directly used here, flags from hook are preferred
    // defaultSettings, // Not directly used here
    // resolvedModelConfig // Not directly used here, flags from hook are preferred
  } = displayableDerivedSettings;


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
          onClick={handleResetClick} // Uses hook's handleResetClick
          disabled={isAtDefaults || isResetting} // Uses hook's isAtDefaults, isResetting
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
            options={modelsFromPlatform.map((model) => ({ // Uses hook's modelsFromPlatform
              id: model.id,
              name: model.id,
            }))}
            selectedValue={selectedModelId} // IMPORTANT: This MUST remain selectedModelId from props
            onChange={handleModelChange} // Uses local handleModelChange
            placeholder='Select Model'
            disabled={modelsFromPlatform.length === 0 || isSaving || isResetting} // Uses hook's modelsFromPlatform, isSaving, isResetting
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className='model-advanced-settings' noValidate> {/* Uses hook's handleSubmit */}
        {showThinkingModeToggle && ( // Uses hook's showThinkingModeToggle
          <div className='mb-6'>
            <div className='flex items-center gap-3'>
              <span className='text-base font-semibold text-theme-secondary select-none'>
                Thinking Mode
              </span>
              <Toggle
                id={`${platform.id}-${selectedModelId}-thinking-mode-toggle`} // Uses selectedModelId from props
                checked={currentEditingMode === 'thinking'} // Uses hook's currentEditingMode
                onChange={toggleEditingMode} // Uses hook's toggleEditingMode
                disabled={isSaving || isResetting} // Uses hook's isSaving, isResetting
              />
            </div>
          </div>
        )}

        <div className='model-specs-section p-4 bg-theme-hover rounded-md border border-theme mb-8'>
          <h4 className='specs-title text-base font-semibold mb-3 text-theme-primary select-none'>
            Model Specifications {currentEditingMode === 'thinking' ? '(Thinking)' : ''} {/* Uses hook's currentEditingMode */}
          </h4>
          <div className='specs-info space-y-2.5'>
            <div className='spec-item flex justify-between text-sm'>
              <span className='spec-label font-medium text-theme-secondary select-none'>
                Context window
              </span>
              <span className='spec-value font-mono select-none'>
                {displaySpecs.contextWindow?.toLocaleString() ?? 'N/A'} tokens {/* Uses displaySpecs from displayableDerivedSettings */}
              </span>
            </div>
            {displaySpecs.inputPrice !== undefined && ( // Uses displaySpecs
              <div className='spec-item flex justify-between text-sm'>
                <span className='spec-label font-medium text-theme-secondary select-none'>
                  Input tokens
                </span>
                <span className='spec-value font-mono select-none'>
                  {Math.abs(displaySpecs.inputPrice) < 0.0001
                    ? 'Free'
                    : `$${formatPrice(displaySpecs.inputPrice)} per 1M tokens`} {/* Uses local formatPrice, displaySpecs */}
                </span>
              </div>
            )}
            {displaySpecs.outputPrice !== undefined && ( // Uses displaySpecs
              <div className='spec-item flex justify-between text-sm'>
                <span className='spec-label font-medium text-theme-secondary select-none'>
                  Output tokens
                </span>
                <span className='spec-value font-mono select-none'>
                  {Math.abs(displaySpecs.outputPrice) < 0.0001
                    ? 'Free'
                    : `$${formatPrice(displaySpecs.outputPrice)} per 1M tokens`} {/* Uses local formatPrice, displaySpecs */}
                </span>
              </div>
            )}
          </div>
        </div>

        {parameterSpecs.maxTokens && ( // Uses parameterSpecs from displayableDerivedSettings
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
              value={formValues?.maxTokens ?? parameterSpecs.maxTokens.min} // Uses hook's formValues, parameterSpecs
              onChange={(newValue) => handleChange('maxTokens', newValue)} // Uses hook's handleChange
              min={parameterSpecs.maxTokens.min} // Uses parameterSpecs
              max={parameterSpecs.maxTokens.max} // Uses parameterSpecs
              step={parameterSpecs.maxTokens.step} // Uses parameterSpecs
              disabled={isSaving || isResetting} // Uses hook's isSaving, isResetting
              className='form-group'
            />
          </div>
        )}

        {showTempSection && parameterSpecs.temperature && ( // Uses hook's showTempSection, parameterSpecs
          <div className='form-group mb-7'>
            <div className='mb-3 flex items-center'>
              <span className='text-base font-semibold text-theme-secondary mr-3 select-none'>
                Temperature
              </span>
              <Toggle
                checked={formValues.includeTemperature ?? true} // Uses hook's formValues
                onChange={(newCheckedState) =>
                  handleChange('includeTemperature', newCheckedState) // Uses hook's handleChange
                }
                disabled={isSaving || isResetting} // Uses hook's isSaving, isResetting
                id={`${platform.id}-${selectedModelId}-include-temperature`} // Uses selectedModelId from props
              />
            </div>
            <p className='help-text text-sm text-theme-secondary mb-3 select-none'>
              Controls randomness: lower values are more deterministic, higher
              values more creative.
            </p>
            {formValues.includeTemperature && ( // Uses hook's formValues
              <SliderInput
                label=''
                value={formValues.temperature ?? parameterSpecs.temperature.min} // Uses hook's formValues, parameterSpecs
                onChange={(newValue) => handleChange('temperature', newValue)} // Uses hook's handleChange
                min={parameterSpecs.temperature.min} // Uses parameterSpecs
                max={parameterSpecs.temperature.max} // Uses parameterSpecs
                step={parameterSpecs.temperature.step} // Uses parameterSpecs
                disabled={isSaving || isResetting} // Uses hook's isSaving, isResetting
                className='form-group mt-2'
              />
            )}
          </div>
        )}

        {showTopPSection && parameterSpecs.topP && ( // Uses hook's showTopPSection, parameterSpecs
          <div className='form-group mb-7'>
            <div className='mb-3 flex items-center'>
              <span className='text-base font-semibold text-theme-secondary mr-3 select-none'>
                Top P
              </span>
              <Toggle
                checked={formValues.includeTopP ?? false} // Uses hook's formValues
                onChange={(newCheckedState) =>
                  handleChange('includeTopP', newCheckedState) // Uses hook's handleChange
                }
                disabled={isSaving || isResetting} // Uses hook's isSaving, isResetting
                id={`${platform.id}-${selectedModelId}-include-topp`} // Uses selectedModelId from props
              />
            </div>
            <p className='help-text text-sm text-theme-secondary mb-3 select-none'>
              Alternative to temperature, controls diversity via nucleus
              sampling.
            </p>
            {formValues.includeTopP && ( // Uses hook's formValues
              <SliderInput
                label=''
                value={formValues.topP ?? parameterSpecs.topP.min} // Uses hook's formValues, parameterSpecs
                onChange={(newValue) => handleChange('topP', newValue)} // Uses hook's handleChange
                min={parameterSpecs.topP.min} // Uses parameterSpecs
                max={parameterSpecs.topP.max} // Uses parameterSpecs
                step={parameterSpecs.topP.step} // Uses parameterSpecs
                disabled={isSaving || isResetting} // Uses hook's isSaving, isResetting
                className='form-group mt-2'
              />
            )}
          </div>
        )}
        
        {showTempSection && showTopPSection && formValues.includeTemperature && formValues.includeTopP && ( // Uses hook flags and formValues
            <p className='text-amber-600 text-sm -mt-4 mb-10 select-none'>
              It is generally recommended to alter Temperature or Top P, but not both.
            </p>
        )}

        {showBudgetSlider && parameterSpecs.thinkingBudget && ( // Uses hook's showBudgetSlider, parameterSpecs
          <div className='form-group mb-7'>
            <span className='block mb-3 text-base font-semibold text-theme-secondary select-none'>
              Thinking Budget
            </span>
            <p className='help-text text-sm text-theme-secondary mb-3 select-none'>
              Maximum tokens the model can use for internal thinking steps.
            </p>
            <SliderInput
              label=''
              value={formValues.thinkingBudget ?? parameterSpecs.thinkingBudget.default} // Uses hook's formValues, parameterSpecs
              onChange={(newValue) => handleChange('thinkingBudget', newValue)} // Uses hook's handleChange
              min={parameterSpecs.thinkingBudget.min} // Uses parameterSpecs
              max={parameterSpecs.thinkingBudget.max} // Uses parameterSpecs
              step={parameterSpecs.thinkingBudget.step} // Uses parameterSpecs
              disabled={isSaving || isResetting} // Uses hook's isSaving, isResetting
              className='form-group mt-2'
            />
          </div>
        )}

        {showReasoningEffort && parameterSpecs.reasoningEffort && ( // Uses hook's showReasoningEffort, parameterSpecs
          <div className='form-group mb-7'>
            <span className='block mb-3 text-base font-semibold text-theme-secondary select-none'>
              Reasoning Effort
            </span>
            <p className='help-text text-sm text-theme-secondary mb-3 select-none'>
              Controls the amount of internal reasoning the model performs.
            </p>
            <div className='inline-block'>
              <CustomSelect
                id={`${platform.id}-${selectedModelId}-reasoning-effort`} // Uses selectedModelId from props
                options={parameterSpecs.reasoningEffort.allowedValues.map(value => ({ id: value, name: value }))} // Uses parameterSpecs
                selectedValue={formValues.reasoningEffort ?? parameterSpecs.reasoningEffort.default} // Uses hook's formValues, parameterSpecs
                onChange={(selectedValue) => handleChange('reasoningEffort', selectedValue)} // Uses hook's handleChange
                placeholder='Select Effort Level'
                disabled={isSaving || isResetting} // Uses hook's isSaving, isResetting
              />
            </div>
          </div>
        )}

        {modelSupportsSystemPrompt && parameterSpecs.systemPrompt && ( // Uses hook's modelSupportsSystemPrompt, parameterSpecs
          <div className='form-group mb-4'>
            <label
              htmlFor={`${platform.id}-${selectedModelId}-system-prompt`} // Uses selectedModelId from props
              className='block mb-3 text-base font-semibold text-theme-secondary select-none'
            >
              System Prompt
            </label>
            <p className='help-text text-sm text-theme-secondary mb-4 select-none'>
              Optional system prompt to provide context for API requests.
            </p>
            <textarea
              id={`${platform.id}-${selectedModelId}-system-prompt`} // Uses selectedModelId from props
              name='systemPrompt'
              className='system-prompt-input w-full min-h-[120px] p-3 bg-gray-50 dark:bg-gray-700 text-sm text-theme-primary border border-theme rounded-md'
              placeholder='Enter a system prompt for API requests'
              value={formValues.systemPrompt ?? ''} // Uses hook's formValues
              onChange={(e) => handleChange('systemPrompt', e.target.value)} // Uses hook's handleChange
              maxLength={parameterSpecs.systemPrompt.maxLength} // Uses parameterSpecs
              disabled={isSaving || isResetting} // Uses hook's isSaving, isResetting
            />
          </div>
        )}

        <div className='form-actions flex justify-end'>
          <Button
            type='submit'
            disabled={isSaving || !hasChanges || isResetting} // Uses hook's isSaving, hasChanges, isResetting
            variant={!hasChanges || isResetting ? 'inactive' : 'primary'} // Uses hook's hasChanges, isResetting
            className='px-5 py-2 select-none'
          >
            {isSaving ? 'Saving...' : 'Save Settings'} {/* Uses hook's isSaving */}
          </Button>
        </div>
      </form>
    </div>
  );
};

AdvancedSettings.propTypes = {
  platform: PropTypes.object.isRequired,
  selectedModelId: PropTypes.string,
  advancedSettings: PropTypes.object, // This is advancedSettings[platform.id]
  onModelSelect: PropTypes.func.isRequired,
  onSettingsUpdate: PropTypes.func.isRequired,
  onResetToDefaults: PropTypes.func.isRequired,
};

export default React.memo(AdvancedSettings);
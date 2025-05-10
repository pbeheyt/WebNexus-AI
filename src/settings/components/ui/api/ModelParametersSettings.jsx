// src/settings/components/ui/api/ModelParametersSettings.jsx
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

import SettingsCard from '../common/SettingsCard';
import {
  Button,
  useNotification,
  SliderInput,
  Toggle,
  IconButton,
  RefreshIcon,
  CustomSelect,
} from '../../../../components';
import { useModelParametersSettings } from '../../../hooks/useModelParametersSettings';
import SelectorSection from '../common/SelectorSection';

const ModelParametersSettings = ({
  platform,
  selectedModelId, 
  modelParametersSettings, 
  onModelSelect, 
  onSettingsUpdate, 
  onResetToDefaults, 
}) => {
  const { error: showNotificationErrorHook } = useNotification();

  const {
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
    modelsFromPlatform,
    isFormReady,
    showThinkingModeToggle,
    showTempSection,
    showTopPSection,
    showBudgetSlider,
    showReasoningEffort,
    modelSupportsSystemPrompt,
  } = useModelParametersSettings({
    platform,
    selectedModelId,
    modelParametersForPlatform: modelParametersSettings,
    onSave: onSettingsUpdate,
    onReset: onResetToDefaults,
    showNotificationError: showNotificationErrorHook,
  });

  const handleModelChange = useCallback(
    (modelId) => {
      onModelSelect(modelId);
    },
    [onModelSelect]
  );

  const formatPrice = (price) => {
    return typeof price === 'number' ? price.toFixed(2) : price;
  };

  if (!derivedSettings || !isFormReady) {
    return (
      <div className='p-5 bg-theme-surface border border-theme rounded-lg mb-6'>
        <p className='text-theme-secondary text-center py-10'>Loading model settings...</p>
      </div>
    );
  }

  const {
    displaySpecs,
    parameterSpecs,
  } = derivedSettings;


  return (
    <>
        <SelectorSection
          title='Model Selection'
          actionElement={
          <IconButton
            icon={RefreshIcon}
            iconClassName={`w-5 h-5 select-none ${isAnimatingReset ? 'animate-rotate-180-once' : ''} ${isResetting ? 'opacity-0' : ''}`}
            className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            onClick={handleResetClick}
            isLoading={isResetting}
            disabled={isAtDefaults || isResetting || isSaving}
            ariaLabel='Reset model parameters to defaults'
            title='Reset model parameters to configuration defaults'
          />
        }
          inlineControl={
            <div className='inline-block'>
              <CustomSelect
                id={`${platform.id}-settings-model-selector`}
                options={modelsFromPlatform.map((model) => ({
                  id: model.id,
                  name: model.id,
                }))}
                selectedValue={selectedModelId}
                onChange={handleModelChange}
                placeholder='Select Model'
                disabled={modelsFromPlatform.length === 0 || isSaving || isResetting}
              />
            </div>
          }
        >
        {showThinkingModeToggle && (
          <div className="mt-4">
            <div className='flex items-center gap-3'>
              <span className='text-sm font-medium text-theme-secondary select-none'>
                Thinking Mode
              </span>
              <Toggle
                id={`${platform.id}-${selectedModelId}-thinking-mode-toggle`}
                checked={currentEditingMode === 'thinking'}
                onChange={toggleEditingMode}
                disabled={isSaving || isResetting}
              />
            </div>
          </div>
        )}
        <div className='model-specs-section bg-theme-hover rounded-lg border border-theme mt-4 p-4'>
          <h4 className='specs-title text-base font-semibold mb-3 text-theme-primary select-none'>
            Model Specifications {currentEditingMode === 'thinking' ? '(Thinking)' : ''}
          </h4>
          <div className='specs-info space-y-2.5'>
            <div className='spec-item flex justify-between text-sm'>
              <span className='spec-label font-medium text-theme-secondary select-none'>
                Context window
              </span>
              <span className='spec-value font-mono select-none text-theme-primary'>
                {displaySpecs.contextWindow?.toLocaleString() ?? 'N/A'} tokens
              </span>
            </div>
            {displaySpecs.inputPrice !== undefined && (
              <div className='spec-item flex justify-between text-sm'>
                <span className='spec-label font-medium text-theme-secondary select-none'>
                  Input tokens
                </span>
                <span className='spec-value font-mono select-none text-theme-primary'>
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
                <span className='spec-value font-mono select-none text-theme-primary'>
                  {Math.abs(displaySpecs.outputPrice) < 0.0001
                    ? 'Free'
                    : `$${formatPrice(displaySpecs.outputPrice)} per 1M tokens`}
                </span>
              </div>
            )}
          </div>
        </div>
      </SelectorSection>

      <form onSubmit={handleSubmit} className='model-advanced-settings' noValidate>

        {parameterSpecs.maxTokens && (
          <SettingsCard className='mb-6'>
            <div className='mb-2'>
              <span className='block mb-3 text-base font-semibold text-theme-primary select-none'>
                Max Tokens
              </span>
            </div>
            <p className='help-text text-sm text-theme-secondary mb-3 select-none'>
              Maximum number of tokens to generate in the response.
            </p>
            <SliderInput
              label=''
              value={formValues?.maxTokens ?? parameterSpecs.maxTokens.min}
              onChange={(newValue) => handleChange('maxTokens', newValue)}
              min={parameterSpecs.maxTokens.min}
              max={parameterSpecs.maxTokens.max}
              step={parameterSpecs.maxTokens.step}
              disabled={isSaving || isResetting}
              className='form-group'
            />
        </SettingsCard>
        )}

        {showTempSection && parameterSpecs.temperature && (
          <SettingsCard className='mb-6'>
            <div className='mb-3 flex items-center'>
              <span className='text-base font-semibold text-theme-primary mr-3 select-none'>
                Temperature
              </span>
              <Toggle
                checked={formValues.includeTemperature ?? true}
                onChange={(newCheckedState) =>
                  handleChange('includeTemperature', newCheckedState)
                }
                disabled={isSaving || isResetting}
                id={`${platform.id}-${selectedModelId}-include-temperature`}
              />
            </div>
            <p className='help-text text-sm text-theme-secondary mb-3 select-none'>
              Controls randomness: lower values are more deterministic, higher
              values more creative.
            </p>
            {formValues.includeTemperature && (
              <SliderInput
                label=''
                value={formValues.temperature ?? parameterSpecs.temperature.min}
                onChange={(newValue) => handleChange('temperature', newValue)}
                min={parameterSpecs.temperature.min}
                max={parameterSpecs.temperature.max}
                step={parameterSpecs.temperature.step}
                disabled={isSaving || isResetting}
                className='form-group mt-2'
              />
            )}
        </SettingsCard>
        )}

        {showTopPSection && parameterSpecs.topP && (
          <SettingsCard className='mb-6'>
            <div className='mb-3 flex items-center'>
              <span className='text-base font-semibold text-theme-primary mr-3 select-none'>
                Top P
              </span>
              <Toggle
                checked={formValues.includeTopP ?? false}
                onChange={(newCheckedState) =>
                  handleChange('includeTopP', newCheckedState)
                }
                disabled={isSaving || isResetting}
                id={`${platform.id}-${selectedModelId}-include-topp`}
              />
            </div>
            <p className='help-text text-sm text-theme-secondary mb-3 select-none'>
              Alternative to temperature, controls diversity via nucleus
              sampling.
            </p>
            {formValues.includeTopP && (
              <SliderInput
                label=''
                value={formValues.topP ?? parameterSpecs.topP.min}
                onChange={(newValue) => handleChange('topP', newValue)}
                min={parameterSpecs.topP.min}
                max={parameterSpecs.topP.max}
                step={parameterSpecs.topP.step}
                disabled={isSaving || isResetting}
                className='form-group mt-2'
              />
            )}
            {showTempSection && showTopPSection && formValues.includeTemperature && formValues.includeTopP && (
                <p className='text-amber-600 text-xs mt-3 select-none'>
                  It is generally recommended to alter Temperature or Top P, but not both.
                </p>
            )}
        </SettingsCard>
        )}

        {showBudgetSlider && parameterSpecs.thinkingBudget && (
          <SettingsCard className='mb-6'>
            <span className='block mb-3 text-base font-semibold text-theme-primary select-none'>
              Thinking Budget
            </span>
            <p className='help-text text-sm text-theme-secondary mb-3 select-none'>
              Maximum tokens the model can use for internal thinking steps.
            </p>
            <SliderInput
              label=''
              value={formValues.thinkingBudget ?? parameterSpecs.thinkingBudget.default}
              onChange={(newValue) => handleChange('thinkingBudget', newValue)}
              min={parameterSpecs.thinkingBudget.min}
              max={parameterSpecs.thinkingBudget.max}
              step={parameterSpecs.thinkingBudget.step}
              disabled={isSaving || isResetting}
              className='form-group mt-2'
            />
        </SettingsCard>
        )}

        {showReasoningEffort && parameterSpecs.reasoningEffort && (
          <SettingsCard className='mb-6'>
            <span className='block mb-3 text-base font-semibold text-theme-primary select-none'>
              Reasoning Effort
            </span>
            <p className='help-text text-sm text-theme-secondary mb-3 select-none'>
              Controls the amount of internal reasoning the model performs.
            </p>
            <div className='inline-block'>
              <CustomSelect
                id={`${platform.id}-${selectedModelId}-reasoning-effort`}
                options={parameterSpecs.reasoningEffort.allowedValues.map(value => ({ id: value, name: value }))}
                selectedValue={formValues.reasoningEffort ?? parameterSpecs.reasoningEffort.default}
                onChange={(selectedValue) => handleChange('reasoningEffort', selectedValue)}
                placeholder='Select Effort Level'
                disabled={isSaving || isResetting}
              />
            </div>
        </SettingsCard>
        )}

        {modelSupportsSystemPrompt && parameterSpecs.systemPrompt && (
          <SettingsCard className='mb-6'>
            <label
              htmlFor={`${platform.id}-${selectedModelId}-system-prompt`}
              className='block mb-3 text-base font-semibold text-theme-primary select-none'
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
              value={formValues.systemPrompt ?? ''}
              onChange={(e) => handleChange('systemPrompt', e.target.value)}
              maxLength={parameterSpecs.systemPrompt.maxLength}
              disabled={isSaving || isResetting}
            />
        </SettingsCard>
        )}

        <div className='form-actions flex justify-end'>
          <Button
            type='submit'
            isLoading={isSaving}
            disabled={isSaving || isResetting || !hasChanges}
            variant={!hasChanges || isResetting ? 'inactive' : 'primary'}
            className='px-5 py-2 select-none'
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </>
  );
};

ModelParametersSettings.propTypes = {
  platform: PropTypes.object.isRequired,
  selectedModelId: PropTypes.string,
  modelParametersSettings: PropTypes.object, // Renamed from advancedSettings
  onModelSelect: PropTypes.func.isRequired,
  onSettingsUpdate: PropTypes.func.isRequired,
  onResetToDefaults: PropTypes.func.isRequired,
};

export default React.memo(ModelParametersSettings);

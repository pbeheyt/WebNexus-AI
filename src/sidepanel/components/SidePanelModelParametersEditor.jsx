// src/sidepanel/components/SidePanelModelParametersEditor.jsx
import PropTypes from 'prop-types';

import {
  Button,
  SliderInput,
  Toggle,
  TextArea,
  InfoIcon,
  SpinnerIcon,
  IconButton,
  RefreshIcon,
} from '../../components';
import { useSidePanelModelParameters } from '../hooks/useSidePanelModelParameters';

const SidePanelModelParametersEditor = ({
  platform, // Full platform config object from SidePanelPlatformContext
  selectedModelId, // String ID of the selected model from SidePanelPlatformContext
  currentEditingMode, // 'base' or 'thinking' from SidePanelChatContext
  modelConfigData, // Full config for selectedModelId from SidePanelChatContext
  isVisible, // Boolean to control visibility
  onReady, // Callback when the editor's internal hook is ready
}) => {
  const {
    formValues,
    derivedSettings,
    handleChange,
    handleSubmit,
    handleResetClick,
    isSaving,
    isResetting,
    isAnimatingReset,
    hasChanges,
    isAtDefaults,
    isFormReady,
  } = useSidePanelModelParameters({
    platform,
    selectedModelId,
    currentEditingMode,
    modelConfigData,
    onReady,
  });

  if (!isVisible) {
    return null;
  }

  if (!isFormReady || !derivedSettings) {
    return (
      <div className='p-4 bg-theme-surface border-t border-theme text-center'>
        <SpinnerIcon className='w-6 h-6 text-theme-secondary mx-auto' />
        <p className='text-xs text-theme-secondary mt-1'>Loading parameters...</p>
      </div>
    );
  }

  const {
    parameterSpecs,
    capabilities,
    effectiveShowTempSection,
    effectiveShowTopPSection,
  } = derivedSettings;

  const showBudgetSlider = parameterSpecs?.thinkingBudget && currentEditingMode === 'thinking';
  const modelSupportsSystemPrompt =
    capabilities?.supportsSystemPrompt !== false &&
    platform?.apiConfig?.apiStructure?.supportsSystemPrompt !== false;

  return (
    <div className='p-3 bg-theme-surface border-t border-theme'>
      <div className='space-y-3 text-xs'>
        {parameterSpecs.maxTokens && (
          <div>
            <label htmlFor={`sp-param-${platform?.id || 'uid1'}-${selectedModelId || 'uid2'}-${currentEditingMode}-maxTokens`} className='block mb-1 font-medium text-theme-secondary'>Max Tokens</label>
            <SliderInput
              id={`sp-param-${platform?.id || 'uid1'}-${selectedModelId || 'uid2'}-${currentEditingMode}-maxTokens`}
              label=''
              value={formValues?.maxTokens ?? parameterSpecs.maxTokens.min}
              onChange={(newValue) => handleChange('maxTokens', newValue)}
              min={parameterSpecs.maxTokens.min}
              max={parameterSpecs.maxTokens.max}
              step={parameterSpecs.maxTokens.step}
              disabled={isSaving || isResetting}
            />
          </div>
        )}

        {effectiveShowTempSection && parameterSpecs.temperature && (
          <div>
            <div className='flex items-center mb-1'>
              <label htmlFor={`sp-param-${platform?.id || 'uid1'}-${selectedModelId || 'uid2'}-${currentEditingMode}-includeTemperature`} className='font-medium text-theme-secondary mr-2'>Temperature</label>
              <Toggle
                checked={formValues.includeTemperature ?? true}
                onChange={(newCheckedState) => handleChange('includeTemperature', newCheckedState)}
                disabled={isSaving || isResetting}
                id={`sp-param-${platform?.id || 'uid1'}-${selectedModelId || 'uid2'}-${currentEditingMode}-includeTemperature`}
              />
            </div>
            {formValues.includeTemperature && (
              <SliderInput
                id={`sp-param-${platform?.id || 'uid1'}-${selectedModelId || 'uid2'}-${currentEditingMode}-temperatureValue`}
                label=''
                value={formValues.temperature ?? parameterSpecs.temperature.min}
                onChange={(newValue) => handleChange('temperature', newValue)}
                min={parameterSpecs.temperature.min}
                max={parameterSpecs.temperature.max}
                step={parameterSpecs.temperature.step}
                disabled={isSaving || isResetting}
              />
            )}
          </div>
        )}

        {effectiveShowTopPSection && parameterSpecs.topP && (
           <div>
            <div className='flex items-center mb-1'>
              <label htmlFor={`sp-param-${platform?.id || 'uid1'}-${selectedModelId || 'uid2'}-${currentEditingMode}-includeTopP`} className='font-medium text-theme-secondary mr-2'>Top P</label>
              <Toggle
                checked={formValues.includeTopP ?? false}
                onChange={(newCheckedState) => handleChange('includeTopP', newCheckedState)}
                disabled={isSaving || isResetting}
                id={`sp-param-${platform?.id || 'uid1'}-${selectedModelId || 'uid2'}-${currentEditingMode}-includeTopP`}
              />
            </div>
            {formValues.includeTopP && (
              <SliderInput
                id={`sp-param-${platform?.id || 'uid1'}-${selectedModelId || 'uid2'}-${currentEditingMode}-topPValue`}
                label=''
                value={formValues.topP ?? parameterSpecs.topP.min}
                onChange={(newValue) => handleChange('topP', newValue)}
                min={parameterSpecs.topP.min}
                max={parameterSpecs.topP.max}
                step={parameterSpecs.topP.step}
                disabled={isSaving || isResetting}
              />
            )}
          </div>
        )}
        
        {effectiveShowTempSection && effectiveShowTopPSection && formValues.includeTemperature && formValues.includeTopP && (
            <div className='my-1 flex items-start text-xxs text-amber-600 dark:text-amber-500'>
              <InfoIcon className='w-3 h-3 mr-1 flex-shrink-0' />
              <span>Temp & Top P active. Usually one is preferred.</span>
            </div>
        )}

        {showBudgetSlider && parameterSpecs.thinkingBudget && (
          <div>
            <label htmlFor={`sp-param-${platform?.id || 'uid1'}-${selectedModelId || 'uid2'}-${currentEditingMode}-thinkingBudget`} className='block mb-1 font-medium text-theme-secondary'>Thinking Budget</label>
            <SliderInput
              id={`sp-param-${platform?.id || 'uid1'}-${selectedModelId || 'uid2'}-${currentEditingMode}-thinkingBudget`}
              label=''
              value={formValues.thinkingBudget ?? parameterSpecs.thinkingBudget.default}
              onChange={(newValue) => handleChange('thinkingBudget', newValue)}
              min={parameterSpecs.thinkingBudget.min}
              max={parameterSpecs.thinkingBudget.max}
              step={parameterSpecs.thinkingBudget.step}
              disabled={isSaving || isResetting}
            />
          </div>
        )}
        
        {modelSupportsSystemPrompt && parameterSpecs.systemPrompt && (
          <div>
            <label htmlFor={`sp-param-${platform?.id || 'uid1'}-${selectedModelId || 'uid2'}-${currentEditingMode}-systemPrompt`} className='block mb-1 font-medium text-theme-secondary'>System Prompt</label>
            <TextArea
              id={`sp-param-${platform?.id || 'uid1'}-${selectedModelId || 'uid2'}-${currentEditingMode}-systemPrompt`}
              name='systemPrompt'
              placeholder='Optional system prompt...'
              value={formValues.systemPrompt ?? ''}
              onChange={(e) => handleChange('systemPrompt', e.target.value)}
              maxLength={parameterSpecs.systemPrompt.maxLength}
              disabled={isSaving || isResetting}
              className='bg-theme-hover text-xs border border-theme rounded-md w-full p-1.5'
              style={{ minHeight: '40px', maxHeight: '80px' }}
              autoResize={true}
            />
          </div>
        )}
      </div>

      {/* New container for buttons at the bottom */}
      <div className='flex justify-end items-center mt-4 pt-3 border-t border-theme'>
        <div className='flex items-center gap-2'>
          <IconButton
            icon={RefreshIcon}
            iconClassName={`w-5 h-5 select-none ${isAnimatingReset ? 'animate-rotate-180-once' : ''} ${isResetting ? 'opacity-0' : ''}`}
            className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            onClick={handleResetClick}
            isLoading={isResetting}
            disabled={isAtDefaults || isResetting || isSaving}
            ariaLabel='Reset parameters to defaults'
            title='Reset to defaults'
          />
          <Button
            type='button'
            onClick={handleSubmit}
            isLoading={isSaving}
            disabled={isSaving || isResetting || !hasChanges}
            variant={!hasChanges || isResetting ? 'inactive' : 'primary'}
            size="sm"
            className='px-3 py-1 text-xs select-none'
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};

SidePanelModelParametersEditor.propTypes = {
  platform: PropTypes.object,
  selectedModelId: PropTypes.string,
  currentEditingMode: PropTypes.string.isRequired,
  modelConfigData: PropTypes.object,
  isVisible: PropTypes.bool.isRequired,
  onReady: PropTypes.func,
};

export default SidePanelModelParametersEditor;

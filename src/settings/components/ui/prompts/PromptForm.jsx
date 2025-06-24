// src/settings/components/ui/prompts/PromptForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

import { logger } from '../../../../shared/logger';
import {
  Button,
  useNotification,
  CustomSelect,
  TextArea,
  Input,
} from '../../../../components';
import {
  STORAGE_KEYS,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  MAX_PROMPTS_PER_TYPE,
  MAX_PROMPT_NAME_LENGTH,
  MAX_PROMPT_CONTENT_LENGTH,
} from '../../../../shared/constants';
import { ensureDefaultPrompts } from '../../../../shared/utils/prompt-utils';
import useMinimumLoadingTime from '../../../../hooks/useMinimumLoadingTime';

const PromptForm = ({
  prompt = null,
  onCancel,
  onSuccess,
  initialContentType = CONTENT_TYPES.GENERAL,
}) => {
  const { success, error } = useNotification();
  const [isSavingActual, setIsSavingActual] = useState(false);
  const shouldShowSaving = useMinimumLoadingTime(isSavingActual);

  const [isDefaultForType, setIsDefaultForType] = useState(false);
  const [inputValidity, setInputValidity] = useState({
    name: false,
    content: false,
  });

  const isEditing = !!prompt;
  const isFormValid = Object.values(inputValidity).every(Boolean);

  const [formData, setFormData] = useState({
    name: prompt?.prompt.name || '',
    content: prompt?.prompt.content || '',
    contentType: prompt?.contentType || initialContentType,
  });

  useEffect(() => {
    if (isEditing && prompt) {
      setFormData({
        name: prompt.prompt.name || '',
        content: prompt.prompt.content || '',
        contentType: prompt.contentType || CONTENT_TYPES.GENERAL,
      });
    } else if (!isEditing) {
      setFormData({
        name: '',
        content: '',
        contentType: initialContentType,
      });
    }
  }, [prompt, isEditing, initialContentType]);

  useEffect(() => {
    const checkDefaultStatus = async () => {
      if (!isEditing || !prompt?.id || !formData.contentType) {
        setIsDefaultForType(false);
        return;
      }
      try {
        const result = await chrome.storage.local.get(
          STORAGE_KEYS.USER_PROMPTS
        );
        const customPrompts = result[STORAGE_KEYS.USER_PROMPTS] || {};
        const typeData = customPrompts[formData.contentType] || {};
        setIsDefaultForType(typeData['_defaultPromptId_'] === prompt.id);
      } catch (err) {
        logger.settings.error(
          'Error checking default prompt status in form:',
          err
        );
        setIsDefaultForType(false);
      }
    };
    checkDefaultStatus();
  }, [prompt, isEditing, formData.contentType]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleContentTypeChange = (selectedContentType) => {
    setFormData((prev) => ({ ...prev, contentType: selectedContentType }));
  };

  const handleInputValidation = useCallback((inputName, isValid) => {
    setInputValidity((prev) => ({ ...prev, [inputName]: isValid }));
  }, []);

  const handleNameValidation = useCallback(
    (isValid) => handleInputValidation('name', isValid),
    [handleInputValidation]
  );

  const handleContentValidation = useCallback(
    (isValid) => handleInputValidation('content', isValid),
    [handleInputValidation]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!isFormValid) {
        error('Please fix the errors before saving.');
        return;
      }
      setIsSavingActual(true);

      try {
        const { name, content, contentType } = formData;

        const result = await chrome.storage.local.get(
          STORAGE_KEYS.USER_PROMPTS
        );
        const customPromptsByType = result[STORAGE_KEYS.USER_PROMPTS] || {};

        if (!isEditing) {
          const typeData = customPromptsByType[contentType] || {};
          const actualPromptsInType = Object.keys(typeData).filter(
            (key) => key !== '_defaultPromptId_'
          );
          if (actualPromptsInType.length >= MAX_PROMPTS_PER_TYPE) {
            throw new Error(
              `Cannot add more than ${MAX_PROMPTS_PER_TYPE} prompts for ${CONTENT_TYPE_LABELS[contentType] || contentType}.`
            );
          }
        }

        if (!customPromptsByType[contentType]) {
          customPromptsByType[contentType] = {};
        }

        const promptObjectToSave = {
          name: name.trim(),
          content: content.trim(),
          updatedAt: new Date().toISOString(),
        };

        if (isEditing) {
          const currentPromptId = prompt.id;
          promptObjectToSave.createdAt =
            prompt.prompt.createdAt || promptObjectToSave.updatedAt;

          if (prompt.contentType !== formData.contentType) {
            const originalTypeData =
              customPromptsByType[prompt.contentType] || {};
            const isCurrentDefaultForOriginalType =
              originalTypeData['_defaultPromptId_'] === prompt.id;
            const promptsForOriginalType = Object.keys(originalTypeData).filter(
              (k) => k !== '_defaultPromptId_'
            );
            if (
              isCurrentDefaultForOriginalType &&
              promptsForOriginalType.length === 1
            ) {
              throw new Error(
                `Cannot change content type. This is the last default prompt for "${CONTENT_TYPE_LABELS[prompt.contentType]}".`
              );
            }
            delete customPromptsByType[prompt.contentType][prompt.id];
          }
          customPromptsByType[formData.contentType][currentPromptId] =
            promptObjectToSave;
          success('Prompt updated successfully.');
        } else {
          const newPromptId = `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          promptObjectToSave.createdAt = promptObjectToSave.updatedAt;
          customPromptsByType[contentType][newPromptId] = promptObjectToSave;
          success('Prompt created successfully.');
        }

        await chrome.storage.local.set({
          [STORAGE_KEYS.USER_PROMPTS]: customPromptsByType,
        });
        await ensureDefaultPrompts();
        onSuccess();
      } catch (err) {
        logger.settings.error('Error saving prompt:', err);
        const lastError = chrome.runtime.lastError;
        if (lastError?.message?.includes('QUOTA_BYTES')) {
          error('Local storage limit reached. Could not save the prompt.');
        } else {
          error(`Error saving prompt: ${err.message}`);
        }
      } finally {
        setIsSavingActual(false);
      }
    },
    [formData, isEditing, prompt, success, error, onSuccess, isFormValid]
  );

  const contentTypeOptions = Object.entries(CONTENT_TYPE_LABELS).map(
    ([type, label]) => ({ id: type, name: label })
  );

  return (
    <form
      onSubmit={handleSubmit}
      className='add-prompt-form bg-theme-secondary shadow-sm rounded-lg p-6 border border-theme'
      noValidate
    >
      <div className='flex items-center justify-between mb-5 pb-3 border-b border-theme'>
        <h3 className='type-heading text-base font-semibold text-theme-primary'>
          {isEditing ? 'Edit Prompt' : 'Create New Prompt'}
        </h3>
        {isEditing && isDefaultForType && (
          <span className='default-badge text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 px-2 py-1 rounded-full font-semibold'>
            Default
          </span>
        )}
      </div>

      <div className='form-group mb-6'>
        <label
          htmlFor='contentTypeSelect'
          className='block mb-3 text-base font-semibold text-theme-secondary'
        >
          Content Type
        </label>
        <div className='inline-block'>
          <CustomSelect
            id='contentTypeSelect'
            options={contentTypeOptions}
            selectedValue={formData.contentType}
            onChange={handleContentTypeChange}
            placeholder='Select Content Type'
            disabled={shouldShowSaving}
          />
        </div>
      </div>

      <div className='form-group mb-6'>
        <label
          htmlFor='prompt-name'
          className='block mb-3 text-base font-semibold text-theme-secondary'
        >
          Prompt Name
        </label>
        <div className='select-none'>
          <Input
            id='prompt-name'
            name='name'
            placeholder='Give your prompt a descriptive name'
            value={formData.name}
            onChange={handleChange}
            maxLength={MAX_PROMPT_NAME_LENGTH}
            disabled={shouldShowSaving}
            className='bg-theme-surface text-sm border border-theme rounded-md'
            required
            onValidation={handleNameValidation}
          />
        </div>
      </div>

      <div className='form-group mb-6'>
        <label
          htmlFor='prompt-content'
          className='block mb-3 text-base font-semibold text-theme-secondary'
        >
          Prompt Content
        </label>
        <div className='select-none'>
          <TextArea
            id='prompt-content'
            name='content'
            placeholder='Enter your prompt content here...'
            value={formData.content}
            onChange={handleChange}
            maxLength={MAX_PROMPT_CONTENT_LENGTH}
            disabled={shouldShowSaving}
            className='bg-theme-surface text-sm border border-theme rounded-md'
            style={{ minHeight: '120px' }}
            autoResize={true}
            required
            onValidation={handleContentValidation}
          />
        </div>
      </div>

      <div className='form-actions flex justify-end gap-4 mt-7'>
        <Button
          type='button'
          variant='secondary'
          className='px-5 py-2 select-none'
          onClick={onCancel}
          disabled={shouldShowSaving}
        >
          Cancel
        </Button>

        <Button
          type='submit'
          className='px-5 py-2 select-none'
          isLoading={shouldShowSaving}
          disabled={shouldShowSaving || !isFormValid}
          variant={shouldShowSaving || !isFormValid ? 'inactive' : 'primary'}
        >
          {isSavingActual
            ? 'Saving...'
            : isEditing
              ? 'Update Prompt'
              : 'Create Prompt'}
        </Button>
      </div>
    </form>
  );
};

PromptForm.propTypes = {
  prompt: PropTypes.object,
  onCancel: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
  initialContentType: PropTypes.string,
};

export default React.memo(PromptForm);

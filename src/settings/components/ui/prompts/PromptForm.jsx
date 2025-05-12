// src/settings/components/ui/prompts/PromptForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

import { logger } from '../../../../shared/logger';
import { Button, useNotification, CustomSelect } from '../../../../components';
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
  const shouldShowSaving = useMinimumLoadingTime(isSavingActual); // Derived UI loading state

  const [isDefaultForType, setIsDefaultForType] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const isEditing = !!prompt;

  const [formData, setFormData] = useState(() => {
    if (prompt) {
      return {
        name: prompt.prompt.name || '',
        content: prompt.prompt.content || '',
        contentType: prompt.contentType || CONTENT_TYPES.GENERAL,
      };
    } else {
      return {
        name: '',
        content: '',
        contentType: initialContentType,
      };
    }
  });

  useEffect(() => {
    if (isEditing && prompt) {
      const initialData = {
        name: prompt.prompt.name || '',
        content: prompt.prompt.content || '',
        contentType: prompt.contentType || CONTENT_TYPES.GENERAL,
      };
      setFormData(initialData);
      setOriginalFormData(initialData);
      setHasChanges(false);
    } else if (!isEditing) {
       setFormData({
          name: '',
          content: '',
          contentType: initialContentType,
      });
      setOriginalFormData(null);
      setHasChanges(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, isEditing, initialContentType]);

  useEffect(() => {
    if (isEditing && originalFormData) {
      const nameChanged = formData.name.trim() !== originalFormData.name.trim();
      const contentChanged = formData.content.trim() !== originalFormData.content.trim();
      const typeChanged = formData.contentType !== originalFormData.contentType;
      setHasChanges(nameChanged || contentChanged || typeChanged);
    } else {
       setHasChanges(false);
    }
  }, [formData, originalFormData, isEditing]);

  useEffect(() => {
    const checkDefaultStatus = async () => {
      if (!isEditing || !prompt?.id || !formData.contentType) {
        setIsDefaultForType(false);
        return;
      }
      try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.PROMPTS);
        const customPrompts = result[STORAGE_KEYS.PROMPTS] || {};
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

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, [setFormData]);

  const handleContentTypeChange = useCallback((selectedContentType) => {
    setFormData((prev) => ({
      ...prev,
      contentType: selectedContentType,
    }));
  }, [setFormData]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSavingActual(true);

    try {
      const { name, content, contentType } = formData;

      if (!name.trim()) {
        error('Prompt Name is required.');
        setIsSavingActual(false);
        return;
      }
      if (name.length > MAX_PROMPT_NAME_LENGTH) {
        error(`Prompt Name cannot exceed ${MAX_PROMPT_NAME_LENGTH} characters.`);
        setIsSavingActual(false);
        return;
      }
      if (!content.trim()) {
        error('Prompt Content is required.');
        setIsSavingActual(false);
        return;
      }
      if (content.length > MAX_PROMPT_CONTENT_LENGTH) {
        error(`Prompt Content cannot exceed ${MAX_PROMPT_CONTENT_LENGTH} characters.`);
        setIsSavingActual(false);
        return;
      }
      if (!contentType) {
        error('Content Type is required.');
        setIsSavingActual(false);
        return;
      }

      const result = await chrome.storage.local.get(STORAGE_KEYS.PROMPTS);
      const customPromptsByType = result[STORAGE_KEYS.PROMPTS] || {};

      if (!isEditing) {
        const typeData = customPromptsByType[contentType] || {};
        const actualPromptsInType = Object.keys(typeData).filter(key => key !== '_defaultPromptId_');
        const currentPromptCount = actualPromptsInType.length;
        if (currentPromptCount >= MAX_PROMPTS_PER_TYPE) {
          error(`Cannot add more than ${MAX_PROMPTS_PER_TYPE} prompts for ${CONTENT_TYPE_LABELS[contentType] || contentType}.`);
          setIsSavingActual(false);
          return;
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

      let currentPromptId;

      if (isEditing) {
        currentPromptId = prompt.id;
        promptObjectToSave.createdAt = prompt.prompt.createdAt || promptObjectToSave.updatedAt;

        if (prompt.contentType !== formData.contentType) {
          const originalTypeData = customPromptsByType[prompt.contentType] || {};
          const isCurrentDefaultForOriginalType = 
            originalTypeData['_defaultPromptId_'] === prompt.id;
          
          const promptsForOriginalType = {};
          if (customPromptsByType[prompt.contentType]) {
              for (const key in customPromptsByType[prompt.contentType]) {
                  if (key !== '_defaultPromptId_') {
                      promptsForOriginalType[key] = customPromptsByType[prompt.contentType][key];
                  }
              }
          }
          const isLastPromptForOriginalType = 
            Object.keys(promptsForOriginalType).length === 1 && 
            promptsForOriginalType[prompt.id];

          if (isCurrentDefaultForOriginalType && isLastPromptForOriginalType) {
            const originalContentTypeLabel =
              CONTENT_TYPE_LABELS[prompt.contentType] || prompt.contentType;
            throw new Error(
              `Cannot change content type. This is the last default prompt for "${originalContentTypeLabel}". Create another prompt for this type first, or change the default.`
            );
          }

          if (customPromptsByType[prompt.contentType]?.[prompt.id]) {
            delete customPromptsByType[prompt.contentType][prompt.id];
            logger.settings.info(
              `Moved prompt ${prompt.id} from old content type ${prompt.contentType} to ${formData.contentType}`
            );
          }
        }
        customPromptsByType[formData.contentType][currentPromptId] = promptObjectToSave;
        success('Prompt updated successfully.');
      } else {
        currentPromptId = `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        promptObjectToSave.createdAt = promptObjectToSave.updatedAt;
        customPromptsByType[contentType][currentPromptId] = promptObjectToSave;
        success('Prompt created successfully.');
      }

      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.PROMPTS]: customPromptsByType,
        });
        await ensureDefaultPrompts();
        onSuccess();
      } catch (err) {
        logger.settings.error('Error saving prompt:', err);
        const lastError = chrome.runtime.lastError;
        if (lastError?.message?.includes('QUOTA_BYTES')) {
          error('Local storage limit reached. Please remove some prompts.');
        } else {
          error(`Error saving prompt: ${err.message}`);
        }
      }
    } catch (err) {
      logger.settings.error('Error saving prompt:', err);
      error(`Error saving prompt: ${err.message}`);
    } finally {
      setIsSavingActual(false);
    }
  }, [formData, isEditing, prompt, success, error, onSuccess]);

  const contentTypeOptions = Object.entries(CONTENT_TYPE_LABELS).map(
    ([type, label]) => ({
      id: type,
      name: label,
    })
  );

  return (
    <form
      onSubmit={handleSubmit}
      className='add-prompt-form bg-theme-surface shadow-sm rounded-lg p-6 border border-theme'
      noValidate
    >
      <div className='flex items-center mb-5 pb-3 border-b border-theme'>
        <h3 className='type-heading text-base font-semibold text-theme-primary select-none'>
          {isEditing ? 'Edit Prompt' : 'Create New Prompt'}
        </h3>
        {isEditing && isDefaultForType && (
          <span className='default-badge ml-3 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 px-2 py-1 rounded-full font-medium select-none'>
            Default
          </span>
        )}
      </div>

      <div className='form-group mb-6'>
        <label htmlFor="contentTypeSelect" className='block mb-3 text-base font-medium text-theme-secondary select-none'>
          Content Type
        </label>
        <div className='inline-block'>
          <CustomSelect
            id="contentTypeSelect"
            options={contentTypeOptions}
            selectedValue={formData.contentType}
            onChange={handleContentTypeChange}
            placeholder='Select Content Type'
            disabled={shouldShowSaving} // Disable if UI loading state is active
          />
        </div>
      </div>

      <div className='form-group mb-6'>
        <label
          htmlFor='name'
          className='block mb-3 text-base font-medium text-theme-secondary select-none'
        >
          Prompt Name
        </label>
        <input
          type='text'
          id='name'
          name='name'
          className='w-full p-2.5 bg-theme-hover text-sm text-theme-primary border border-theme rounded-md focus-primary'
          placeholder='Give your prompt a descriptive name'
          value={formData.name}
          onChange={handleChange}
          maxLength={MAX_PROMPT_NAME_LENGTH}
          disabled={shouldShowSaving} // Disable if UI loading state is active
        />
      </div>

      <div className='form-group mb-6'>
        <label
          htmlFor='content'
          className='block mb-3 text-base font-medium text-theme-secondary select-none'
        >
          Prompt Content
        </label>
        <textarea
          id='content'
          name='content'
          className='w-full p-3 bg-theme-hover text-sm text-theme-primary border border-theme rounded-md focus-primary break-words h-[300px] overflow-y-auto'
          placeholder='Enter your prompt content here...'
          value={formData.content}
          onChange={handleChange}
          maxLength={MAX_PROMPT_CONTENT_LENGTH}
          disabled={shouldShowSaving} // Disable if UI loading state is active
        />
      </div>

      <div className='form-actions flex justify-end gap-4 mt-7'>
        <Button
          type='button'
          variant='secondary'
          className='px-5 py-2 select-none'
          onClick={onCancel}
          disabled={shouldShowSaving} // Disable if UI loading state is active
        >
          Cancel
        </Button>

        <Button
          type='submit'
          className='px-5 py-2 select-none'
          isLoading={shouldShowSaving} // Use derived UI loading state
          disabled={shouldShowSaving || (isEditing && !hasChanges)}
          variant={shouldShowSaving || (isEditing && !hasChanges) ? 'inactive' : 'primary'}
        >
          {isSavingActual // Text based on actual saving state
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

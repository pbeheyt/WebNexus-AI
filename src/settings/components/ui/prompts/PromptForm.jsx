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

const PromptForm = ({
  prompt = null,
  onCancel,
  onSuccess,
  initialContentType = CONTENT_TYPES.GENERAL,
}) => {
  const { success, error } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [isDefaultForType, setIsDefaultForType] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Determine if editing before setting initial state
  const isEditing = !!prompt;

  // Use initialContentType prop when creating a new prompt
  const [formData, setFormData] = useState(() => {
    // Initial state based on whether we are editing or creating
    if (prompt) { // isEditing is true
      return {
        name: prompt.prompt.name || '',
        content: prompt.prompt.content || '',
        contentType: prompt.contentType || CONTENT_TYPES.GENERAL,
      };
    } else { // isCreating is true
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
      // Set formData based on prop for edit mode
      setFormData(initialData);
      // Store the original data separately
      setOriginalFormData(initialData);
      setHasChanges(false); // Reset changes flag on load/prompt change
    } else if (!isEditing) {
      // Reset form for creating new prompt if initialContentType changes
       setFormData({
          name: '',
          content: '',
          contentType: initialContentType,
      });
      setOriginalFormData(null); // No original data when creating
      setHasChanges(false); // Reset changes flag
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, isEditing, initialContentType]);

  useEffect(() => {
    if (isEditing && originalFormData) {
      // Trim strings for accurate comparison
      const nameChanged = formData.name.trim() !== originalFormData.name.trim();
      const contentChanged = formData.content.trim() !== originalFormData.content.trim();
      const typeChanged = formData.contentType !== originalFormData.contentType;
      setHasChanges(nameChanged || contentChanged || typeChanged);
    } else {
       // In create mode, hasChanges is not used to disable the button, so keep it false.
       setHasChanges(false);
    }
  }, [formData, originalFormData, isEditing]);

  // Effect to check default status when in edit mode or when content type changes
  useEffect(() => {
    const checkDefaultStatus = async () => {
      // Only check if editing and we have a valid prompt ID and content type
      if (!isEditing || !prompt?.id || !formData.contentType) {
        setIsDefaultForType(false);
        return;
      }
      try {
        const result = await chrome.storage.local.get(
          STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE
        );
        const defaults = result[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};
        // Check if this prompt ID is the default for the *currently selected* content type in the form
        setIsDefaultForType(defaults[formData.contentType] === prompt.id);
      } catch (err) {
        logger.settings.error(
          'Error checking default prompt status in form:',
          err
        );
        setIsDefaultForType(false); // Assume not default on error
      }
    };

    checkDefaultStatus();
    // Rerun when the original prompt object changes OR when the selected content type in the form changes
  }, [prompt, isEditing, formData.contentType]);

  // Memoize handleChange
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, [setFormData]);

  // Memoize handleContentTypeChange
  const handleContentTypeChange = useCallback((selectedContentType) => {
    setFormData((prev) => ({
      ...prev,
      contentType: selectedContentType,
    }));
  }, [setFormData]);

  // Memoize handleSubmit
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { name, content, contentType } = formData;

      // Validate inputs
      if (!name.trim()) {
        error('Prompt Name is required.');
        setIsSaving(false);
        return;
      }
      if (name.length > MAX_PROMPT_NAME_LENGTH) {
        error(`Prompt Name cannot exceed ${MAX_PROMPT_NAME_LENGTH} characters.`);
        setIsSaving(false);
        return;
      }
      if (!content.trim()) {
        error('Prompt Content is required.');
        setIsSaving(false);
        return;
      }
      if (content.length > MAX_PROMPT_CONTENT_LENGTH) {
        error(`Prompt Content cannot exceed ${MAX_PROMPT_CONTENT_LENGTH} characters.`);
        setIsSaving(false);
        return;
      }
      if (!contentType) {
        error('Content Type is required.');
        setIsSaving(false);
        return;
      }

      // Get current prompts
      const result = await chrome.storage.local.get(STORAGE_KEYS.CUSTOM_PROMPTS);
      const customPromptsByType = result[STORAGE_KEYS.CUSTOM_PROMPTS] || {};

      // Check prompt count limit for new prompts
      if (!isEditing) {
        const existingPromptsForType = customPromptsByType[contentType]?.prompts || {};
        const currentPromptCount = Object.keys(existingPromptsForType).length;
        if (currentPromptCount >= MAX_PROMPTS_PER_TYPE) {
          error(`Cannot add more than ${MAX_PROMPTS_PER_TYPE} prompts for ${CONTENT_TYPE_LABELS[contentType] || contentType}.`);
          setIsSaving(false);
          return;
        }
      }

      // Initialize content type if needed
      if (!customPromptsByType[contentType]) {
        customPromptsByType[contentType] = {
          prompts: {},
          preferredPromptId: null,
          settings: {},
        };
      } else if (!customPromptsByType[contentType].prompts) {
        // Ensure prompts object exists even if the type entry exists
        customPromptsByType[contentType].prompts = {};
      }

      // Prepare prompt object to save (without contentType field)
      const promptObjectToSave = {
        name: name.trim(),
        content: content.trim(),
        updatedAt: new Date().toISOString(),
      };

      let currentPromptId;

      if (isEditing) {
        currentPromptId = prompt.id; // The ID (key) of the prompt being edited
        promptObjectToSave.createdAt = prompt.prompt.createdAt || promptObjectToSave.updatedAt; // Preserve original createdAt

        // Handle content type change if needed
        if (prompt.contentType !== formData.contentType) {
          // Validate content type change
          const defaultsResult = await chrome.storage.local.get(
            STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE
          );
          const currentDefaults =
            defaultsResult[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};
          const isCurrentDefaultForOriginalType =
            currentDefaults[prompt.contentType] === prompt.id;
          const promptsForOriginalType =
            customPromptsByType[prompt.contentType] || {};
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

          // Remove from old content type location
          if (customPromptsByType[prompt.contentType]?.[prompt.id]) {
            delete customPromptsByType[prompt.contentType][prompt.id];
            logger.settings.info(
              `Moved prompt ${prompt.id} from old content type ${prompt.contentType} to ${formData.contentType}`
            );
          }
        }

        // Update the prompt in the correct content type location
        if (!customPromptsByType[formData.contentType]) {
          customPromptsByType[formData.contentType] = {};
        }
        customPromptsByType[formData.contentType][currentPromptId] = promptObjectToSave;
        success('Prompt updated successfully');
      } else {
        // Create new prompt
        currentPromptId = 'prompt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        promptObjectToSave.createdAt = promptObjectToSave.updatedAt;

        // Ensure the content type object exists
        if (!customPromptsByType[contentType]) {
          customPromptsByType[contentType] = {};
        }
        customPromptsByType[contentType][currentPromptId] = promptObjectToSave;
        success('Prompt created successfully');
      }

      // Save to storage
      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.CUSTOM_PROMPTS]: customPromptsByType,
        });

        // Ensure default prompts are set correctly
        await ensureDefaultPrompts();

        // Notify parent
        onSuccess();
      } catch (err) {
        logger.settings.error('Error saving prompt:', err);
        // Check for quota error
        const lastError = chrome.runtime.lastError;
        if (lastError?.message?.includes('QUOTA_BYTES')) {
          error('Local storage limit reached. Please remove some prompts.', 10000);
        } else {
          error(`Error saving prompt: ${err.message}`, 10000);
        }
      }
    } catch (err) {
      logger.settings.error('Error saving prompt:', err);
      error(`Error saving prompt: ${err.message}`, 10000);
    } finally {
      setIsSaving(false);
    }
  }, [formData, isEditing, prompt, success, error, onSuccess]);

  // Prepare options for CustomSelect
  const contentTypeOptions = Object.entries(CONTENT_TYPE_LABELS).map(
    ([type, label]) => ({
      id: type,
      name: label,
    })
  );

  return (
    <form
      onSubmit={handleSubmit}
      className='add-prompt-form bg-theme-surface rounded-lg p-6 border border-theme'
      noValidate
    >
      {/* Title Section with Conditional Badge */}
      <div className='flex items-center mb-5 pb-3 border-b border-theme'>
        <h3 className='type-heading text-xl font-semibold text-theme-primary select-none'>
          {isEditing ? 'Edit Prompt' : 'Create New Prompt'}
        </h3>
        {/* Conditionally render the Default badge only in edit mode */}
        {isEditing && isDefaultForType && (
          <span className='default-badge ml-3 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 px-2 py-1 rounded-full font-medium select-none'>
            Default
          </span>
        )}
      </div>

      {/* Content Type Selection using CustomSelect */}
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
          />
        </div>
      </div>

      {/* Prompt Name Input */}
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
          className='w-full p-2.5 bg-gray-50 dark:bg-gray-700 text-sm text-theme-primary border border-theme rounded-md focus-primary'
          placeholder='Give your prompt a descriptive name'
          value={formData.name}
          onChange={handleChange}
          maxLength={MAX_PROMPT_NAME_LENGTH}
        />
      </div>

      {/* Prompt Content Textarea */}
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
          className='w-full p-3 bg-gray-50 dark:bg-gray-700 text-sm text-theme-primary border border-theme rounded-md min-h-[220px] focus-primary break-words'
          placeholder='Enter your prompt content here...'
          value={formData.content}
          onChange={handleChange}
          maxLength={MAX_PROMPT_CONTENT_LENGTH}
        />
      </div>

      {/* Action Buttons */}
      <div className='form-actions flex justify-end gap-4 mt-7'>
        <Button
          type='button'
          variant='secondary'
          className='px-5 py-2 select-none'
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button
          type='submit'
          className='px-5 py-2 select-none'
          disabled={isSaving || (isEditing && !hasChanges)}
          variant={isSaving || (isEditing && !hasChanges) ? 'inactive' : 'primary'}
        >
          {isSaving
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

// src/settings/components/ui/prompts/PromptForm.jsx
import React, { useState, useEffect } from 'react';
import { Button, useNotification, CustomSelect } from '../../../../components';
import {
  STORAGE_KEYS,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS
} from '../../../../shared/constants';
import { ensureDefaultPrompts } from '../../../../shared/utils/prompt-utils';

const PromptForm = ({ prompt = null, onCancel, onSuccess, initialContentType = CONTENT_TYPES.GENERAL }) => {
  const { success, error } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [isDefaultForType, setIsDefaultForType] = useState(false);

  // Determine if editing before setting initial state
  const isEditing = !!prompt;

  // Use initialContentType prop when creating a new prompt
  const [formData, setFormData] = useState({
    name: prompt?.prompt?.name || '',
    content: prompt?.prompt?.content || '',
    contentType: isEditing ? (prompt?.contentType || CONTENT_TYPES.GENERAL) : initialContentType
  });

  // Effect to check default status when in edit mode or when content type changes
  useEffect(() => {
    const checkDefaultStatus = async () => {
      // Only check if editing and we have a valid prompt ID and content type
      if (!isEditing || !prompt?.id || !formData.contentType) {
        setIsDefaultForType(false);
        return;
      }
      try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE);
        const defaults = result[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};
        // Check if this prompt ID is the default for the *currently selected* content type in the form
        setIsDefaultForType(defaults[formData.contentType] === prompt.id);
      } catch (err) {
        console.error('Error checking default prompt status in form:', err);
        setIsDefaultForType(false); // Assume not default on error
      }
    };

    checkDefaultStatus();
    // Rerun when the original prompt object changes OR when the selected content type in the form changes
  }, [prompt, isEditing, formData.contentType]);

  // Handler for standard input/textarea changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handler specifically for CustomSelect changes
  const handleContentTypeChange = (selectedContentType) => {
    setFormData(prev => ({
      ...prev,
      contentType: selectedContentType
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { name, content, contentType } = formData;

      // Validate inputs
      if (!name.trim() || !content.trim()) {
        throw new Error('Name and content are required');
      }
      if (!contentType) {
        throw new Error('Content type is required');
      }

      // Get current prompts
      const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
      const customPromptsByType = result[STORAGE_KEYS.CUSTOM_PROMPTS] || {};

      // Initialize content type if needed
      if (!customPromptsByType[contentType]) {
        customPromptsByType[contentType] = {
          prompts: {},
          preferredPromptId: null,
          settings: {}
        };
      } else if (!customPromptsByType[contentType].prompts) {
        // Ensure prompts object exists even if the type entry exists
        customPromptsByType[contentType].prompts = {};
      }

      // Prepare prompt data
      const promptData = {
        name: name.trim(),
        content: content.trim(),
        contentType: contentType,
        updatedAt: new Date().toISOString(),
      };

      if (isEditing) {
        promptData.id = prompt.id;
        // Ensure createdAt is preserved if it exists
        promptData.createdAt = prompt.prompt.createdAt || promptData.updatedAt;

        // Check if the content type has changed during the edit
        if (prompt.contentType !== formData.contentType) {
          // --- BEGIN VALIDATION FOR CONTENT TYPE CHANGE ON LAST DEFAULT ---
          // Content type has changed, check if it's allowed
          
          // Fetch the current default prompts map
          const defaultsResult = await chrome.storage.sync.get(STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE);
          const currentDefaults = defaultsResult[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};
          
          // Check if the prompt being edited IS the default for its ORIGINAL content type
          const isCurrentDefaultForOriginalType = currentDefaults[prompt.contentType] === prompt.id;
          
          // Check if the prompt being edited IS the ONLY prompt for its ORIGINAL content type
          // Use the customPromptsByType variable already fetched at the start of handleSubmit
          const promptsForOriginalType = customPromptsByType[prompt.contentType]?.prompts || {};
          const isLastPromptForOriginalType = Object.keys(promptsForOriginalType).length === 1 && promptsForOriginalType[prompt.id];
          
          // If it was the default AND the last one, prevent the change
          if (isCurrentDefaultForOriginalType && isLastPromptForOriginalType) {
            const originalContentTypeLabel = CONTENT_TYPE_LABELS[prompt.contentType] || prompt.contentType;
            throw new Error(
              `Cannot change content type. This is the last default prompt for "${originalContentTypeLabel}". Create another prompt for this type first, or change the default.`
            );
          }
          // --- END VALIDATION ---
          // If changed, remove the prompt from its original content type location
          if (customPromptsByType[prompt.contentType]?.prompts?.[prompt.id]) {
            delete customPromptsByType[prompt.contentType].prompts[prompt.id];
            console.log(`Moved prompt ${prompt.id} from old content type ${prompt.contentType} to ${formData.contentType}`);
          }
        }

        // Add/Update the prompt in the new/current content type location
        customPromptsByType[contentType].prompts[prompt.id] = promptData;
        success('Prompt updated successfully');
      } else {
        // Create new prompt
        const promptId = 'prompt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        promptData.id = promptId;
        promptData.createdAt = promptData.updatedAt;

        customPromptsByType[contentType].prompts[promptId] = promptData;
        success('Prompt created successfully');
      }

      // Save to storage
      await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_PROMPTS]: customPromptsByType });

      // Ensure default prompts are set correctly
      await ensureDefaultPrompts();

      // Notify parent
      onSuccess();
    } catch (err) {
      console.error('Error saving prompt:', err);
      error(`Error saving prompt: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Prepare options for CustomSelect
  const contentTypeOptions = Object.entries(CONTENT_TYPE_LABELS).map(([type, label]) => ({
    id: type,
    name: label
  }));

  return (
    <form onSubmit={handleSubmit} className="add-prompt-form bg-theme-surface rounded-lg p-6 border border-theme">
      {/* Title Section with Conditional Badge */}
      <div className="flex items-center mb-5 pb-3 border-b border-theme">
        <h3 className="type-heading text-xl font-semibold text-theme-primary select-none">
          {isEditing ? 'Edit Prompt' : 'Create New Prompt'}
        </h3>
        {/* Conditionally render the Default badge only in edit mode */}
        {isEditing && isDefaultForType && (
          <span className="default-badge ml-3 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium select-none">
            Default
          </span>
        )}
      </div>


      {/* Content Type Selection using CustomSelect */}
      <div className="form-group mb-6">
        <label
          className="block mb-3 text-base font-medium text-theme-secondary select-none"
        >
          Content Type
        </label>
        <div className="inline-block">
          <CustomSelect
            options={contentTypeOptions}
            selectedValue={formData.contentType}
            onChange={handleContentTypeChange}
            placeholder="Select Content Type"
          />
        </div>
      </div>

      {/* Prompt Name Input */}
      <div className="form-group mb-6">
        <label
          htmlFor="name"
          className="block mb-3 text-base font-medium text-theme-secondary select-none"
        >
          Prompt Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          className="w-full p-2.5 bg-gray-50 dark:bg-gray-700 text-sm text-theme-primary border border-theme rounded-md focus-primary"
          placeholder="Give your prompt a descriptive name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      {/* Prompt Content Textarea */}
      <div className="form-group mb-6">
        <label
          htmlFor="content"
          className="block mb-3 text-base font-medium text-theme-secondary select-none"
        >
          Prompt Content
        </label>
        <textarea
          id="content"
          name="content"
          className="w-full p-3 bg-gray-50 dark:bg-gray-700 text-sm text-theme-primary border border-theme rounded-md min-h-[220px] focus-primary"
          placeholder="Enter your prompt content here..."
          value={formData.content}
          onChange={handleChange}
          required
        />
      </div>

      {/* Action Buttons */}
      <div className="form-actions flex justify-end gap-4 mt-7">
        <Button
          type="button"
          variant="secondary"
          className="px-5 py-2 select-none"
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          className="px-5 py-2 select-none"
          disabled={isSaving}
          variant={isSaving ? 'inactive' : 'primary'}
        >
          {isSaving ? 'Saving...' : (isEditing ? 'Update Prompt' : 'Create Prompt')}
        </Button>
      </div>
    </form>
  );
};

export default PromptForm;

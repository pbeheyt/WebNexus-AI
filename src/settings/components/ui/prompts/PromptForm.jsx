// src/settings/components/ui/PromptForm.jsx
import React, { useState } from 'react';
import { Button, useNotification, CustomSelect } from '../../../../components';
import {
  STORAGE_KEYS,
  CONTENT_TYPES, // Ensure CONTENT_TYPES is imported
  CONTENT_TYPE_LABELS
} from '../../../../shared/constants';

// Add initialContentType prop with a default value
const PromptForm = ({ prompt = null, onCancel, onSuccess, initialContentType = CONTENT_TYPES.GENERAL }) => {
  const { success, error } = useNotification();
  const [isSaving, setIsSaving] = useState(false);

  // Determine if editing before setting initial state
  const isEditing = !!prompt;

  // Use initialContentType prop when creating a new prompt
  const [formData, setFormData] = useState({
    name: prompt?.prompt?.name || '',
    content: prompt?.prompt?.content || '',
    contentType: isEditing ? (prompt?.contentType || CONTENT_TYPES.GENERAL) : initialContentType // Use prop here
  });

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
        contentType: contentType, // Use the potentially updated contentType from state
        updatedAt: new Date().toISOString(),
      };

      if (isEditing) {
        promptData.id = prompt.id;
        // Ensure createdAt is preserved if it exists
        promptData.createdAt = prompt.prompt.createdAt || promptData.updatedAt;

        // Check if the content type has changed during the edit
        if (prompt.contentType !== formData.contentType) {
          // If changed, remove the prompt from its original content type location
          if (customPromptsByType[prompt.contentType]?.prompts?.[prompt.id]) {
            delete customPromptsByType[prompt.contentType].prompts[prompt.id];
            console.log(`Moved prompt ${prompt.id} from old content type ${prompt.contentType} to ${formData.contentType}`);
             // Optional: Clean up old content type if empty (consider implications)
             // if (Object.keys(customPromptsByType[prompt.contentType]?.prompts || {}).length === 0) { ... }
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

      // Notify parent
      onSuccess();
    } catch (err) {
      console.error('Error saving prompt:', err);
      error(`Error saving prompt: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Prepare options for CustomSelect (excluding Shared type implicitly)
  const contentTypeOptions = Object.entries(CONTENT_TYPE_LABELS).map(([type, label]) => ({
    id: type,
    name: label
  }));

  return (
    <form onSubmit={handleSubmit} className="add-prompt-form bg-theme-surface rounded-lg p-6 border border-theme">
      <h3 className="type-heading mb-5 pb-3 border-b border-theme text-xl font-semibold text-theme-primary">
        {isEditing ? 'Edit Prompt' : 'Create New Prompt'}
      </h3>

      {/* Content Type Selection using CustomSelect */}
      <div className="form-group mb-6">
        <label
          className="block mb-3 text-base font-medium text-theme-secondary"
        >
          Content Type
        </label>
        <div className="inline-block">
          <CustomSelect
            options={contentTypeOptions}
            selectedValue={formData.contentType} // Reflects initial state or user changes
            onChange={handleContentTypeChange}
            placeholder="Select Content Type"
          />
        </div>
      </div>

      {/* Prompt Name Input */}
      <div className="form-group mb-6">
        <label
          htmlFor="name"
          className="block mb-3 text-base font-medium text-theme-secondary"
        >
          Prompt Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          className="w-full p-2.5 bg-theme-surface text-sm text-theme-primary border border-theme rounded-md focus-primary"
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
          className="block mb-3 text-base font-medium text-theme-secondary"
        >
          Prompt Content
        </label>
        <textarea
          id="content"
          name="content"
          className="w-full p-3 bg-theme-surface text-sm text-theme-primary border border-theme rounded-md min-h-[220px] focus-primary"
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
          className="px-5 py-2"
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          className="px-5 py-2"
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
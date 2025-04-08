// src/settings/components/ui/PromptForm.jsx
import React, { useState } from 'react';
import { Button, useNotification, CustomSelect } from '../../../../components'; // Import CustomSelect
import {
  STORAGE_KEYS,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS
} from '../../../../shared/constants';

const PromptForm = ({ prompt = null, onCancel, onSuccess }) => {
  const { success, error } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: prompt?.prompt?.name || '',
    content: prompt?.prompt?.content || '',
    contentType: prompt?.contentType || CONTENT_TYPES.GENERAL // Default to general
  });

  const isEditing = !!prompt;

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
      }

      // Prepare prompt data
      const promptData = {
        name: name.trim(),
        content: content.trim(),
        contentType: contentType, // Use selected contentType
        updatedAt: new Date().toISOString(),
      };

      if (isEditing) {
        // Update existing prompt
        promptData.id = prompt.id; // Keep existing ID
        // Ensure createdAt is preserved if it exists
        promptData.createdAt = prompt.prompt.createdAt || promptData.updatedAt;
        customPromptsByType[contentType].prompts[prompt.id] = promptData;
        success('Prompt updated successfully');
      } else {
        // Create new prompt
        const promptId = 'prompt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        promptData.id = promptId;
        promptData.createdAt = promptData.updatedAt; // Set createdAt for new prompt

        customPromptsByType[contentType].prompts[promptId] = promptData;

        // If no preferred prompt is set, make this one preferred (optional, consider if needed)
        // if (!customPromptsByType[contentType].preferredPromptId) {
        //   customPromptsByType[contentType].preferredPromptId = promptId;
        // }

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

  // Prepare options for CustomSelect
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
          // No htmlFor needed as CustomSelect isn't a standard input
          className="block mb-3 text-sm font-medium text-theme-secondary"
        >
          Content Type:
        </label>
        <div className="inline-block min-w-[200px] max-w-full">
          <CustomSelect
            options={contentTypeOptions}
            selectedValue={formData.contentType}
            onChange={handleContentTypeChange} // Use the specific handler
            placeholder="Select Content Type"
            // Optionally disable if editing? Depends on requirements.
            // disabled={isEditing}
          />
        </div>
      </div>

      {/* Prompt Name Input */}
      <div className="form-group mb-6">
        <label
          htmlFor="name"
          className="block mb-3 text-sm font-medium text-theme-secondary"
        >
          Prompt Name:
        </label>
        <input
          type="text"
          id="name"
          name="name" // Keep name for standard handleChange
          className="w-full p-2.5 bg-theme-surface text-theme-primary border border-theme rounded-md focus-primary" // Added focus style
          placeholder="Give your prompt a descriptive name"
          value={formData.name}
          onChange={handleChange} // Use standard handler
          required
        />
      </div>

      {/* Prompt Content Textarea */}
      <div className="form-group mb-6">
        <label
          htmlFor="content"
          className="block mb-3 text-sm font-medium text-theme-secondary"
        >
          Prompt Content:
        </label>
        <textarea
          id="content"
          name="content" // Keep name for standard handleChange
          className="w-full p-3 bg-theme-surface text-theme-primary border border-theme rounded-md min-h-[220px] focus-primary" // Added focus style
          placeholder="Enter your prompt content here..."
          value={formData.content}
          onChange={handleChange} // Use standard handler
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
          variant={isSaving ? 'inactive' : 'primary'} // Use inactive variant when saving
        >
          {isSaving ? 'Saving...' : (isEditing ? 'Update Prompt' : 'Create Prompt')}
        </Button>
      </div>
    </form>
  );
};

export default PromptForm;
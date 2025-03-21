// src/settings/components/ui/PromptForm.jsx
import React, { useState } from 'react';
import { Button, useNotification } from '../../../components';
import { SHARED_TYPE } from '../../../shared/constants';

// Content types from original constants
const CONTENT_TYPES = {
  GENERAL: 'general',
  REDDIT: 'reddit',
  YOUTUBE: 'youtube',
  PDF: 'pdf',
  SELECTED_TEXT: 'selected_text'
};

// Content type labels
const CONTENT_TYPE_LABELS = {
  [CONTENT_TYPES.GENERAL]: 'Web Content',
  [CONTENT_TYPES.REDDIT]: 'Reddit Posts',
  [CONTENT_TYPES.YOUTUBE]: 'YouTube Videos',
  [CONTENT_TYPES.PDF]: 'PDF Documents',
  [CONTENT_TYPES.SELECTED_TEXT]: 'Selected Text',
  [SHARED_TYPE]: 'Shared Prompts'
};

const CUSTOM_PROMPTS_KEY = 'custom_prompts_by_type';

const PromptForm = ({ prompt = null, onCancel, onSuccess }) => {
  const { success, error } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: prompt?.prompt?.name || '',
    content: prompt?.prompt?.content || '',
    contentType: prompt?.contentType || CONTENT_TYPES.GENERAL
  });
  
  const isEditing = !!prompt;
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
      
      // Get current prompts
      const result = await chrome.storage.sync.get(CUSTOM_PROMPTS_KEY);
      const customPromptsByType = result[CUSTOM_PROMPTS_KEY] || {};
      
      // Initialize content type if needed
      if (!customPromptsByType[contentType]) {
        customPromptsByType[contentType] = {
          prompts: {},
          preferredPromptId: null,
          settings: {}
        };
      }
      
      if (isEditing) {
        // Update existing prompt
        customPromptsByType[contentType].prompts[prompt.id] = {
          id: prompt.id,
          name,
          content,
          type: contentType,
          updatedAt: new Date().toISOString()
        };
        
        success('Prompt updated successfully');
      } else {
        // Create new prompt
        const promptId = 'prompt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        
        customPromptsByType[contentType].prompts[promptId] = {
          id: promptId,
          name,
          content,
          type: contentType,
          updatedAt: new Date().toISOString()
        };
        
        // If no preferred prompt is set, make this one preferred
        if (!customPromptsByType[contentType].preferredPromptId) {
          customPromptsByType[contentType].preferredPromptId = promptId;
        }
        
        success('Prompt created successfully');
      }
      
      // Save to storage
      await chrome.storage.sync.set({ [CUSTOM_PROMPTS_KEY]: customPromptsByType });
      
      // Notify parent
      onSuccess();
    } catch (err) {
      console.error('Error saving prompt:', err);
      error(`Error saving prompt: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="add-prompt-form bg-theme-surface rounded-lg p-5 border border-theme">
      <h3 className="type-heading mb-4 pb-2 border-b border-theme">
        {isEditing ? 'Edit Prompt' : 'Create New Prompt'}
      </h3>
      
      <div className="form-group mb-4">
        <label 
          htmlFor="contentType" 
          className="block mb-2 text-sm font-medium text-theme-secondary"
        >
          Content Type:
        </label>
        <select
          id="contentType"
          name="contentType"
          className="w-full p-2 bg-theme-surface text-theme-primary border border-theme rounded-md"
          value={formData.contentType}
          onChange={handleChange}
        >
          {Object.entries({
            ...CONTENT_TYPE_LABELS,
            [SHARED_TYPE]: 'Shared Prompts'
          }).map(([type, label]) => (
            <option key={type} value={type}>{label}</option>
          ))}
        </select>
      </div>
      
      <div className="form-group mb-4">
        <label 
          htmlFor="name" 
          className="block mb-2 text-sm font-medium text-theme-secondary"
        >
          Prompt Name:
        </label>
        <input
          type="text"
          id="name"
          name="name"
          className="w-full p-2 bg-theme-surface text-theme-primary border border-theme rounded-md"
          placeholder="Give your prompt a descriptive name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="form-group mb-4">
        <label 
          htmlFor="content" 
          className="block mb-2 text-sm font-medium text-theme-secondary"
        >
          Prompt Content:
        </label>
        <textarea
          id="content"
          name="content"
          className="w-full p-2 bg-theme-surface text-theme-primary border border-theme rounded-md min-h-[200px]"
          placeholder="Enter your prompt content here..."
          value={formData.content}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="form-actions flex justify-end gap-3 mt-5">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
        >
          Cancel
        </Button>
        
        <Button
          type="submit"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : (isEditing ? 'Update Prompt' : 'Create Prompt')}
        </Button>
      </div>
    </form>
  );
};

export default PromptForm;
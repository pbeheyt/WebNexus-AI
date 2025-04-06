// src/settings/components/ui/PromptForm.jsx
import React, { useState } from 'react';
import { Button, useNotification } from '../../../../components';
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
  
  return (
    <form onSubmit={handleSubmit} className="add-prompt-form bg-theme-surface rounded-lg p-6 border border-theme">
      <h3 className="type-heading mb-5 pb-3 border-b border-theme text-xl font-semibold text-theme-primary">
        {isEditing ? 'Edit Prompt' : 'Create New Prompt'}
      </h3>
      
      <div className="form-group mb-6">
        <label 
          htmlFor="contentType" 
          className="block mb-3 text-sm font-medium text-theme-secondary"
        >
          Content Type:
        </label>
        <div className="inline-block min-w-[200px] max-w-full">
          <select
            id="contentType"
            name="contentType"
            className="w-auto min-w-full p-2.5 bg-theme-surface text-theme-primary border border-theme rounded-md"
            value={formData.contentType}
            onChange={handleChange}
          >
            {/* Map directly over the imported CONTENT_TYPE_LABELS */}
            {Object.entries(CONTENT_TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      
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
          name="name"
          className="w-full p-2.5 bg-theme-surface text-theme-primary border border-theme rounded-md"
          placeholder="Give your prompt a descriptive name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="form-group mb-6">
        <label 
          htmlFor="content" 
          className="block mb-3 text-sm font-medium text-theme-secondary"
        >
          Prompt Content:
        </label>
        <textarea
          id="content"
          name="content"
          className="w-full p-3 bg-theme-surface text-theme-primary border border-theme rounded-md min-h-[220px]"
          placeholder="Enter your prompt content here..."
          value={formData.content}
          onChange={handleChange}
          required
        />
      </div>
      
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
        >
          {isSaving ? 'Saving...' : (isEditing ? 'Update Prompt' : 'Create Prompt')}
        </Button>
      </div>
    </form>
  );
};

export default PromptForm;
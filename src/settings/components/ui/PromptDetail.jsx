// src/settings/components/ui/PromptDetail.jsx
import React from 'react';
import { Button, useNotification } from '../../../components';
import { STORAGE_KEYS } from '../../../shared/constants';

const PromptDetail = ({ prompt, onEdit, onDelete }) => {
  const { success, error } = useNotification();
  
  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the prompt "${prompt.prompt.name}"?`)) {
      return;
    }
    
    try {
      // Get current prompts
      const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
      const customPromptsByType = result[STORAGE_KEYS.CUSTOM_PROMPTS] || {};
      
      // Check if prompt exists
      if (!customPromptsByType[prompt.contentType]?.prompts?.[prompt.id]) {
        throw new Error('Prompt not found');
      }
      
      // Delete the prompt
      delete customPromptsByType[prompt.contentType].prompts[prompt.id];
      
      // If this was the preferred prompt, reset to default
      if (customPromptsByType[prompt.contentType].preferredPromptId === prompt.id) {
        customPromptsByType[prompt.contentType].preferredPromptId = prompt.contentType;
      }
      
      // Save to storage
      await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_PROMPTS]: customPromptsByType });
      
      success('Prompt deleted successfully');
      onDelete();
    } catch (err) {
      console.error('Error deleting prompt:', err);
      error(`Error deleting prompt: ${err.message}`);
    }
  };
  
  return (
    <div className="prompt-detail bg-theme-surface rounded-lg p-5 border border-theme">
      <div className="prompt-detail-header flex justify-between items-center mb-4 pb-3 border-b border-theme">
        <h3 className="prompt-detail-title text-lg font-medium">
          {prompt.prompt.name}
        </h3>
      </div>
      
      <div className="prompt-detail-meta flex gap-4 mb-4 text-sm text-theme-secondary">
        <div><strong>Type:</strong> {prompt.contentTypeLabel}</div>
      </div>
      
      <div className="prompt-detail-content whitespace-pre-wrap bg-theme-hover/20 p-4 rounded-lg border border-theme mb-5 text-theme-secondary">
        {prompt.prompt.content}
      </div>
      
      <div className="prompt-detail-actions flex justify-end gap-3">
        <Button 
          variant="secondary"
          onClick={onEdit}
        >
          Edit
        </Button>
        
        <Button
          variant="danger"
          onClick={handleDelete}
        >
          Delete
        </Button>
      </div>
    </div>
  );
};

export default PromptDetail;
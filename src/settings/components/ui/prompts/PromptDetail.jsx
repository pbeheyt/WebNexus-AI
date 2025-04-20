// src/settings/components/ui/PromptDetail.jsx
import React, { useState, useEffect } from 'react'; // Added useState, useEffect
import { Button, useNotification } from '../../../../components';
import { STORAGE_KEYS } from '../../../../shared/constants';
import { getContentTypeIconSvg } from '../../../../shared/utils/icon-utils';

const PromptDetail = ({ prompt, onEdit, onDelete }) => {
  const { success, error } = useNotification();
  const [isDefaultForType, setIsDefaultForType] = useState(false); // State for default status

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the prompt "${prompt.prompt.name}"?`)) {
      return;
    }

    try {
      // Get current prompts
      const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
      const customPromptsByType = result[STORAGE_KEYS.CUSTOM_PROMPTS] || {};

      // Check if prompt exists
      // Use optional chaining for safer access
      if (!customPromptsByType[prompt.contentType]?.prompts?.[prompt.id]) {
        throw new Error('Prompt not found');
      }

      // Delete the prompt
      delete customPromptsByType[prompt.contentType].prompts[prompt.id];

      // Clean up empty content type entry if no prompts remain
      if (Object.keys(customPromptsByType[prompt.contentType]?.prompts || {}).length === 0) {
         // Check if other properties like preferredPromptId or settings exist before deleting
         if (!customPromptsByType[prompt.contentType]?.preferredPromptId && !customPromptsByType[prompt.contentType]?.settings) {
             delete customPromptsByType[prompt.contentType];
         } else if (!customPromptsByType[prompt.contentType]?.prompts) {
             // If prompts object itself was deleted, ensure it's gone
             delete customPromptsByType[prompt.contentType]?.prompts;
         }
      }

      // Save to storage
      await chrome.storage.sync.set({ [STORAGE_KEYS.CUSTOM_PROMPTS]: customPromptsByType });

      success('Prompt deleted successfully');
      onDelete(); // Notify parent component
    } catch (err) {
      console.error('Error deleting prompt:', err);
      error(`Error deleting prompt: ${err.message}`);
    }
  };

  // Effect to check if the current prompt is the default for its type
  useEffect(() => {
    const checkDefaultStatus = async () => {
      if (!prompt || !prompt.contentType || !prompt.id) {
        setIsDefaultForType(false);
        return;
      }
      try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE);
        const defaults = result[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};
        setIsDefaultForType(defaults[prompt.contentType] === prompt.id);
      } catch (err) {
        console.error('Error checking default prompt status:', err);
        setIsDefaultForType(false); // Assume not default on error
      }
    };
    checkDefaultStatus();
  }, [prompt]); // Rerun when the prompt prop changes

  // Function to handle setting the prompt as default
  const handleSetAsDefault = async () => {
    if (!prompt || !prompt.contentType || !prompt.id) {
      error('Cannot set default: Invalid prompt data.');
      return;
    }
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE);
      const currentDefaults = result[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};
      const updatedDefaults = {
        ...currentDefaults,
        [prompt.contentType]: prompt.id, // Set this prompt as default for its type
      };

      await chrome.storage.sync.set({ [STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE]: updatedDefaults });
      setIsDefaultForType(true); // Update local state immediately
      success(`"${prompt.prompt.name}" is now the default for ${prompt.contentTypeLabel}.`);
      // The PromptList component will update automatically via its storage listener.

    } catch (err) {
      console.error('Error setting default prompt:', err);
      error(`Failed to set default prompt: ${err.message}`);
    }
  };

  // Get the SVG icon string
  const iconSvg = getContentTypeIconSvg(prompt.contentType);

  return (
    <div className="prompt-detail bg-theme-surface rounded-lg p-5 border border-theme">
      <div className="prompt-detail-header flex justify-between items-center mb-4 pb-3 border-b border-theme">
        <h3 className="prompt-detail-title text-lg font-medium text-theme-primary">
          {prompt.prompt.name}
        </h3>
      </div>

      {/* Updated Content Type Display */}
      <div className="prompt-detail-meta mb-4 text-base text-theme-secondary">
        <div className="inline-flex items-center gap-2">
          <span>{prompt.contentTypeLabel}</span>
          {iconSvg && (
            <span
              className="w-4 h-4 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: iconSvg }}
            />
          )}
        </div>
      </div>

      <div className="prompt-detail-content whitespace-pre-wrap bg-theme-hover/20 p-4 rounded-lg border border-theme mb-5 text-sm text-theme-secondary">
        {prompt.prompt.content}
      </div>

      <div className="prompt-detail-actions flex justify-end gap-3">
        {!isDefaultForType && (
          <Button
            variant="success" // Or another suitable variant
            onClick={handleSetAsDefault}
          >
            Set as Default
          </Button>
        )}
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

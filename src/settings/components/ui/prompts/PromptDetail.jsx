// src/settings/components/ui/PromptDetail.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

import { logger } from '../../../../shared/logger';
import { Button, useNotification } from '../../../../components';
import { STORAGE_KEYS } from '../../../../shared/constants';
import { ensureDefaultPrompts } from '../../../../shared/utils/prompt-utils';
import { ContentTypeIcon } from '../../../../components/layout/ContentTypeIcon';

const PromptDetail = ({ prompt, onEdit, onDelete }) => {
  const { success, error } = useNotification();
  const [isDefaultForType, setIsDefaultForType] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const TRUNCATE_LENGTH = 200;
  const needsTruncation = prompt?.prompt?.content?.length > TRUNCATE_LENGTH;

  // Memoize handleDelete
  const handleDelete = useCallback(async () => {
    if (!prompt || !prompt.contentType || !prompt.id) {
      error('Cannot delete: Invalid prompt data.');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete the prompt "${prompt.prompt.name}"?`
      )
    ) {
      return;
    }

    try {
      // Get current prompts and defaults
      const [promptsResult, defaultsResult] = await Promise.all([
        chrome.storage.local.get(STORAGE_KEYS.CUSTOM_PROMPTS),
        chrome.storage.local.get(STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE),
      ]);
      const customPromptsByType =
        promptsResult[STORAGE_KEYS.CUSTOM_PROMPTS] || {};
      const currentDefaults =
        defaultsResult[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};

      const promptsForType =
        customPromptsByType[prompt.contentType]?.prompts || {};
      const isCurrentDefault =
        currentDefaults[prompt.contentType] === prompt.id;
      const otherPromptsExist = Object.keys(promptsForType).length > 1;

      // Check if deleting the last default prompt
      if (isCurrentDefault && !otherPromptsExist) {
        throw new Error(
          "Cannot delete the only prompt for this content type while it's set as default. Create another prompt or set a different one as default first."
        );
      }

      // Delete the prompt from the custom prompts structure
      if (customPromptsByType[prompt.contentType]?.prompts?.[prompt.id]) {
        delete customPromptsByType[prompt.contentType].prompts[prompt.id];
      } else {
        // Prompt might already be gone? Log a warning but proceed
        logger.settings.warn(
          `Prompt ID ${prompt.id} not found in custom prompts during deletion.`
        );
      }

      // Clean up empty content type entry if no prompts remain
      if (
        Object.keys(customPromptsByType[prompt.contentType]?.prompts || {})
          .length === 0
      ) {
        // Check if other properties like preferredPromptId or settings exist before deleting
        if (
          !customPromptsByType[prompt.contentType]?.preferredPromptId &&
          !customPromptsByType[prompt.contentType]?.settings
        ) {
          delete customPromptsByType[prompt.contentType];
        } else if (!customPromptsByType[prompt.contentType]?.prompts) {
          // If prompts object itself was deleted, ensure it's gone
          delete customPromptsByType[prompt.contentType]?.prompts;
        }
      }

      // Save updated prompts
      await chrome.storage.local.set({
        [STORAGE_KEYS.CUSTOM_PROMPTS]: customPromptsByType,
      });

      // Use centralized function to ensure default prompts are set correctly
      await ensureDefaultPrompts();

      success('Prompt deleted successfully');
      onDelete(); // Notify parent component
    } catch (err) {
      logger.settings.error('Error deleting prompt:', err);
      // Display the specific error message from the check
      error(`Error deleting prompt: ${err.message}`, 10000);
    }
  }, [prompt, error, success, onDelete]); // Add dependencies

  // Effect to check if the current prompt is the default for its type
  useEffect(() => {
    const checkDefaultStatus = async () => {
      if (!prompt || !prompt.contentType || !prompt.id) {
        setIsDefaultForType(false);
        return;
      }
      try {
        const result = await chrome.storage.local.get(
          STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE
        );
        const defaults = result[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};
        setIsDefaultForType(defaults[prompt.contentType] === prompt.id);
      } catch (err) {
        logger.settings.error('Error checking default prompt status:', err);
        setIsDefaultForType(false); // Assume not default on error
      }
    };
    // Listener for storage changes to update the badge dynamically
    const handleStorageChange = (changes, area) => {
      if (area === 'local' && changes[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE]) {
        const newDefaults =
          changes[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE].newValue || {};
        if (prompt && prompt.contentType && prompt.id) {
          setIsDefaultForType(newDefaults[prompt.contentType] === prompt.id);
        }
      }
    };

    checkDefaultStatus(); // Initial check

    // Add listener
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    // Cleanup listener on component unmount or when prompt changes
    return () => {
      if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, [prompt]); // Rerun when the prompt prop changes

  // Memoize handleSetAsDefault
  const handleSetAsDefault = useCallback(async () => {
    if (!prompt || !prompt.contentType || !prompt.id) {
      error('Cannot set default: Invalid prompt data.');
      return;
    }
    try {
      const result = await chrome.storage.local.get(
        STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE
      );
      const currentDefaults =
        result[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {};
      const updatedDefaults = {
        ...currentDefaults,
        [prompt.contentType]: prompt.id, // Set this prompt as default for its type
      };

      await chrome.storage.local.set({
        [STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE]: updatedDefaults,
      });
      // No need to call setIsDefaultForType(true) here, the storage listener will handle it
      success(
        `"${prompt.prompt.name}" is now the default for ${prompt.contentTypeLabel}.`
      );
    } catch (err) {
      logger.settings.error('Error setting default prompt:', err);
      error(`Failed to set default prompt: ${err.message}`);
    }
  }, [prompt, error, success]);

  return (
    <div className='prompt-detail bg-theme-surface rounded-lg p-5 border border-theme'>
      {/* Header with Conditional Badge */}
      <div className='prompt-detail-header flex items-center justify-between mb-4 pb-3 border-b border-theme'>
        <div className='flex items-center min-w-0'>
          {' '}
          {/* Wrapper for title and badge */}
          <h3 className='prompt-detail-title text-lg font-medium text-theme-primary select-none truncate'>
            {prompt.prompt.name}
          </h3>
          {/* Conditionally render the Default badge */}
          {isDefaultForType && (
            <span className='default-badge ml-3 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 px-2 py-1 rounded-full font-medium select-none'>
              Default
            </span>
          )}
        </div>
      </div>

      {/* Content Type Display */}
      <div className='prompt-detail-meta mb-4 text-base text-theme-secondary select-none'>
        <div className='inline-flex items-center gap-2'>
          <ContentTypeIcon
            contentType={prompt.contentType}
            className='w-4 h-4 flex items-center justify-center select-none'
            />
          <span>{prompt.contentTypeLabel}</span>
        </div>
      </div>

      {/* Prompt Content */}
      <div className={`prompt-detail-content whitespace-pre-wrap bg-gray-100 dark:bg-gray-700 p-4 rounded-lg border border-theme mb-5 text-sm text-theme-secondary select-none overflow-hidden ${needsTruncation && !isExpanded ? 'line-clamp-5' : ''}`}>
        {prompt.prompt.content}
      </div>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-primary hover:underline text-sm ml-2 font-medium"
        >
          {isExpanded ? 'Show Less' : 'Show More'}
        </button>
      )}

      {/* Action Buttons */}
      <div className='prompt-detail-actions flex justify-end gap-3'>
        <Button
          variant='secondary'
          onClick={handleSetAsDefault}
          className={`${isDefaultForType ? 'invisible' : ''} select-none`}
        >
          Set as Default
        </Button>
        <Button
          variant='secondary'
          onClick={onEdit}
          className='select-none'
        >
          Edit
        </Button>

        <Button
          variant='danger'
          onClick={handleDelete}
          className='select-none'
        >
          Delete
        </Button>
      </div>
    </div>
  );
};

PromptDetail.propTypes = {
  prompt: PropTypes.object.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default React.memo(PromptDetail);

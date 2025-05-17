// src/settings/components/ui/PromptDetail.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

import { logger } from '../../../../shared/logger';
import { Button, useNotification } from '../../../../components';
import { STORAGE_KEYS } from '../../../../shared/constants';
import { ensureDefaultPrompts } from '../../../../shared/utils/prompt-utils';
import { ContentTypeIcon } from '../../../../components/layout/ContentTypeIcon';
import useMinimumLoadingTime from '../../../../hooks/useMinimumLoadingTime';

const PromptDetail = ({ prompt, onEdit, onDelete }) => {
  const { success, error } = useNotification();
  const [isDefaultForType, setIsDefaultForType] = useState(false);

  const [isDeletingActual, setIsDeletingActual] = useState(false);
  const [isSettingDefaultActual, setIsSettingDefaultActual] = useState(false);

  const shouldShowDeleting = useMinimumLoadingTime(isDeletingActual);
  const shouldShowSettingDefault = useMinimumLoadingTime(isSettingDefaultActual);
    
  const handleDelete = useCallback(async () => {
    if (!prompt || !prompt.contentType || !prompt.id) {
      error('Cannot delete: Invalid prompt data.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the prompt "${prompt.prompt.name}"?`)) {
      return;
    }

    setIsDeletingActual(true);
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.USER_CUSTOM_PROMPTS);
      const customPromptsByType = result[STORAGE_KEYS.USER_CUSTOM_PROMPTS] || {};
      
      const typeData = customPromptsByType[prompt.contentType] || {};
      const isCurrentDefault = typeData['_defaultPromptId_'] === prompt.id;
      
      const promptsForType = {};
      for (const key in typeData) {
        if (key !== '_defaultPromptId_') {
          promptsForType[key] = typeData[key];
        }
      }
      const otherPromptsExist = Object.keys(promptsForType).length > 1;

      if (isCurrentDefault && !otherPromptsExist) {
        throw new Error(
          "Cannot delete the only prompt for this content type while it's set as default. Create another prompt or set a different one as default first."
        );
      }

      if (customPromptsByType[prompt.contentType]?.[prompt.id]) {
        delete customPromptsByType[prompt.contentType][prompt.id];
        if (customPromptsByType[prompt.contentType]?.['_defaultPromptId_'] === prompt.id) {
          delete customPromptsByType[prompt.contentType]['_defaultPromptId_'];
        }
      } else {
        logger.settings.warn(`Prompt ID ${prompt.id} not found in custom prompts during deletion.`);
      }

      if (customPromptsByType[prompt.contentType] && Object.keys(customPromptsByType[prompt.contentType]).length === 0) {
        delete customPromptsByType[prompt.contentType];
      }

      await chrome.storage.local.set({ [STORAGE_KEYS.USER_CUSTOM_PROMPTS]: customPromptsByType });
      await ensureDefaultPrompts();
      success('Prompt deleted successfully.');
      onDelete();
    } catch (err) {
      logger.settings.error('Error deleting prompt:', err);
      error(`Error deleting prompt: ${err.message}`);
    } finally {
      setIsDeletingActual(false);
    }
  }, [prompt, error, success, onDelete]);

  useEffect(() => {
    const checkDefaultStatus = async () => {
      if (!prompt || !prompt.contentType || !prompt.id) {
        setIsDefaultForType(false);
        return;
      }
      try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.USER_CUSTOM_PROMPTS);
        const customPrompts = result[STORAGE_KEYS.USER_CUSTOM_PROMPTS] || {};
        const typeData = customPrompts[prompt.contentType] || {};
        setIsDefaultForType(typeData['_defaultPromptId_'] === prompt.id);
      } catch (err) {
        logger.settings.error('Error checking default prompt status:', err);
        setIsDefaultForType(false);
      }
    };
    const handleStorageChange = (changes, area) => {
      if (area === 'local' && changes[STORAGE_KEYS.USER_CUSTOM_PROMPTS]) {
        const newCustomPrompts = changes[STORAGE_KEYS.USER_CUSTOM_PROMPTS].newValue || {};
        if (prompt && prompt.contentType && prompt.id) {
          const newTypeData = newCustomPrompts[prompt.contentType] || {};
          setIsDefaultForType(newTypeData['_defaultPromptId_'] === prompt.id);
        }
      }
    };

    checkDefaultStatus();
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }
    return () => {
      if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, [prompt]);

  const handleSetAsDefault = useCallback(async () => {
    if (!prompt || !prompt.contentType || !prompt.id) {
      error('Cannot set default: Invalid prompt data.');
      return;
    }
    setIsSettingDefaultActual(true);
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.USER_CUSTOM_PROMPTS);
      const customPrompts = result[STORAGE_KEYS.USER_CUSTOM_PROMPTS] || {};
      
      if (!customPrompts[prompt.contentType]) {
        customPrompts[prompt.contentType] = {};
      }
      customPrompts[prompt.contentType]['_defaultPromptId_'] = prompt.id;

      await chrome.storage.local.set({ [STORAGE_KEYS.USER_CUSTOM_PROMPTS]: customPrompts });
      success(`"${prompt.prompt.name}" is now the default for ${prompt.contentTypeLabel}.`);
    } catch (err) {
      logger.settings.error('Error setting default prompt:', err);
      error(`Failed to set default prompt: ${err.message}`);
    } finally {
      setIsSettingDefaultActual(false);
    }
  }, [prompt, error, success]);

  const anyActionLoading = shouldShowDeleting || shouldShowSettingDefault;

  return (
    <div className='prompt-detail bg-theme-surface shadow-sm rounded-lg p-5 border border-theme'>
        <div className='prompt-detail-header flex items-center justify-between mb-4 pb-3 border-b border-theme'>
          <div className='flex items-center min-w-0'>
            <h3 className='prompt-detail-title text-base font-semibold text-theme-primary truncate'>
              {prompt.prompt.name}
            </h3>
          </div>
          {isDefaultForType && (
            <span className='default-badge text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 px-2 py-1 rounded-full font-semibold'>
              Default
            </span>
          )}
        </div>

        <div className='prompt-detail-meta mb-4 text-base text-theme-secondary'>
        <div className='inline-flex items-center gap-2'>
          <ContentTypeIcon
            contentType={prompt.contentType}
            className='w-4 h-4 flex items-center justify-center'
            />
          <span>{prompt.contentTypeLabel}</span>
        </div>
      </div>

      <div className={`prompt-detail-content whitespace-pre-wrap  p-4 rounded-lg bg-theme-hover border border-theme mb-5 text-sm text-theme-primary overflow-hidden prompt-content-scrollable`}>
        {prompt.prompt.content}
      </div>

      <div className='prompt-detail-actions flex justify-end gap-3'>
        <Button
          variant='secondary'
          onClick={handleSetAsDefault}
          isLoading={shouldShowSettingDefault}
          disabled={anyActionLoading || isDefaultForType}
          className={`select-none transition-all duration-300 ease-in-out ${
            isDefaultForType
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100 pointer-events-auto'
          }`}
        >
          {isSettingDefaultActual ? "Setting..." : "Set as Default"}
        </Button>
        <Button
          variant='secondary'
          onClick={onEdit}
          disabled={anyActionLoading}
          className='select-none'
        >
          Edit
        </Button>
        <Button
          variant='danger'
          onClick={handleDelete}
          isLoading={shouldShowDeleting}
          disabled={anyActionLoading}
          className='select-none'
        >
          {isDeletingActual ? "Deleting..." : "Delete"}
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

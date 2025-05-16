// src/settings/components/ui/prompts/PromptList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';

import { logger } from '../../../../shared/logger';
import { useNotification } from '../../../../components';
import { STORAGE_KEYS } from '../../../../shared/constants';
import { ContentTypeIcon } from '../../../../components/layout/ContentTypeIcon';
import { CustomSelect } from '../../../../components/core/CustomSelect';
import SettingsCard from '../../ui/common/SettingsCard';

const PromptList = ({
  filterValue,
  contentTypeLabels,
  onSelectPrompt,
  selectedPromptId,
  onFilterChange,
}) => {
  const { error } = useNotification();
  const [prompts, setPrompts] = useState([]);
  const [filteredPrompts, setFilteredPrompts] = useState([]);
  const [defaultPromptIds, setDefaultPromptIds] = useState({});
  
  const promptListRef = useRef(null);
  const [promptListHasScrollbar, setPromptListHasScrollbar] = useState(false);

  // Load prompts and default settings
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEYS.USER_CUSTOM_PROMPTS);
        const customPromptsByType = result[STORAGE_KEYS.USER_CUSTOM_PROMPTS] || {};
        const uniquePromptsMap = new Map();
        const newDefaultPromptIds = {};
        
        Object.entries(customPromptsByType).forEach(([type, promptsInTypeObject]) => {
          if (promptsInTypeObject && typeof promptsInTypeObject === 'object') {
            if (promptsInTypeObject['_defaultPromptId_']) {
              newDefaultPromptIds[type] = promptsInTypeObject['_defaultPromptId_'];
            }
            Object.entries(promptsInTypeObject).forEach(([id, promptObjectValue]) => {
              if (id !== '_defaultPromptId_') {
                uniquePromptsMap.set(id, {
                  id,
                  prompt: promptObjectValue,
                  contentType: type,
                  contentTypeLabel: contentTypeLabels[type] || type,
                });
              }
            });
          }
        });
        
        const allPrompts = Array.from(uniquePromptsMap.values());
        allPrompts.sort((a, b) => new Date(b.prompt.updatedAt || 0) - new Date(a.prompt.updatedAt || 0));
        setPrompts(allPrompts);
        setDefaultPromptIds(newDefaultPromptIds);
      } catch (err) {
        logger.settings.error('Error loading prompts or defaults:', err);
        error('Failed to load prompts or default settings');
      }
    };
    loadData();
  }, [contentTypeLabels, error]);

  // Filter prompts
  useEffect(() => {
    if (filterValue === 'all') {
      setFilteredPrompts(prompts);
    } else {
      setFilteredPrompts(prompts.filter((item) => item.contentType === filterValue));
    }
  }, [filterValue, prompts]);

  // Check for scrollbar on prompt list when filteredPrompts changes
  useEffect(() => {
    if (promptListRef.current) {
      const hasScrollbar = promptListRef.current.scrollHeight > promptListRef.current.clientHeight;
      setPromptListHasScrollbar(hasScrollbar);
    } else {
      setPromptListHasScrollbar(false);
    }
  }, [filteredPrompts]);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = (changes, area) => {
      if (area === 'local' && changes[STORAGE_KEYS.USER_CUSTOM_PROMPTS]) {
        logger.settings.info('Custom prompts changed, extracting new defaults...');
        const newCustomPrompts = changes[STORAGE_KEYS.USER_CUSTOM_PROMPTS].newValue || {};
        const newDefaultIds = {};
        Object.entries(newCustomPrompts).forEach(([type, typeData]) => {
          if (typeData && typeData['_defaultPromptId_']) {
            newDefaultIds[type] = typeData['_defaultPromptId_'];
          }
        });
        setDefaultPromptIds(newDefaultIds);
      }
    };

    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }
    return () => {
      if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

  const filterOptions = useMemo(
    () => [
      ...Object.entries(contentTypeLabels).map(([type, label]) => ({
        id: type,
        name: label,
      })),
    ],
    [contentTypeLabels]
  );

  // Dynamically set the className for the prompt-list div
  const promptListClasses = `prompt-list max-h-[550px] overflow-y-auto ${promptListHasScrollbar ? 'pr-3' : ''}`;

  return (
    <>
      <SettingsCard className="mb-4"> 
          <h3 className='text-base font-semibold text-theme-primary mb-3'>
            Content Type Selection
          </h3>
          <CustomSelect
            options={filterOptions}
            selectedValue={filterValue}
            onChange={onFilterChange}
            placeholder='Filter by Content Type'
          />
      </SettingsCard>

      {filteredPrompts.length === 0 ? (
        <div 
          ref={promptListRef} // Ref for scrollbar check even when empty
          className={`empty-state bg-theme-surface p-6 text-center text-theme-secondary rounded-lg border border-theme ${promptListHasScrollbar ? 'pr-3' : ''}`}
        >
          <p className='text-sm'>
            No prompts available
            {filterValue !== 'all'
              ? ` for ${contentTypeLabels[filterValue]}`
              : ''}
            . Create a new prompt to get started.
          </p>
        </div>
      ) : (
        <div 
          ref={promptListRef}
          className={promptListClasses} // Apply dynamic classes here
        >
          {filteredPrompts.map((item) => (
            <button
              type='button'
              key={item.id}
              className={`prompt-item rounded-lg p-4 mb-4 shadow-sm cursor-pointer select-none transition-all border border-theme w-full text-left
                ${
                  selectedPromptId === item.id
                    ? ' bg-theme-hover shadow-sm'
                    : ' bg-white dark:bg-theme-surface'
                }
              `}
              onClick={() => onSelectPrompt(item)}
            >
              <div className='prompt-header flex justify-between items-center mb-3'>
                <h3 className='prompt-title font-medium text-base truncate text-theme-primary select-none'>
                  {item.prompt.name}
                </h3>
              </div>
              <small className='flex items-center justify-between text-theme-secondary text-xs select-none min-h-6'>
                <div className='inline-flex items-center gap-2 select-none'>
                  <ContentTypeIcon
                    contentType={item.contentType}
                    className='w-4 h-4 flex items-center justify-center select-none'
                    />
                  <span>{item.contentTypeLabel}</span>
                </div>
                {item.id === defaultPromptIds[item.contentType] && (
                  <span className='default-badge text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-full select-none'>
                    Default
                  </span>
                )}
              </small>
            </button>
          ))}
        </div>
      )}
    </>
  );
};

PromptList.propTypes = {
  filterValue: PropTypes.string.isRequired,
  contentTypeLabels: PropTypes.object.isRequired,
  onSelectPrompt: PropTypes.func.isRequired,
  selectedPromptId: PropTypes.string,
  onFilterChange: PropTypes.func.isRequired,
};

export default React.memo(PromptList);
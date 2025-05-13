// src/settings/components/ui/prompts/PromptList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';

import { logger } from '../../../../shared/logger';
import { useNotification } from '../../../../components';
import { STORAGE_KEYS } from '../../../../shared/constants';
import { ContentTypeIcon } from '../../../../components/layout/ContentTypeIcon';
import { CustomSelect } from '../../../../components/core/CustomSelect';

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

  // Load prompts and default settings when component mounts or dependencies change
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch custom prompts which now contain default IDs
        const result = await chrome.storage.local.get(STORAGE_KEYS.USER_CUSTOM_PROMPTS);
        const customPromptsByType = result[STORAGE_KEYS.USER_CUSTOM_PROMPTS] || {};
        
        // Process prompts and extract default IDs
        const uniquePromptsMap = new Map();
        const newDefaultPromptIds = {};
        
        Object.entries(customPromptsByType).forEach(([type, promptsInTypeObject]) => {
          if (promptsInTypeObject && typeof promptsInTypeObject === 'object') {
            // Extract default prompt ID for this type if it exists
            if (promptsInTypeObject['_defaultPromptId_']) {
              newDefaultPromptIds[type] = promptsInTypeObject['_defaultPromptId_'];
            }
            
            // Process actual prompts (excluding _defaultPromptId_)
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
        allPrompts.sort(
          (a, b) =>
            new Date(b.prompt.updatedAt || 0) -
            new Date(a.prompt.updatedAt || 0)
        );
        setPrompts(allPrompts);
        setDefaultPromptIds(newDefaultPromptIds);
      } catch (err) {
        logger.settings.error('Error loading prompts or defaults:', err);
        error('Failed to load prompts or default settings');
      }
    };
    loadData();
  }, [contentTypeLabels, error]); // Dependency on contentTypeLabels prop

  // Filter prompts based on the filterValue prop from the parent
  useEffect(() => {
    if (filterValue === 'all') {
      setFilteredPrompts(prompts);
    } else {
      setFilteredPrompts(
        prompts.filter((item) => item.contentType === filterValue)
      );
    }
  }, [filterValue, prompts]);

  // Effect to listen for changes in custom prompts storage
  useEffect(() => {
    const handleStorageChange = (changes, area) => {
      if (area === 'local' && changes[STORAGE_KEYS.USER_CUSTOM_PROMPTS]) {
        logger.settings.info('Custom prompts changed, extracting new defaults...');
        const newCustomPrompts = changes[STORAGE_KEYS.USER_CUSTOM_PROMPTS].newValue || {};
        const newDefaultIds = {};
        
        // Extract default prompt IDs from the new structure
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

    // Cleanup listener on component unmount
    return () => {
      if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  // Format options for the CustomSelect component
  const filterOptions = useMemo(
    () => [
      ...Object.entries(contentTypeLabels).map(([type, label]) => ({
        id: type,
        name: label,
      })),
    ],
    [contentTypeLabels]
  ); // Dependency on contentTypeLabels prop

  return (
    <>
      <div className='form-group mb-4'>
        <CustomSelect
          options={filterOptions}
          selectedValue={filterValue}
          onChange={onFilterChange}
          placeholder='Filter by Content Type'
          buttonClassName='bg-white'
        />
      </div>

      {filteredPrompts.length === 0 ? (
        <div className='empty-state bg-theme-surface p-6 text-center text-theme-secondary rounded-lg border border-theme'>
          <p className='text-sm'>
            No prompts available
            {filterValue !== 'all'
              ? ` for ${contentTypeLabels[filterValue]}`
              : ''}
            . Create a new prompt to get started.
          </p>
        </div>
      ) : (
        <div className='prompt-list max-h-[550px] overflow-y-auto pr-3'>
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

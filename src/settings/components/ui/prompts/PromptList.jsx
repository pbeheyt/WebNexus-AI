// src/settings/components/ui/prompts/PromptList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNotification } from '../../../../components';
import { STORAGE_KEYS } from '../../../../shared/constants';
import { getContentTypeIconSvg } from '../../../../shared/utils/icon-utils.js';
import { CustomSelect } from '../../../../components/core/CustomSelect';

const PromptList = ({
  filterValue,
  contentTypeLabels,
  onSelectPrompt,
  selectedPromptId,
  onFilterChange
}) => {
  const { error } = useNotification();
  const [prompts, setPrompts] = useState([]);
  const [filteredPrompts, setFilteredPrompts] = useState([]);
  const [defaultPromptIds, setDefaultPromptIds] = useState({});

  // Load prompts and default settings when component mounts or dependencies change
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch both custom prompts and default settings
        const [promptsResult, defaultsResult] = await Promise.all([
          chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS),
          chrome.storage.sync.get(STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE)
        ]);

        // Process custom prompts
        const customPromptsByType = promptsResult[STORAGE_KEYS.CUSTOM_PROMPTS] || {};
        const uniquePromptsMap = new Map();
        Object.entries(customPromptsByType).forEach(([type, data]) => {
          if (data.prompts) {
            Object.entries(data.prompts).forEach(([id, prompt]) => {
              // Use the passed contentTypeLabels prop for consistency
              uniquePromptsMap.set(id, {
                id,
                prompt,
                contentType: type,
                contentTypeLabel: contentTypeLabels[type] || type
              });
            });
          }
        });
        const allPrompts = Array.from(uniquePromptsMap.values());
        allPrompts.sort((a, b) => new Date(b.prompt.updatedAt || 0) - new Date(a.prompt.updatedAt || 0));
        setPrompts(allPrompts);

        // Process and store default prompt IDs
        setDefaultPromptIds(defaultsResult[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE] || {}); // Store the defaults object

      } catch (err) {
        console.error('Error loading prompts or defaults:', err);
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
      setFilteredPrompts(prompts.filter(item => item.contentType === filterValue));
    }
  }, [filterValue, prompts]);

  // Effect to listen for changes in default prompts storage
  useEffect(() => {
    const handleStorageChange = (changes, area) => {
      if (area === 'sync' && changes[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE]) {
        console.log('Default prompts changed, reloading defaults...');
        const newDefaults = changes[STORAGE_KEYS.DEFAULT_PROMPTS_BY_TYPE].newValue || {};
        setDefaultPromptIds(newDefaults);
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
  const filterOptions = useMemo(() => [
    ...Object.entries(contentTypeLabels).map(([type, label]) => ({
      id: type,
      name: label
    }))
  ], [contentTypeLabels]); // Dependency on contentTypeLabels prop

  return (
    <>
      <div className="form-group mb-4">
        <CustomSelect
          options={filterOptions}
          selectedValue={filterValue}
          onChange={onFilterChange} 
          placeholder="Filter by Content Type"
        />
      </div>

      {filteredPrompts.length === 0 ? (
        <div className="empty-state bg-theme-surface p-6 text-center text-theme-secondary rounded-lg">
          <p className="text-sm">No prompts available{filterValue !== 'all' ? ` for ${contentTypeLabels[filterValue]}` : ''}. Create a new prompt to get started.</p>
        </div>
      ) : (
        <div className="prompt-list max-h-[550px] overflow-y-auto pr-3">
          {filteredPrompts.map((item) => (
            <div
              key={item.id}
              className={`prompt-item rounded-lg p-5 mb-4 cursor-pointer select-none transition-all
                ${selectedPromptId === item.id
                  ? ' bg-gray-100 dark:bg-gray-700 shadow-md'
                  : ' bg-white dark:bg-theme-surface'}
              `}
              onClick={() => onSelectPrompt(item)}
            >
              <div className="prompt-header flex justify-between items-center mb-3">
                <h3 className="prompt-title font-medium text-base truncate text-gray-800 dark:text-gray-100 select-none">
                  {item.prompt.name}
                </h3>
              </div>
              <small className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs select-none">
                <div className="flex items-center">
                  {item.contentTypeLabel}
                  <span
                    className="flex items-center justify-center ml-2 w-4 h-4 select-none"
                    dangerouslySetInnerHTML={{ __html: getContentTypeIconSvg(item.contentType) }}
                  />
                </div>
                {item.id === defaultPromptIds[item.contentType] && (
                  <span className="default-badge text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full select-none">Default</span>
                )}
              </small>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default PromptList;
// src/settings/components/ui/prompts/PromptList.jsx
import React, { useState, useEffect } from 'react';
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

  // Load prompts when component mounts or dependencies change
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
        const customPromptsByType = result[STORAGE_KEYS.CUSTOM_PROMPTS] || {};

        const uniquePromptsMap = new Map();
        Object.entries(customPromptsByType).forEach(([type, data]) => {
          if (data.prompts) {
            Object.entries(data.prompts).forEach(([id, prompt]) => {
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

      } catch (err) {
        console.error('Error loading prompts:', err);
        error('Failed to load prompts');
      }
    };
    loadPrompts();
  }, [contentTypeLabels, error]);

  // Filter prompts based on the filterValue prop from the parent
  useEffect(() => {
    if (filterValue === 'all') {
      setFilteredPrompts(prompts);
    } else {
      setFilteredPrompts(prompts.filter(item => item.contentType === filterValue));
    }
  }, [filterValue, prompts]);

  // Format options for the CustomSelect component
  const filterOptions = [
    { id: 'all', name: 'All Content Types' },
    ...Object.keys(contentTypeLabels).map(type => ({
      id: type,
      name: contentTypeLabels[type]
    }))
  ];

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
        <div className="empty-state bg-theme-surface p-6 text-center text-theme-secondary rounded-lg border border-theme">
          <p className="text-sm">No prompts available{filterValue !== 'all' ? ` for ${contentTypeLabels[filterValue]}` : ''}. Create a new prompt to get started.</p>
        </div>
      ) : (
        <div className="prompt-list max-h-[550px] overflow-y-auto pr-3">
          {filteredPrompts.map((item) => (
            <div
              key={item.id}
              className={`prompt-item border border-theme rounded-lg p-5 mb-4 bg-theme-surface cursor-pointer transition-all hover:bg-theme-hover hover:border-primary ${
                selectedPromptId === item.id ? 'border-primary bg-theme-active shadow-sm' : ''
              }`}
              onClick={() => onSelectPrompt(item)}
            >
              <div className="prompt-header flex justify-between items-center mb-3">
                <h3 className="prompt-title font-medium text-base truncate text-theme-primary">
                  {item.prompt.name}
                </h3>
              </div>
              <small className="flex items-center text-theme-secondary text-xs">
                {item.contentTypeLabel}
                <span
                  className="flex items-center justify-center ml-2 w-4 h-4"
                  dangerouslySetInnerHTML={{ __html: getContentTypeIconSvg(item.contentType) }}
                />
              </small>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default PromptList;

import React, { useState, useEffect } from 'react';
import { useNotification } from '../../../../components';
import { STORAGE_KEYS, CONTENT_TYPES, SHARED_TYPE } from '../../../../shared/constants';

const PromptList = ({ 
  filterValue, 
  contentTypeLabels, 
  onSelectPrompt, 
  selectedPromptId,
  isLoading 
}) => {
  const { error } = useNotification();
  const [prompts, setPrompts] = useState([]);
  const [filteredPrompts, setFilteredPrompts] = useState([]);
  const [localLoading, setLocalLoading] = useState(true);
  
  // Load prompts when component mounts
  useEffect(() => {
    const loadPrompts = async () => {
      setLocalLoading(true);
      
      try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);
        const customPromptsByType = result[STORAGE_KEYS.CUSTOM_PROMPTS] || {};
        
        // Collect all prompts
        const allPrompts = [];
        
        Object.entries(customPromptsByType).forEach(([type, data]) => {
          if (data.prompts) {
            Object.entries(data.prompts).forEach(([id, prompt]) => {
              allPrompts.push({
                id,
                prompt,
                contentType: type,
                contentTypeLabel: contentTypeLabels[type] || type
              });
            });
          }
        });
        
        // Sort prompts by update time (most recent first)
        allPrompts.sort((a, b) => {
          return new Date(b.prompt.updatedAt || 0) - new Date(a.prompt.updatedAt || 0);
        });
        
        setPrompts(allPrompts);
      } catch (err) {
        console.error('Error loading prompts:', err);
        error('Failed to load prompts');
      } finally {
        setLocalLoading(false);
      }
    };
    
    loadPrompts();
  }, [contentTypeLabels, error, selectedPromptId]);
  
  // Filter prompts when filter value changes
  useEffect(() => {
    if (filterValue === 'all') {
      setFilteredPrompts(prompts);
    } else {
      setFilteredPrompts(prompts.filter(item => item.contentType === filterValue));
    }
  }, [filterValue, prompts]);

  const contentTypeColors = {
    [CONTENT_TYPES.GENERAL]: 'bg-blue-500',
    [CONTENT_TYPES.REDDIT]: 'bg-orange-500',
    [CONTENT_TYPES.YOUTUBE]: 'bg-red-500',
    [CONTENT_TYPES.PDF]: 'bg-violet-500',
    [SHARED_TYPE]: 'bg-gray-500',
    default: 'bg-gray-400'
  };
  
  if (isLoading || localLoading) {
    return (
      <div className="animate-pulse space-y-4 mt-2">
        <div className="h-24 bg-theme-hover rounded-lg"></div>
        <div className="h-24 bg-theme-hover rounded-lg"></div>
        <div className="h-24 bg-theme-hover rounded-lg"></div>
      </div>
    );
  }
  
  if (filteredPrompts.length === 0) {
    return (
      <div className="empty-state bg-theme-surface p-6 text-center text-theme-secondary rounded-lg border border-theme">
        <p className="text-base">No prompts available{filterValue !== 'all' ? ` for ${contentTypeLabels[filterValue]}` : ''}. Create a new prompt to get started.</p>
      </div>
    );
  }
  
  return (
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
            <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${contentTypeColors[item.contentType] || contentTypeColors.default}`}></span>
            {item.contentTypeLabel}
          </small>
        </div>
      ))}
    </div>
  );
};

export default PromptList;
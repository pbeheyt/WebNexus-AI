import { useEffect, useState } from 'react';
import { useContent } from '../../components';
import { usePrompts } from '../contexts/PromptContext';
import { useStatus } from '../contexts/StatusContext';
import { SHARED_TYPE, STORAGE_KEYS } from '../../shared/constants';

export function CustomPromptSelector() {
  const { contentType } = useContent();
  const { selectedPromptId, selectPrompt } = usePrompts();
  const { notifyCustomPromptChanged } = useStatus();
  const [prompts, setPrompts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!contentType) return;

    const loadCustomPrompts = async () => {
      setIsLoading(true);
      try {
        // Load custom prompts from storage
        const { custom_prompts_by_type: customPromptsByType = {} } =
          await chrome.storage.sync.get(STORAGE_KEYS.CUSTOM_PROMPTS);

        // Get content-specific prompts
        const contentPrompts = customPromptsByType[contentType]?.prompts || {};

        // Also get shared prompts (if not already on shared type)
        const sharedPrompts = contentType !== SHARED_TYPE
          ? customPromptsByType[SHARED_TYPE]?.prompts || {}
          : {};

        // Combine prompts
        const combinedPrompts = [];

        // Add content-specific prompts
        Object.entries(contentPrompts).forEach(([id, prompt]) => {
          combinedPrompts.push({
            id,
            name: prompt.name,
            isShared: false
          });
        });

        // Add shared prompts
        Object.entries(sharedPrompts).forEach(([id, prompt]) => {
          combinedPrompts.push({
            id,
            name: prompt.name,
            isShared: true
          });
        });

        setPrompts(combinedPrompts);
      } catch (error) {
        console.error('Error loading custom prompts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCustomPrompts();
  }, [contentType]);

  const handlePromptChange = async (e) => {
    const promptId = e.target.value;
    if (promptId === selectedPromptId) return;

    const success = await selectPrompt(promptId);
    if (success) {
      const selectedPrompt = prompts.find(p => p.id === promptId);
      if (selectedPrompt) {
        notifyCustomPromptChanged(selectedPrompt.name);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-3 bg-background-surface rounded-md border border-border">
        <div className="animate-pulse h-8 bg-gray-300 rounded w-full"></div>
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="p-3 bg-background-surface rounded-md border border-border">
        <p className="text-text-secondary text-sm text-center">
          No custom prompts available. Create one in settings.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 bg-background-surface rounded-md border border-border">
      <select
        value={selectedPromptId || ''}
        onChange={handlePromptChange}
        className="w-full p-2 bg-background-surface text-text-primary border border-border rounded"
      >
        {/* Content-specific prompts group */}
        <optgroup label="Content-Specific Prompts">
          {prompts
            .filter(p => !p.isShared)
            .map(prompt => (
              <option key={prompt.id} value={prompt.id}>
                {prompt.name}
              </option>
            ))
          }
        </optgroup>

        {/* Shared prompts group */}
        {prompts.some(p => p.isShared) && (
          <optgroup label="Shared Prompts">
            {prompts
              .filter(p => p.isShared)
              .map(prompt => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.name}
                </option>
              ))
            }
          </optgroup>
        )}
      </select>
    </div>
  );
}

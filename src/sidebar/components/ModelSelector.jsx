import React from 'react';
import { useSidebarPlatform } from '../contexts/SidebarPlatformContext';

function ModelSelector() {
  const { models, selectedModel, selectModel, isLoading } = useSidebarPlatform();

  if (isLoading) {
    return (
      <div className="relative w-full">
        <select className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer text-sm" disabled>
          <option>Loading models...</option>
        </select>
      </div>
    );
  }

  // Format models array for selection
  const formatModels = () => {
    if (!models || models.length === 0) {
      return [];
    }

    if (Array.isArray(models)) {
      return models.map(model => {
        const modelId = typeof model === 'object' ? model.id : model;
        const modelName = typeof model === 'object' ? model.id : model;
        return { id: modelId, name: modelName };
      });
    }

    return Object.entries(models).map(([key, model]) => {
      const modelId = typeof model === 'object' ? model.id : key;
      const modelName = typeof model === 'object' ? model.id : key;
      return { id: modelId, name: modelName };
    });
  };

  const formattedModels = formatModels();

  if (formattedModels.length === 0) {
    return (
      <div className="relative w-full">
        <select className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer text-sm" disabled>
          <option>No models available</option>
        </select>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <select
        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer text-sm"
        value={selectedModel || ''}
        onChange={(e) => selectModel(e.target.value)}
      >
        {formattedModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ModelSelector;
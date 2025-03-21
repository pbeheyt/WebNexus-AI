// src/sidebar/components/ModelSelector.jsx
import React from 'react';
import { useSidebarPlatform } from '../contexts/SidebarPlatformContext';
import { SelectList } from '../../components/form/SelectList';

function ModelSelector() {
  const { models, selectedModel, selectModel, isLoading } = useSidebarPlatform();

  const handleModelChange = (modelId) => {
    selectModel(modelId);
  };

  return (
    <SelectList
      options={models}
      selectedValue={selectedModel}
      onChange={handleModelChange}
      loading={isLoading}
      placeholder="Select a model"
      emptyMessage="No models available"
      className="w-full"
    />
  );
}

export default ModelSelector;
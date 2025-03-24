// src/sidebar/components/ModelSelector.jsx
import React, { useEffect, useState } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import { SelectList } from '../../components/form/SelectList';

function ModelSelector() {
  const { 
    models, 
    selectedModel, 
    selectModel, 
    isLoading, 
    selectedPlatformId,
    hasCredentials 
  } = useSidebarPlatform();
  
  const [isDisabled, setIsDisabled] = useState(false);
  const [formattedModels, setFormattedModels] = useState([]);

  // Format models to work with SelectList component
  useEffect(() => {
    if (!models || models.length === 0) {
      setFormattedModels([]);
      return;
    }

    // Convert models to the format expected by SelectList
    const formatted = models.map(model => {
      // Handle both object and string formats
      if (typeof model === 'object' && model !== null) {
        return {
          value: model.id,
          label: model.id,
          data: model
        };
      } else {
        return {
          value: model,
          label: model
        };
      }
    });
    
    setFormattedModels(formatted);
  }, [models]);

  // Disable selector if no credentials or models available
  useEffect(() => {
    setIsDisabled(!hasCredentials || !models || models.length === 0);
  }, [models, hasCredentials]);

  const handleModelChange = async (modelId) => {
    if (modelId && !isDisabled) {
      await selectModel(modelId);
    }
  };

  // If no platform is selected or credentials are missing, don't render
  if (!selectedPlatformId || isDisabled) {
    return null;
  }

  return (
    <div className="w-full px-2 mb-2">
      <SelectList
        options={formattedModels}
        selectedValue={selectedModel}
        onChange={handleModelChange}
        loading={isLoading}
        disabled={isDisabled}
        placeholder="Select a model"
        emptyMessage={hasCredentials ? "No models available" : "API credentials required"}
        className="w-full"
      />
    </div>
  );
}

export default ModelSelector;
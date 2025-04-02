import React, { useEffect, useState } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';

// SVG Icons
const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);

function ModelSelector({ className = '' }) {
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
  const [isOpen, setIsOpen] = useState(false);

  // Format models to work with dropdown menu
  useEffect(() => {
    if (!models || models.length === 0) {
      setFormattedModels([]);
      return;
    }

    // Convert models to the format needed for dropdown
    const formatted = models.map(model => {
      // Handle both object and string formats
      if (typeof model === 'object' && model !== null) {
        return {
          id: model.id,
          name: model.name || model.id
        };
      } else {
        return {
          id: model,
          name: model
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
      setIsOpen(false);
    }
  };

  // If no platform is selected, don't render
  if (!selectedPlatformId) {
    return null;
  }

  const selectedModelName = selectedModel ? 
    formattedModels.find(m => m.id === selectedModel)?.name || selectedModel : 
    "Select a model";

  return (
    <div className={`relative w-full ${className}`}>
      <button
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
        className={`flex items-center w-full px-2 py-1.5 h-9 bg-transparent hover:bg-theme-hover border-0 rounded text-theme-primary text-sm ${
          isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
        }`}
      >
        {/* Chevron on the left */}
        <span className="mr-2 text-theme-secondary">
          <ChevronIcon />
        </span>
        
        {isLoading ? (
          <div className="flex items-center">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mr-2"></div>
            <span>Loading models...</span>
          </div>
        ) : (
          <span className="truncate">{selectedModelName}</span>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && !isDisabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-theme-surface border border-theme rounded-md shadow-lg z-40 max-h-60 overflow-auto">
          {formattedModels.length === 0 ? (
            <div className="px-3 py-2 text-sm text-theme-secondary">
              {hasCredentials ? "No models available" : "API credentials required"}
            </div>
          ) : (
            formattedModels.map((model) => (
              <button
                key={model.id}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-theme-hover ${
                  selectedModel === model.id ? 'font-medium bg-theme-hover' : ''
                }`}
                onClick={() => handleModelChange(model.id)}
              >
                {model.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ModelSelector;
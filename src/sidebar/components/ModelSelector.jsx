import React, { useEffect, useState, useContext, useRef } from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import { DropdownContext } from './Header';

// SVG Icons
const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);

function ModelSelector({ className = '', selectedPlatformId = null }) {
  const {
    models,
    selectedModel,
    selectModel,
  } = useSidebarPlatform();

  const [formattedModels, setFormattedModels] = useState([]);
  const { openDropdown, setOpenDropdown } = useContext(DropdownContext);
  const isOpen = openDropdown === 'model';
  const dropdownRef = useRef(null);
  const modelTriggerRef = useRef(null);

  // Format models for dropdown display
  useEffect(() => {
    if (!models || models.length === 0) {
      setFormattedModels([]);
      return;
    }

    // Convert models to consistent format
    const formatted = models.map(model => {
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

  // Effect to handle clicks outside the model dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        modelTriggerRef.current && !modelTriggerRef.current.contains(event.target)
      ) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setOpenDropdown]);

  const handleModelChange = async (modelId) => {
    if (modelId && selectedPlatformId) {
      await selectModel(modelId);
      setOpenDropdown(null);
    }
  };

  const selectedModelName = selectedModel ?
    formattedModels.find(m => m.id === selectedModel)?.name || selectedModel :
    "Select a model";

  return (
    <div className={`relative ${className}`}>
      <button
        ref={modelTriggerRef}
        onClick={() => setOpenDropdown(isOpen ? null : 'model')}
        className="flex items-center px-2 py-1.5 h-9 bg-transparent border-0 rounded text-theme-primary text-sm transition-colors cursor-pointer"
      >
        <span className="truncate">{selectedModelName}</span>
        
        <span className="ml-1 text-theme-secondary flex-shrink-0">
          <ChevronIcon />
        </span>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 mt-1 bg-theme-surface border border-theme rounded-md shadow-lg z-40 max-h-60 overflow-auto w-max max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {formattedModels.length === 0 ? (
            <div className="px-3 py-2 text-sm text-theme-secondary">
              No models available
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

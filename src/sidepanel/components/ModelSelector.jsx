import React, { useEffect, useState, useContext, useRef } from 'react';
import PropTypes from 'prop-types';

import { useSidePanelPlatform } from '../../contexts/platform';
import { ChevronDownIcon } from '../../components';

import { DropdownContext } from './PlatformModelControls';

function ModelSelector({ className = '', selectedPlatformId = null }) {
  const { models, selectedModel, selectModel, isLoading } =
    useSidePanelPlatform();

  const [formattedModels, setFormattedModels] = useState([]);
  const [displayModelId, setDisplayModelId] = useState(selectedModel);
  const [displayedModelName, setDisplayedModelName] = useState('Loading...');
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
    const formatted = models.map((model) => {
      if (typeof model === 'object' && model !== null) {
        return {
          id: model.id,
          name: model.displayName || model.name || model.id,
        };
      } else {
        return {
          id: model,
          name: model,
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
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        modelTriggerRef.current &&
        !modelTriggerRef.current.contains(event.target)
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

  // Update displayed model data when loading completes
  useEffect(() => {
    if (!isLoading) {
      setDisplayModelId(selectedModel);

      const currentModel = formattedModels.find((m) => m.id === selectedModel);
      const currentModelName =
        currentModel?.name || // This 'name' is effectively 'displayName' from the previous step
        selectedModel ||
        'Loading...';
      if (currentModelName) {
        setDisplayedModelName(currentModelName);
      }
    }
  }, [selectedModel, formattedModels, isLoading]);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setOpenDropdown(isOpen ? null : 'model');
  };

  return (
    <div className={`relative select-none ${className}`}>
      <button
        ref={modelTriggerRef}
        onClick={toggleDropdown}
        className='flex items-center px-2 bg-transparent border-0 rounded text-theme-primary text-sm transition-colors cursor-pointer w-full min-w-30'
        aria-haspopup='listbox'
        aria-expanded={isOpen}
      >
        <span className='truncate mr-1'>{displayedModelName}</span>
        <span className='text-theme-secondary flex-shrink-0'>
          <ChevronDownIcon className='w-4 h-4' />
        </span>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className='absolute bottom-full left-0 mb-1 bg-theme-surface border border-theme rounded-md shadow-lg z-40 max-h-60 w-auto overflow-y-auto'
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role='listbox' // ARIA role
          aria-labelledby={modelTriggerRef.current?.id || undefined} // Link to button if it has an ID
          tabIndex={0} // Make listbox focusable
        >
          {formattedModels.length === 0 ? (
            <div className='px-3 py-2 text-sm text-theme-secondary'>
              No models available
            </div>
          ) : (
            formattedModels.map((model) => (
              <button
                key={model.id}
                role='option' // ARIA role for item
                aria-selected={displayModelId === model.id}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-theme-hover whitespace-nowrap ${
                  displayModelId === model.id
                    ? 'font-medium bg-theme-hover'
                    : ''
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

ModelSelector.propTypes = {
  className: PropTypes.string,
  selectedPlatformId: PropTypes.string,
};

export default ModelSelector;

import React, { useEffect, useContext, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';

import { useSidePanelPlatform } from '../../contexts/platform';
import { ChevronDownIcon } from '../../components';

import { DropdownContext } from './PlatformModelControls';

function ModelSelector({ className = '', selectedPlatformId = null }) {
  const { models, selectedModel, selectModel, isLoading } =
    useSidePanelPlatform();

  const { openDropdown, setOpenDropdown } = useContext(DropdownContext);
  const isOpen = openDropdown === 'model';
  const dropdownRef = useRef(null);
  const modelTriggerRef = useRef(null);

  const formattedModels = useMemo(() => {
    if (!models || models.length === 0) {
      return [];
    }
    return models.map((model) => {
      if (typeof model === 'object' && model !== null) {
        return {
          id: model.id,
          name: model.displayName || model.name || model.id,
        };
      }
      return { id: model, name: model };
    });
  }, [models]);

  const displayedModelName = useMemo(() => {
    const currentModel = formattedModels.find((m) => m.id === selectedModel);
    return currentModel?.name || selectedModel || 'No model selected';
  }, [selectedModel, formattedModels]);

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

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setOpenDropdown(isOpen ? null : 'model');
  };

  return (
    <div className={`relative select-none ${className}`}>
      <button
        ref={modelTriggerRef}
        onClick={toggleDropdown}
        className='flex items-center px-2 bg-transparent border-0 rounded text-theme-primary font-medium text-sm transition-colors cursor-pointer w-full min-w-30 disabled:cursor-not-allowed disabled:opacity-75'
        aria-haspopup='listbox'
        aria-expanded={isOpen}
        disabled={isLoading || !selectedPlatformId || formattedModels.length === 0}
      >
        <span className='truncate mr-1'>{displayedModelName}</span>
        <ChevronDownIcon className='w-4 h-4 text-theme-secondary' />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className='absolute bottom-full left-0 mb-3 bg-theme-surface border border-theme rounded-md shadow-md z-40 max-h-60 w-auto overflow-y-auto'
          role='listbox'
          aria-labelledby={modelTriggerRef.current?.id || undefined}
          tabIndex={-1}
        >
          {formattedModels.length === 0 ? (
            <div className='px-3 py-2 text-sm text-theme-secondary'>
              No models available
            </div>
          ) : (
            formattedModels.map((model) => (
              <button
                key={model.id}
                role='option'
                aria-selected={selectedModel === model.id}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-theme-hover whitespace-nowrap ${
                  selectedModel === model.id
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
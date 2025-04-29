import React, { useState, useEffect, useRef } from 'react';

import { loadRelevantPrompts } from '../../shared/utils/prompt-utils.js';
import { logger } from '../../shared/logger';

/**
 * A dropdown component to display and select relevant custom prompts.
 * Simplified positioning to appear directly above the input component.
 */
export function PromptDropdown({
  isOpen,
  onClose,
  onSelectPrompt,
  contentType,
  anchorRef,
  className = '',
}) {
  const [prompts, setPrompts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const dropdownRef = useRef(null);

  // Fetch relevant prompts when the dropdown opens
  useEffect(() => {
    if (isOpen && contentType) {
      setIsLoading(true);
      setError(null);
      loadRelevantPrompts(contentType)
        .then((loadedPrompts) => {
          setPrompts(loadedPrompts);
          setIsLoading(false);
          setIsInitialLoad(false);
        })
        .catch((err) => {
          logger.popup.error('Error loading prompts in dropdown:', err);
          setError('Failed to load prompts.');
          setIsLoading(false);
          setIsInitialLoad(false);
        });
    } else {
      // Reset state when closed
      setPrompts([]);
      setIsLoading(false);
      setError(null);
    }
  }, [isOpen, contentType]);

  // Handle clicks outside the dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) {
    return null;
  }

  // Don't render anything during initial load to prevent flash
  if (isLoading && isInitialLoad) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className={`absolute bottom-full mb-2 right-0 z-50 overflow-y-auto bg-theme-surface border border-theme rounded-md shadow-lg p-1 min-w-48 ${className}`}
      role='listbox'
      aria-label='Select a prompt'
      style={{ maxHeight: '150px' }}
    >
      {error && <div className='px-3 py-1.5 text-sm text-red-500'>{error}</div>}
      {!isLoading && !error && prompts.length === 0 && (
        <div className={`px-3 py-1.5 ${className} text-theme-muted`}>
          No prompts available.
        </div>
      )}
      {!isLoading &&
        !error &&
        prompts.length > 0 &&
        prompts.map((prompt) => (
          <button
            key={prompt.id}
            onClick={() => onSelectPrompt(prompt)}
            className={`block w-full text-left px-3 py-1.5 ${className} text-theme-base hover:bg-theme-hover rounded cursor-pointer whitespace-nowrap select-none`}
            role='option'
            aria-selected='false'
          >
            {prompt.name}
          </button>
        ))}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

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
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const dropdownRef = useRef(null);

  // Handle visibility transition
  useEffect(() => {
    let timer;
    if (isOpen) {
      // Use a small delay to ensure initial styles are applied before transition
      timer = setTimeout(() => {
        setIsVisible(true);
      }, 10); // 10ms delay
    } else {
      // Set visibility to false immediately on close
      setIsVisible(false);
    }
    // Cleanup the timer if the component unmounts or isOpen changes
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Fetch relevant prompts when the dropdown opens
  useEffect(() => {
    if (isOpen && contentType) {
      setError(null);
      loadRelevantPrompts(contentType)
        .then((loadedPrompts) => {
          setPrompts(loadedPrompts);
        })
        .catch((err) => {
          logger.popup.error('Error loading prompts in dropdown:', err);
          setError('Failed to load prompts.');
        });
    } else {
      // Reset state when closed
      setPrompts([]);
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

  return (
    <div
      ref={dropdownRef}
      className={`absolute bottom-full mb-2 right-0 z-50 bg-theme-surface border border-theme rounded-md shadow-lg p-1 w-fit min-w-0 max-w-48 ${className} transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 max-h-[150px] overflow-y-auto' : 'opacity-0 max-h-0 overflow-hidden'}`}
      role='listbox'
      aria-label='Select a prompt'
    >
      {error && <div className='px-3 py-1.5 text-sm text-red-500'>{error}</div>}
      {!error && prompts.length === 0 && (
          <div className={`px-3 py-1.5 ${className} text-theme-muted`}>
            No prompts available.
          </div>
      )}
      {!error && prompts.length > 0 && prompts.map((prompt) => (
        <button
          key={prompt.id}
          onClick={() => onSelectPrompt(prompt)}
          className={`block w-full text-left px-3 py-1.5 ${className} text-theme-base hover:bg-theme-hover rounded cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis`}
          role='option'
          aria-selected='false'
        >
          {prompt.name}
        </button>
      ))}
    </div>
  );
}

PromptDropdown.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectPrompt: PropTypes.func.isRequired,
  contentType: PropTypes.string,
  anchorRef: PropTypes.object,
  className: PropTypes.string,
};

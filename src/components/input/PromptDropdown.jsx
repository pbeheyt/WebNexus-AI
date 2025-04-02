import React, { useState, useEffect, useRef } from 'react';
import { loadRelevantPrompts } from '../../utils/promptUtils';

/**
 * A dropdown component to display and select relevant custom prompts.
 * Positions itself above the provided anchor element.
 */
export function PromptDropdown({ isOpen, onClose, onSelectPrompt, contentType, anchorRef }) { // Changed to export function syntax
  const [prompts, setPrompts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [style, setStyle] = useState({});
  const dropdownRef = useRef(null);

  // Fetch relevant prompts when the dropdown opens
  useEffect(() => {
    if (isOpen && contentType) {
      setIsLoading(true);
      setError(null);
      loadRelevantPrompts(contentType)
        .then(loadedPrompts => {
          setPrompts(loadedPrompts);
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Error loading prompts in dropdown:", err);
          setError("Failed to load prompts.");
          setIsLoading(false);
        });
    } else {
      // Reset state when closed
      setPrompts([]);
      setIsLoading(false);
      setError(null);
    }
  }, [isOpen, contentType]);

  // Calculate dropdown position
  useEffect(() => {
    if (isOpen && anchorRef.current && dropdownRef.current) {
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const dropdownHeight = dropdownRef.current.offsetHeight;
      const spaceAbove = anchorRect.top;
      const spaceBelow = window.innerHeight - anchorRect.bottom;

      let calculatedTop;
      // Position above if enough space, otherwise below
      if (spaceAbove >= dropdownHeight + 4) {
         calculatedTop = anchorRect.top - dropdownHeight - 4; // 4px offset
      } else if (spaceBelow >= dropdownHeight + 4) {
         calculatedTop = anchorRect.bottom + 4; // Position below as fallback
      } else {
         // Default to above if neither fits perfectly (might overflow viewport)
         calculatedTop = anchorRect.top - dropdownHeight - 4; 
      }

      const calculatedLeft = anchorRect.left;

      setStyle({
        position: 'fixed',
        top: `${calculatedTop}px`,
        left: `${calculatedLeft}px`,
        // Ensure it doesn't exceed viewport height if positioned below
        maxHeight: spaceBelow < dropdownHeight + 4 ? `${spaceBelow - 10}px` : '12rem', // 12rem = max-h-48
        zIndex: 50, // Ensure it's above other elements
      });
    } else {
      setStyle({}); // Reset style when closed or refs not ready
    }
  }, [isOpen, anchorRef, prompts, isLoading]); // Re-calculate if prompts/loading change size

  // Handle clicks outside the dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        anchorRef.current && !anchorRef.current.contains(event.target)
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
      style={style}
      className="absolute bg-theme-surface border border-theme rounded-md shadow-lg max-h-48 overflow-y-auto w-60 p-1" // Tailwind classes for styling
      role="listbox"
      aria-label="Select a prompt"
    >
      {isLoading && <div className="px-3 py-1.5 text-sm text-theme-muted">Loading...</div>}
      {error && <div className="px-3 py-1.5 text-sm text-red-500">{error}</div>}
      {!isLoading && !error && prompts.length === 0 && (
        <div className="px-3 py-1.5 text-sm text-theme-muted">No prompts available.</div>
      )}
      {!isLoading && !error && prompts.length > 0 && (
        prompts.map(prompt => (
          <button
            key={prompt.id}
            onClick={() => onSelectPrompt(prompt)}
            className="block w-full text-left px-3 py-1.5 text-sm text-theme-base hover:bg-theme-hover rounded cursor-pointer focus:outline-none focus:bg-theme-hover"
            role="option"
            aria-selected="false" // Can be enhanced with selection state if needed
          >
            {prompt.name}
          </button>
        ))
      )}
    </div>
  );
}

// Removed default export

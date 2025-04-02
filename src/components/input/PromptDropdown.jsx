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
      // Get dimensions after content is potentially loaded
      const dropdownHeight = dropdownRef.current.offsetHeight;
      const dropdownWidth = dropdownRef.current.offsetWidth;

      // Calculate Top position
      let calculatedTop = anchorRect.top - dropdownHeight - 4; // 4px offset above anchor
      // Fallback: Position below if not enough space above or goes off-screen
      if (calculatedTop < 0) {
        calculatedTop = anchorRect.bottom + 4; // 4px offset below anchor
      }

      // Calculate Left position
      let calculatedLeft = anchorRect.right - dropdownWidth; // Align right edges
      // Fallback: Ensure it doesn't go off-screen left
      if (calculatedLeft < 0) {
        calculatedLeft = 0; // Align to the left edge of the viewport
      }

      setStyle({
        position: 'absolute', // Use absolute positioning relative to nearest positioned ancestor or body
        top: `${calculatedTop}px`,
        left: `${calculatedLeft}px`,
        // Max height and z-index are handled by Tailwind classes now
      });
    } else {
      setStyle({}); // Reset style when closed or refs not ready
    }
  }, [isOpen, anchorRef, prompts, isLoading]); // Re-calculate if visibility, anchor, or content changes

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
      // Updated Tailwind classes: absolute positioning, z-index, width, max-height, overflow, styling
      className="absolute z-50 w-64 max-h-56 overflow-y-auto bg-theme-surface border border-theme rounded-md shadow-lg p-1"
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
            // Ensured necessary classes are present, removed redundant focus style covered by hover
            className="block w-full text-left px-3 py-1.5 text-sm text-theme-base hover:bg-theme-hover rounded cursor-pointer"
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

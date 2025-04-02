import React, { useState, useEffect, useRef } from 'react';
import { loadRelevantPrompts } from '../../utils/promptUtils';

/**
 * A dropdown component to display and select relevant custom prompts.
 * Positions itself above and to the left of the provided anchor element.
 * Uses fixed positioning to prevent affecting parent layout.
 */
export function PromptDropdown({ isOpen, onClose, onSelectPrompt, contentType, anchorRef }) {
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

  // Calculate dropdown position and width
  useEffect(() => {
    if (isOpen && anchorRef.current && dropdownRef.current) {
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const dropdownHeight = dropdownRef.current.offsetHeight;
      const windowWidth = window.innerWidth;
      
      // Base width for the dropdown (wider than the button but reasonable)
      const dropdownWidth = Math.max(160, dropdownRef.current.offsetWidth);
      
      // Position above and to the left of the anchor
      let calculatedTop = anchorRect.top - dropdownHeight - 8; // 8px offset above anchor
      
      // If there's not enough space above, position below the anchor
      if (calculatedTop < 0) {
        calculatedTop = anchorRect.bottom + 8; // 8px offset below anchor
      }
      
      // Position to the left of the anchor by default (align with right edge of dropdown)
      let calculatedLeft = anchorRect.left - dropdownWidth + anchorRect.width;
      
      // If this would push it off-screen to the left, align with left edge of anchor
      if (calculatedLeft < 0) {
        calculatedLeft = anchorRect.left;
      }
      
      // If it would extend past the right edge of the screen, adjust leftward
      if (calculatedLeft + dropdownWidth > windowWidth) {
        calculatedLeft = windowWidth - dropdownWidth - 8; // 8px from window edge
      }

      setStyle({
        position: 'fixed', // Use fixed positioning to avoid affecting parent layout
        top: `${calculatedTop}px`,
        left: `${calculatedLeft}px`,
        width: `${dropdownWidth}px`, // Set explicit width to prevent sizing issues
        minWidth: '160px', // Ensure minimum reasonable width
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
      className="fixed z-50 max-h-56 overflow-y-auto bg-theme-surface border border-theme rounded-md shadow-lg p-1"
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
            className="block w-full text-left px-3 py-1.5 text-sm text-theme-base hover:bg-theme-hover rounded cursor-pointer whitespace-nowrap"
            role="option"
            aria-selected="false"
          >
            {prompt.name}
          </button>
        ))
      )}
    </div>
  );
}
// src/components/core/CustomSelect.jsx
import React, { useState, useEffect, useRef } from 'react';

// SVG Icons (defined inline for simplicity)
const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 transition-transform duration-200">
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-primary">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
  </svg>
);

/**
 * A reusable custom select component.
 *
 * @param {Object} props - Component props
 * @param {Array<{id: string|number, name: string}>} [props.options=[]] - Options to display.
 * @param {string|number|null} props.selectedValue - Currently selected value's ID.
 * @param {Function} props.onChange - Callback function when selection changes, receives the selected ID.
 * @param {string} [props.placeholder="Select an option"] - Text shown when no value is selected.
 * @param {boolean} [props.disabled=false] - Whether the select is disabled.
 * @param {string} [props.className=''] - Additional CSS classes for the main container.
 */
export function CustomSelect({
  options = [], // Default to empty array
  selectedValue,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  // Find the selected option object to display its name
  const selectedOption = options.find(option => option && option.id === selectedValue);

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      // Check if the click is outside the dropdown panel and the trigger button
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        triggerRef.current && !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    // Cleanup the event listener on component unmount or when dropdown closes
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]); // Rerun effect only when isOpen changes

  // Handler for selecting an option
  const handleOptionClick = (optionId) => {
    if (onChange) {
      onChange(optionId); // Call the parent's onChange handler
    }
    setIsOpen(false); // Close the dropdown
  };

  // Handler for clicking the trigger button
  const handleTriggerClick = () => {
    if (!disabled) {
      setIsOpen(prev => !prev); // Toggle the dropdown state
    }
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button" // Explicitly set type to button to prevent form submission
        onClick={handleTriggerClick}
        disabled={disabled}
        className={`w-full flex items-center justify-between text-left px-3 py-1.5 h-9 bg-theme-surface text-theme-primary border border-theme rounded-md text-sm transition-colors focus-primary ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-theme-hover'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {/* Display selected option name or placeholder */}
        <span className="truncate">
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        {/* Chevron icon indicating dropdown state */}
        <ChevronIcon />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1 w-full bg-theme-surface border border-theme rounded-md shadow-lg z-40 max-h-60 overflow-y-auto py-1"
          role="listbox" // Accessibility attribute
        >
          {/* Handle case where no options are provided */}
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-theme-secondary">No options available</div>
          ) : (
            // Render each option as a button
            options.map((option) => (
              <button
                key={option.id}
                type="button" // *** CRITICAL FIX: Prevents form submission ***
                role="option" // Accessibility attribute
                aria-selected={selectedValue === option.id} // Accessibility attribute
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-theme-hover ${
                  selectedValue === option.id ? 'font-medium bg-theme-hover' : '' // Style selected option
                }`}
                onClick={() => handleOptionClick(option.id)}
                disabled={disabled} // Optionally disable individual options if needed
              >
                <span className="truncate">{option.name}</span>
                {/* Show checkmark for the selected option */}
                {selectedValue === option.id && <CheckIcon />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default CustomSelect;
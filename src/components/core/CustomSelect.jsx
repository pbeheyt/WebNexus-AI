// src/components/core/CustomSelect.jsx
import React, { useState, useEffect, useRef } from 'react';

// SVG Icons
const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 transition-transform duration-200 shrink-0 ml-2"> {/* Added shrink-0 and ml-2 */}
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);

/**
 * A reusable custom select component that adjusts width to fit the selected content.
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
  options = [],
  selectedValue,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  const selectedOption = options.find(option => option && option.id === selectedValue);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        triggerRef.current && !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleOptionClick = (optionId) => {
    if (onChange) {
      onChange(optionId);
    }
    setIsOpen(false);
  };

  const handleTriggerClick = () => {
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  };

  return (
    // Use inline-block to allow the container to size based on its content (the button)
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        disabled={disabled}
        className={`flex items-center justify-between text-left px-3 py-1.5 h-9 bg-theme-surface text-theme-primary border border-theme rounded-md text-sm transition-colors focus-primary ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-theme-hover'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {/* Display selected option name or placeholder */}
        <span className="whitespace-nowrap">
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        {/* Chevron icon */}
        <ChevronIcon />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 bg-theme-surface border border-theme rounded-md shadow-lg z-40 max-h-60 overflow-y-auto py-1 min-w-full"
          role="listbox"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-theme-secondary whitespace-nowrap">No options available</div>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selectedValue === option.id}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-theme-hover ${
                  selectedValue === option.id ? 'font-medium bg-theme-hover' : ''
                }`}
                onClick={() => handleOptionClick(option.id)}
                disabled={disabled} // Keep disabled state consistent
              >
                <span className="whitespace-nowrap">{option.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default CustomSelect;
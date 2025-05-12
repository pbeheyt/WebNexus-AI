// src/components/core/CustomSelect.jsx
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

import { ChevronDownIcon } from '../icons/ChevronDownIcon';


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
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  buttonClassName = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  const selectedOption = options.find(
    (option) => option && option.id === selectedValue
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
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
      setIsOpen((prev) => !prev);
    }
  };

  return (
    // Use inline-block to allow the container to size based on its content (the button)
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type='button'
        onClick={handleTriggerClick}
        disabled={disabled}
        className={`flex items-center justify-between text-left px-3 py-1.5 h-9 bg-theme-hover text-theme-primary border border-theme rounded-md text-sm transition-colors focus-primary ${buttonClassName} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-theme-hover'
        }`}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
      >
        {/* Display selected option name or placeholder */}
        <span className='whitespace-nowrap'>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        {/* Chevron icon */}
        <ChevronDownIcon className='w-5 h-5 transition-transform duration-200 shrink-0 ml-2' />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className='absolute top-full left-0 mt-1 bg-theme-surface border border-theme rounded-md shadow-lg z-40 max-h-60 overflow-y-auto py-1 min-w-full'
          role='listbox'
        >
          {options.length === 0 ? (
            <div className='px-3 py-2 text-sm text-theme-secondary whitespace-nowrap'>
              No options available
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type='button'
                role='option'
                aria-selected={selectedValue === option.id}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-theme-hover ${
                  selectedValue === option.id
                    ? 'font-medium bg-theme-hover'
                    : ''
                }`}
                onClick={() => handleOptionClick(option.id)}
                disabled={disabled} // Keep disabled state consistent
              >
                <span className='whitespace-nowrap'>{option.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

CustomSelect.propTypes = {
  options: PropTypes.array,
  selectedValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  buttonClassName: PropTypes.string,
};

export default CustomSelect;

// src/components/form/RadioGroup.jsx
import React from 'react';

/**
 * A group of radio options with consistent styling.
 * 
 * @param {Object} props - Component props
 * @param {Array<{value: string, label: string}>} props.options - Radio options
 * @param {string} props.value - Selected value
 * @param {Function} props.onChange - Change handler
 * @param {string} props.name - Input name for form submission
 * @param {string} [props.className=''] - Additional CSS classes
 */
export function RadioGroup({
  options,
  value,
  onChange,
  name,
  className = '',
}) {
  return (
    <div className={`flex bg-theme-surface rounded-md overflow-hidden border border-theme ${className}`}>
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex-1 text-center py-1 px-2 cursor-pointer transition-colors text-sm ${
            value === option.value 
              ? 'bg-primary text-white' 
              : 'hover:bg-theme-hover'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export default RadioGroup;
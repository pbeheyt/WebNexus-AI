// src/components/form/SelectList.jsx
import React from 'react';

/**
 * A reusable select list component that handles various data formats and states
 * 
 * @param {Object} props - Component props
 * @param {Array|Object} props.options - Options to display (array or object)
 * @param {string|null} props.selectedValue - Currently selected value
 * @param {Function} props.onChange - Selection change handler
 * @param {string} props.placeholder - Placeholder for empty selection
 * @param {boolean} props.loading - Whether options are loading
 * @param {boolean} props.disabled - Whether input is disabled
 * @param {string} props.emptyMessage - Message to display when no options are available
 * @param {string} props.className - Additional CSS classes
 */
export function SelectList({
  options,
  selectedValue,
  onChange,
  placeholder = 'Select an option',
  loading = false,
  disabled = false,
  emptyMessage = 'No options available',
  className = ''
}) {
  // Format options to a consistent array format regardless of input type
  const formatOptions = () => {
    if (!options || (Array.isArray(options) && options.length === 0) || 
        (!Array.isArray(options) && Object.keys(options).length === 0)) {
      return [];
    }

    if (Array.isArray(options)) {
      return options.map(option => {
        if (typeof option === 'object' && option !== null) {
          return { 
            id: option.id || option.value || '', 
            name: option.name || option.label || option.id || option.value || '' 
          };
        }
        return { id: option, name: option };
      });
    }

    return Object.entries(options).map(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        return { 
          id: value.id || value.value || key, 
          name: value.name || value.label || value.id || value.value || key 
        };
      }
      return { id: key, name: value };
    });
  };

  const formattedOptions = formatOptions();
  
  // Handle loading state
  if (loading) {
    return (
      <div className={`relative w-full ${className}`}>
        <select className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-not-allowed text-sm" disabled>
          <option>{placeholder}</option>
        </select>
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Handle empty options
  if (formattedOptions.length === 0) {
    return (
      <div className={`relative w-full ${className}`}>
        <select className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-not-allowed text-sm" disabled>
          <option>{emptyMessage}</option>
        </select>
      </div>
    );
  }

  // Normal state with options
  return (
    <div className={`relative w-full ${className}`}>
      <select
        className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer text-sm focus:border-primary"
        value={selectedValue || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {!selectedValue && <option value="">{placeholder}</option>}
        
        {formattedOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default SelectList;
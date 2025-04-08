import React from 'react';
import PropTypes from 'prop-types';

/**
 * A reusable component combining a range slider and a number input.
 */
export function SliderInput ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  className = '',
  disabled = false,
}) {
  const handleInputChange = (event) => {
    const newValue = event.target.value;
    // Allow empty input temporarily, but pass 0 or min if empty/invalid
    const numericValue = parseFloat(newValue);
    if (!isNaN(numericValue)) {
      onChange(Math.max(min, Math.min(max, numericValue)));
    } else if (newValue === '') {
      // If user clears the input, decide what value to pass.
      // Option 1: Pass min (safer)
      // onChange(min);
      // Option 2: Pass 0 if within range, else min
      onChange(0 >= min && 0 <= max ? 0 : min);
      // Option 3: Pass undefined/null (requires handler logic adjustment)
      // onChange(undefined);
    }
    // If parsing fails completely (e.g., "abc"), do nothing or reset to current value/min
  };

  const handleRangeChange = (event) => {
    const numericValue = parseFloat(event.target.value);
    // Range input always provides a valid number within its bounds
    if (!isNaN(numericValue)) {
      onChange(numericValue);
    }
  };

  // Ensure value is within bounds for display, especially on initial render
  const displayValue = Math.max(min, Math.min(max, value ?? min));

  return (
    <div className={`${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className="flex items-center space-x-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={displayValue}
          onChange={handleRangeChange}
          disabled={disabled}
          className="custom-slider flex-grow h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={displayValue} // Use displayValue to ensure consistency
          onChange={handleInputChange}
          disabled={disabled}
          className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-primary sm:text-sm dark:bg-gray-800 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-70"
          // Prevent scrolling from changing the value
          onWheel={(e) => e.target.blur()}
        />
      </div>
    </div>
  );
};

SliderInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number, // Allow undefined/null initially
  onChange: PropTypes.func.isRequired,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export default SliderInput;

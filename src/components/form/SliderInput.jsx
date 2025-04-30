import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * A reusable component combining a range slider and a number input
 * with improved UX. The slider track dynamically fills with color
 * based on the current value.
 */
export function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  className = '',
  disabled = false,
}) {
  const sliderRef = useRef(null);

  useEffect(() => {
    if (sliderRef.current) {
      const range = max - min;
      // Handle division by zero and ensure value is within bounds
      const safeValue = Math.max(min, Math.min(value ?? min, max));
      const percentage = range === 0 ? 0 : ((safeValue - min) / range) * 100;
      // Set the CSS variable on the slider element
      sliderRef.current.style.setProperty('--slider-fill-percentage', `${percentage}%`);
    }
  }, [value, min, max]);
  const handleInputChange = (event) => {
    const newValue = event.target.value;
    // Allow empty input temporarily, but pass 0 or min if empty/invalid
    const numericValue = parseFloat(newValue);
    if (!isNaN(numericValue)) {
      onChange(Math.max(min, Math.min(max, numericValue)));
    } else if (newValue === '') {
      // Pass 0 if within range, else min
      onChange(0 >= min && 0 <= max ? 0 : min);
    }
  };

  const handleRangeChange = (event) => {
    const numericValue = parseFloat(event.target.value);
    if (!isNaN(numericValue)) {
      onChange(numericValue);
    }
  };

  // Ensure value is within bounds for display
  const displayValue = Math.max(min, Math.min(max, value ?? min));

  return (
    <div className={`${className}`}>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 select-none'>
        {label}
      </label>
      <div className='flex items-center space-x-3 mt-1'>
        <input
          ref={sliderRef}
          type='range'
          min={min}
          max={max}
          step={step}
          value={displayValue}
          onChange={handleRangeChange}
          disabled={disabled}
          className='custom-slider flex-grow h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none'
        />
        <input
          type='number'
          min={min}
          max={max}
          step={step}
          value={displayValue}
          onChange={handleInputChange}
          disabled={disabled}
          className='w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-70'
          onWheel={(e) => e.target.blur()}
        />
      </div>
    </div>
  );
}

SliderInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export default SliderInput;

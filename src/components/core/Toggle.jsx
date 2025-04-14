// src/components/core/Toggle.jsx
import React from 'react';

/**
 * Toggle switch component for boolean inputs.
 * 
 * @param {Object} props - Component props
 * @param {boolean} [props.checked=false] - Whether toggle is checked
 * @param {Function} props.onChange - Change handler
 * @param {boolean} [props.disabled=false] - Whether toggle is disabled
 * @param {string} [props.className=''] - Additional CSS classes
 */
export function Toggle({
  checked = false,
  onChange,
  disabled = false,
  className = 'w-10 h-5',
  ...props
}) {
  return (
    <label className={`relative inline-block ${className}`}>
      <input
        type="checkbox"
        className="opacity-0 w-0 h-0"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
      <span className={`absolute cursor-pointer inset-0 rounded-full transition-all ${
          checked ? 'bg-primary' : 'bg-theme-hover'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <span className={`absolute h-4 w-4 bg-white rounded-full transition-transform duration-200 ease-in-out transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          } top-0.5 left-0`}
        />
      </span>
    </label>
  );
}

export default Toggle;
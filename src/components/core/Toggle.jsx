import React from 'react';

/**
 * Toggle switch component with a properly positioned circle.
 * Now uses a semantic button element for the clickable wrapper.
 *
 * @param {Object} props - Component props
 * @param {boolean} [props.checked=false] - Whether toggle is checked
 * @param {Function} props.onChange - Change handler
 * @param {boolean} [props.disabled=false] - Whether toggle is disabled
 * @param {string} [props.className=''] - Additional CSS classes for the button wrapper
 */
export function Toggle({
  checked = false,
  onChange,
  disabled = false,
  className = 'w-10 h-5',
  ...props
}) {
  return (
    <button
      type='button' // Changed from div to button
      className={`relative inline-block border-none bg-transparent p-0 ${className}`} // Added reset styles
      onClick={
        disabled
          ? undefined
          : () => {
              onChange(!checked);
            }
      }
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      disabled={disabled} // Add disabled prop to the button itself
      {...props}
    >
      {/* Input remains visually hidden but semantically linked */}
      <input
        type='checkbox'
        className='sr-only'
        checked={checked}
        onChange={() => {}} // onChange on input is redundant now due to button click
        disabled={disabled}
        tabIndex={-1} // Prevent redundant focus on the hidden input
        aria-hidden='true' // Hide from accessibility tree as button handles interaction
      />
      {/* Visual slider background */}
      <span
        className={`absolute inset-0 rounded-full transition-all select-none ${
          checked ? 'bg-primary' : 'bg-theme-hover'
        } ${disabled ? 'opacity-50' : ''}`}
        aria-hidden='true' // Decorative
      />
      {/* Visual slider knob */}
      <span
        className='absolute bg-white rounded-full transition-transform duration-200 ease-in-out'
        style={{
          height: '70%',
          aspectRatio: '1/1',
          width: 'auto',
          top: '15%',
          left: '10%',
          transform: checked ? 'translateX(130%)' : 'translateX(0)',
        }}
        aria-hidden='true' // Decorative
      />
    </button>
  );
}

export default Toggle;
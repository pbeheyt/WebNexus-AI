import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Toggle switch component with a properly positioned circle.
 * Now uses a semantic button element for the clickable wrapper and supports ref forwarding.
 *
 * @param {Object} props - Component props
 * @param {boolean} [props.checked=false] - Whether toggle is checked
 * @param {Function} props.onChange - Change handler
 * @param {boolean} [props.disabled=false] - Whether toggle is disabled
 * @param {string} [props.className=''] - Additional CSS classes for the button wrapper
 */
export const Toggle = forwardRef(
  (
    {
      checked = false,
      onChange,
      disabled = false,
      className = 'w-10 h-5',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type='button'
        className={`relative inline-block border-none bg-transparent select-none p-0 ${className}`}
        onClick={
          disabled
            ? undefined
            : () => {
                onChange(!checked);
              }
        }
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        disabled={disabled}
        {...props}
      >
        {/* Input remains visually hidden but semantically linked, now with `peer` class */}
        <input
          type='checkbox'
          className='sr-only peer'
          checked={checked}
          onChange={() => {}}
          disabled={disabled}
          tabIndex={-1} // Prevent redundant focus on the hidden input
          aria-hidden='true' // Hide from accessibility tree as button handles interaction
        />
        {/* Visual slider background, now styled with peer-checked */}
        <span
          className={`absolute inset-0 rounded-full transition-all select-none bg-theme-hover peer-checked:bg-primary ${
            disabled ? 'opacity-50' : ''
          }`}
          aria-hidden='true' // Decorative
        />
        {/* Visual slider knob, now styled with peer-checked and Tailwind classes */}
        <span
          className={`absolute h-[70%] aspect-square w-auto top-[15%] left-[10%] bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-[130%]`}
          aria-hidden='true' // Decorative
        />
      </button>
    );
  }
);

Toggle.displayName = 'Toggle';

Toggle.propTypes = {
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default Toggle;

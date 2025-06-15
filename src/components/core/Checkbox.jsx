// src/components/core/Checkbox.jsx
import React from 'react';
import PropTypes from 'prop-types';

import { CheckIcon } from '../icons/CheckIcon';

const Checkbox = ({
  id,
  checked,
  onChange,
  label,
  className = '',
  labelClassName = '',
  disabled = false,
}) => {
  const generatedId = React.useId();
  const uniqueId = id || `checkbox-${generatedId}`;

  return (
    <div className={`flex items-center ${className}`}>
      <input
        type='checkbox'
        id={uniqueId}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className='opacity-0 w-0 h-0' // Visually hide the input without disrupting layout
      />
      <label
        htmlFor={uniqueId}
        className={`flex items-center cursor-pointer ${
          disabled ? 'cursor-not-allowed' : ''
        }`}
      >
        {/* Visual checkbox part */}
        <div
          className={`relative flex flex-shrink-0 items-center justify-center w-5 h-5 rounded border-2 transition-colors
            ${
              checked
                ? 'bg-primary border-primary'
                : 'bg-transparent border-gray-400 dark:border-gray-500'
            }
            ${
              disabled
                ? 'opacity-50'
                : 'hover:border-primary'
            }
            ${labelClassName}`}
        >
          {checked && <CheckIcon className='w-4 h-4 text-white' />}
        </div>
        {/* Text part */}
        {label && <span className='ml-2 text-sm'>{label}</span>}
      </label>
    </div>
  );
};

Checkbox.propTypes = {
  id: PropTypes.string,
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  className: PropTypes.string,
  labelClassName: PropTypes.string,
  disabled: PropTypes.bool,
};

export default Checkbox;

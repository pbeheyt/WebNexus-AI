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
    <div className={`inline-flex items-center ${className}`}>
      <input
        type='checkbox'
        id={uniqueId}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className='sr-only' // Hide the default checkbox
      />
      <label
        htmlFor={uniqueId}
        className={`relative flex items-center justify-center w-5 h-5 rounded border-2 transition-colors cursor-pointer
          ${
            checked
              ? 'bg-primary border-primary'
              : 'bg-transparent border-gray-400 dark:border-gray-500'
          }
          ${
            disabled
              ? 'cursor-not-allowed opacity-50'
              : 'hover:border-primary'
          }
          ${labelClassName}`}
      >
        {checked && <CheckIcon className='w-4 h-4 text-white' />}
      </label>
      {label && (
        <label htmlFor={uniqueId} className='ml-2 text-sm cursor-pointer'>
          {label}
        </label>
      )}
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

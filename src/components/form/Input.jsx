import React, { forwardRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

export const Input = forwardRef(
  (
    {
      type = 'text',
      value,
      onChange,
      placeholder,
      maxLength,
      disabled = false,
      className = '',
      id,
      name,
      style = {},
      required = false,
      onValidation = () => {},
      endContent = null,
      ...restProps
    },
    ref
  ) => {
    // Pure validation function: returns error message or null, doesn't set state.
    const validate = useCallback(
      (currentValue) => {
        let errorMessage = null;
        if (required && !currentValue.trim()) {
          errorMessage = 'This field is required.';
        } else if (maxLength && currentValue.length > maxLength) {
          errorMessage = `Cannot exceed ${maxLength} characters.`;
        }
        return errorMessage;
      },
      [required, maxLength]
    );

    // Report validity to parent on every value change, without showing visual error.
    // This allows parent form to enable/disable save buttons correctly.
    useEffect(() => {
      const errorMessage = validate(value || '');
      onValidation(!errorMessage);
    }, [value, validate, onValidation]);

    const handleChange = (e) => {
      if (onChange) {
        onChange(e);
      }
    };

    const baseClasses = 'w-full p-3 outline-none text-theme-primary';
    const paddingClasses = endContent ? 'pr-12' : '';
    const combinedClasses =
      `${baseClasses} ${paddingClasses} ${className}`.trim();

    return (
      <div>
        <div className='relative w-full'>
          <input
            ref={ref}
            type={type}
            id={id}
            name={name}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={disabled}
            className={combinedClasses}
            style={style}
            {...restProps}
          />
          {endContent && (
            <div className='absolute inset-y-0 right-0 flex items-center pr-2'>
              {endContent}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Input.displayName = 'Input';

Input.propTypes = {
  type: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  maxLength: PropTypes.number,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  style: PropTypes.object,
  required: PropTypes.bool,
  onValidation: PropTypes.func,
  endContent: PropTypes.node,
};

export default Input;

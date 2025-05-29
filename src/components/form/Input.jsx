// src/components/form/Input.jsx
import React, { forwardRef } from 'react';
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
      ...restProps
    },
    ref
  ) => {
    const baseClasses =
      'w-full p-3 border-none outline-none text-theme-primary';
    const combinedClasses = `${baseClasses} ${className}`.trim();

    return (
      <input
        ref={ref}
        type={type}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        className={combinedClasses}
        style={style}
        {...restProps}
      />
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
  id: PropTypes.string,
  name: PropTypes.string,
  style: PropTypes.object,
};

export default Input;

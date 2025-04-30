// src/components/core/IconButton.jsx
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';

export const IconButton = forwardRef(
  (
    {
      icon: IconComponent,
      iconClassName = '',
      className = '',
      onClick,
      disabled,
      ariaLabel,
      title,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type='button'
        className={`flex items-center justify-center cursor-pointer border-none outline-none transition-colors duration-150 ${className} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        title={title}
        {...props}
      >
        <IconComponent className={iconClassName} aria-hidden='true' />
      </button>
    );

  }
);

IconButton.displayName = 'IconButton';

IconButton.propTypes = {
  icon: PropTypes.elementType.isRequired,
  iconClassName: PropTypes.string,
  className: PropTypes.string,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  ariaLabel: PropTypes.string,
  title: PropTypes.string,
};

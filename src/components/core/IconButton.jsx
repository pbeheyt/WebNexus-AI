// src/components/core/IconButton.jsx
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';

import { SpinnerIcon } from '../icons/SpinnerIcon';

export const IconButton = forwardRef(
  (
    {
      icon: IconComponent,
      iconClassName = '',
      className = '',
      onClick,
      disabled,
      isLoading = false,
      ariaLabel,
      title,
      ...props
    },
    ref
  ) => {
    const effectiveDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type='button'
        className={`flex items-center justify-center cursor-pointer border-none outline-none transition-colors duration-150 ${className} ${isLoading ? 'opacity-80' : ''}`}
        onClick={effectiveDisabled ? undefined : onClick}
        disabled={effectiveDisabled}
        aria-label={isLoading ? 'Loading' : ariaLabel}
        title={isLoading ? 'Loading...' : title}
        {...props}
      >
        {isLoading ? (
          <SpinnerIcon className={iconClassName} aria-hidden='true' />
        ) : (
          <IconComponent className={iconClassName} aria-hidden='true' />
        )}
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
  isLoading: PropTypes.bool,
  ariaLabel: PropTypes.string,
  title: PropTypes.string,
};

// src/components/core/IconButton.jsx
import React, { forwardRef } from 'react';

export const IconButton = forwardRef(({
  icon: IconComponent,
  iconClassName = '',
  className = '',
  onClick,
  disabled,
  ariaLabel,
  title,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      className={`flex items-center justify-center cursor-pointer border-none outline-none transition-colors duration-150 ${className} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      {...props}
    >
      <IconComponent className={iconClassName} aria-hidden="true" />
    </button>
  );
});

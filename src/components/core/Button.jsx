// src/components/core/Button.jsx
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';

import { SpinnerIcon } from '../icons/SpinnerIcon';

/**
 * Button component with support for multiple variants, sizes, and a loading state.
 * Now supports ref forwarding.
 *
 * @param {Object} props - Component props
 * @param {string} [props.variant='primary'] - Button style variant
 * @param {string} [props.size='md'] - Button size
 * @param {boolean} [props.disabled=false] - Whether button is disabled
 * @param {boolean} [props.isLoading=false] - Whether button is in loading state
 * @param {string} [props.loadingText=''] - Text to display next to spinner when loading
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {Function} props.onClick - Click handler
 * @param {React.ReactNode} props.children - Button content
 */
export const Button = forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      disabled = false,
      isLoading = false,
      loadingText = '',
      className = '',
      onClick = () => {},
      ...props
    },
    ref
  ) => {
    // Base classes
    const baseClasses =
      'inline-flex items-center justify-center rounded-lg font-medium transition-colors transition-opacity duration-200';

    // Size classes
    const sizeClasses = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base',
    };

    // Spinner size classes based on button size
    const spinnerSizeClasses = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    };

    // Variant classes
    const variantClasses = {
      primary:
        'bg-primary text-white disabled:bg-gray-400 disabled:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50',
      secondary:
        'bg-transparent text-theme-primary border border-theme hover:border-primary disabled:bg-gray-400 disabled:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50',
      danger:
        'bg-error text-white hover:bg-red-600 disabled:bg-gray-400 disabled:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50',
      success:
        'bg-success text-white hover:bg-green-600 disabled:bg-gray-400 disabled:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50',
      inactive: 'bg-gray-400 text-gray-100 cursor-not-allowed opacity-50',
    };

    // Loading specific style to ensure content is centered with spinner
    const loadingSpecificClass = isLoading ? 'opacity-80' : '';

    // Combined classes
    const combinedClasses = [
      baseClasses,
      sizeClasses[size] || sizeClasses.md,
      variantClasses[variant] || variantClasses.primary,
      loadingSpecificClass,
      className,
    ]
      .join(' ')
      .trim();

    return (
      <button
        ref={ref}
        className={combinedClasses}
        disabled={disabled || isLoading}
        onClick={onClick}
        {...props}
      >
        {isLoading ? (
          <>
            <SpinnerIcon
              className={`${spinnerSizeClasses[size] || spinnerSizeClasses.md} mr-2`}
            />
            {loadingText ? (
              <span>{loadingText}</span>
            ) : typeof children === 'string' ? (
              <span>{children}</span>
            ) : (
              children
            )}
          </>
        ) : typeof children === 'string' ? (
          <span>{children}</span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf([
    'primary',
    'secondary',
    'danger',
    'success',
    'inactive',
  ]),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
  loadingText: PropTypes.string,
  className: PropTypes.string,
  onClick: PropTypes.func,
};

export default Button;

// src/components/form/ValidationError.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * A consistent component for displaying validation error messages.
 * @param {object} props - Component props.
 * @param {string|null} props.message - The error message to display. If null or empty, the component renders nothing.
 * @param {string} [props.className=''] - Additional CSS classes.
 */
export function ValidationError({ message, className = '' }) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={`flex items-center text-error text-xs mt-2 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <span>{message}</span>
    </div>
  );
}

ValidationError.propTypes = {
  message: PropTypes.string,
  className: PropTypes.string,
};

export default ValidationError;

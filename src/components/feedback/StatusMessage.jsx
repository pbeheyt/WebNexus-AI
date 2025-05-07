// src/components/feedback/StatusMessage.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Component for displaying inline status messages with accessibility enhancements.
 *
 * @param {Object} props - Component props
 * @param {string} props.message - The message to display
 * @param {string} [props.type='info'] - Message type (info, success, warning, error)
 * @param {string} [props.className=''] - Additional CSS classes
 */
export function StatusMessage({
  message,
  type = 'info',
  className = '',
}) {
  const typeClasses = {
    info: 'text-theme-secondary',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  };

  let ariaLiveValue = 'polite';
  let roleValue = 'status';

  if (type === 'error' || type === 'warning') {
    ariaLiveValue = 'assertive';
    roleValue = 'alert';
  }

  return (
    <div
      className={`text-xs px-3 ${typeClasses[type]} ${className}`}
      role={roleValue}
      aria-live={ariaLiveValue}
      aria-atomic="true" // Ensures the entire message is announced when it changes
    >
      {message || '\u00A0'}{' '}
      {/* Use non-breaking space to maintain height when empty */}
    </div>
  );
}

StatusMessage.propTypes = {
  message: PropTypes.string,
  type: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  className: PropTypes.string,
};

export default StatusMessage;
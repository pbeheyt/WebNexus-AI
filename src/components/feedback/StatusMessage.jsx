// src/components/feedback/StatusMessage.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Component for displaying inline status messages.
 *
 * @param {Object} props - Component props
 * @param {string} props.message - The message to display
 * @param {string} [props.type='info'] - Message type (info, success, warning, error)
 * @param {string} [props.context='default'] - Rendering context ('popup', 'sidebar', 'default')
 * @param {string} [props.className=''] - Additional CSS classes
 */
export function StatusMessage({
  message,
  type = 'info',
  _context = 'default',
  className = '',
}) {
  const typeClasses = {
    info: 'text-theme-secondary',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  };

  return (
    <div
      className={`text-xs px-3 rounded bg-opacity-5 min-h-[1rem] transition-all select-none ${typeClasses[type]} ${className}`}
    >
      {message || '\u00A0'}{' '}
      {/* Use non-breaking space to maintain height when empty */}
    </div>
  );
}

StatusMessage.propTypes = {
  message: PropTypes.string,
  type: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  _context: PropTypes.string,
  className: PropTypes.string,
};

export default StatusMessage;

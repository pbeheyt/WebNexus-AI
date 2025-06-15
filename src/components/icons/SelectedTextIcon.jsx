// src/components/icons/SelectedTextIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Icon representing selected text.
 */
export function SelectedTextIcon({ className = 'w-5 h-5', ...props }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 20 20'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      {...props}
    >
      <path d='M6 4v12l3-3 2.5 5 3-1.5-2.5-4.5h4L6 4z' fill='none' />
    </svg>
  );
}

SelectedTextIcon.propTypes = {
  className: PropTypes.string,
};

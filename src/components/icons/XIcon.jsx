// src/components/icons/XIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function XIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      {...props}
    >
      <path d='M18 6L6 18' />
      <path d='M6 6L18 18' />
    </svg>
  );
}

XIcon.propTypes = {
  className: PropTypes.string,
};

export default XIcon;

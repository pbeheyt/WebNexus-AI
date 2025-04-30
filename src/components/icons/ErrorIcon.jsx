// src/components/icons/ErrorIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function ErrorIcon({ className = 'h-10 w-10', ...props }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      className={className}
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
      strokeWidth={2}
      {...props}
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
      />
    </svg>
  );
}

ErrorIcon.propTypes = {
  className: PropTypes.string,
};

export default ErrorIcon;

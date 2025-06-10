// src/components/icons/MouseIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function MouseIcon({ className = 'w-5 h-5', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M10.33 4.15l9.06 7.39a2.3 2.3 0 01.3 3.23l-4.14 5.2a2.3 2.3 0 01-3.48.21L3.92 12.8a2.3 2.3 0 01-.1-3.32l4.4-4.48a2.3 2.3 0 013.11.15z" />
      <path d="M10.33 4.15L14 7.8" />
    </svg>
  );
}

MouseIcon.propTypes = {
  className: PropTypes.string,
};

export default MouseIcon;

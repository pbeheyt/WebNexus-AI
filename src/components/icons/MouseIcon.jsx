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
      <path 
        d="M6 4v12l3-3 2.5 5 3-1.5-2.5-4.5h4L6 4z" 
        fill="none" 
        stroke="currentColor"
      />
    </svg>
  );
}

MouseIcon.propTypes = {
  className: PropTypes.string,
};

export default MouseIcon;
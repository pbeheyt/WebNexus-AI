// src/components/icons/ArrowRightIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function ArrowRightIcon({ className = 'w-5 h-5', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}

ArrowRightIcon.propTypes = {
  className: PropTypes.string,
};

export default ArrowRightIcon;

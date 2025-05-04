import React from 'react';
import PropTypes from 'prop-types';

export function ChevronDownIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      {...props}
    >
      <path
        d='M19 9l-7 7-7-7'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

ChevronDownIcon.propTypes = {
  className: PropTypes.string,
};

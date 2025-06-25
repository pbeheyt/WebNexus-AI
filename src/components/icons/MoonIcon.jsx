import React from 'react';
import PropTypes from 'prop-types';

export function MoonIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      {...props}
    >
      <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21.21 12.79z'></path>
    </svg>
  );
}

MoonIcon.propTypes = {
  className: PropTypes.string,
};

export default MoonIcon;

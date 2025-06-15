// src/components/icons/PlusIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function PlusIcon({ className = 'w-5 h-5', ...props }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      viewBox='0 0 24 24'
      strokeWidth={2} // Consistent stroke width
      stroke='currentColor'
      className={className}
      {...props}
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        d='M12 4.5v15m7.5-7.5h-15'
      />
    </svg>
  );
}

PlusIcon.propTypes = {
  className: PropTypes.string,
};

export default PlusIcon;

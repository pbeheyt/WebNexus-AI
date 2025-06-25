import React from 'react';
import PropTypes from 'prop-types';

/**
 * Chevron Up Icon component.
 * Visually the opposite of ChevronDownIcon.
 * @param {Object} props - Component props
 * @param {string} [props.className='w-4 h-4'] - Tailwind classes for styling.
 */
export function ChevronUpIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      {...props}
    >
      <path
        d='M5 15l7-7 7 7'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

ChevronUpIcon.propTypes = {
  className: PropTypes.string,
};

export default ChevronUpIcon;

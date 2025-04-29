// src/components/icons/OutputTokenIcon.jsx
import React from 'react';

export function OutputTokenIcon({ className = 'w-3 h-3', ...props }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      {...props}
    >
      <path
        d='M12 6v12M7 13l5 5 5-5'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

export default OutputTokenIcon;

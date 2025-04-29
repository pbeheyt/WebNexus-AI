// src/components/icons/ArrowUpIcon.jsx
import React from 'react';

export function ArrowUpIcon({ className = '', ...props }) {
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
      <path d='M12 20V4' />
      <path d='M5 11L12 4L19 11' />
    </svg>
  );
}

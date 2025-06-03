// src/components/icons/HistoryIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function HistoryIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={className}
      stroke='currentColor'
      strokeWidth='2'
      {...props}
    >
      <circle cx='12' cy='12' r='10' stroke='currentColor' />
      <polyline points='12,6 12,12 16,14' stroke='currentColor' />
    </svg>
  );
}

HistoryIcon.propTypes = {
  className: PropTypes.string,
};

export default HistoryIcon;
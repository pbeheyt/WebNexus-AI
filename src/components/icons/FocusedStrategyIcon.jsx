// src/components/icons/FocusedStrategyIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function FocusedStrategyIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={className}
      {...props}
    >
      {/* Target/crosshair representing focused extraction */}
      <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='2' />
      <circle cx='12' cy='12' r='5' stroke='currentColor' strokeWidth='2' />
      <circle cx='12' cy='12' r='1.5' fill='currentColor' />

      {/* Crosshair lines */}
      <line
        x1='3'
        y1='12'
        x2='7'
        y2='12'
        stroke='currentColor'
        strokeWidth='2'
      />
      <line
        x1='17'
        y1='12'
        x2='21'
        y2='12'
        stroke='currentColor'
        strokeWidth='2'
      />
      <line
        x1='12'
        y1='3'
        x2='12'
        y2='7'
        stroke='currentColor'
        strokeWidth='2'
      />
      <line
        x1='12'
        y1='17'
        x2='12'
        y2='21'
        stroke='currentColor'
        strokeWidth='2'
      />
    </svg>
  );
}

FocusedStrategyIcon.propTypes = {
  className: PropTypes.string,
};

export default FocusedStrategyIcon;

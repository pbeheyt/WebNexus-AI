// src/components/icons/SidebarIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function SidepanelIcon({ className = 'w-4 h-4', ...props }) {
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
      <rect x='3' y='3' width='18' height='18' rx='2' stroke='currentColor' />
      <line x1='15' y1='3' x2='15' y2='21' stroke='currentColor' />
    </svg>
  );
}

SidepanelIcon.propTypes = {
  className: PropTypes.string,
};

export default SidepanelIcon;

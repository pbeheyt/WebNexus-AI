// src/components/icons/BroadStrategyIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function BroadStrategyIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Grid pattern representing broad/comprehensive extraction */}
      <rect x="3" y="3" width="6" height="6" stroke="currentColor" strokeWidth="2" rx="1"/>
      <rect x="15" y="3" width="6" height="6" stroke="currentColor" strokeWidth="2" rx="1"/>
      <rect x="9" y="3" width="6" height="6" stroke="currentColor" strokeWidth="2" rx="1"/>
      
      <rect x="3" y="9" width="6" height="6" stroke="currentColor" strokeWidth="2" rx="1"/>
      <rect x="15" y="9" width="6" height="6" stroke="currentColor" strokeWidth="2" rx="1"/>
      <rect x="9" y="9" width="6" height="6" stroke="currentColor" strokeWidth="2" rx="1"/>
      
      <rect x="3" y="15" width="6" height="6" stroke="currentColor" strokeWidth="2" rx="1"/>
      <rect x="15" y="15" width="6" height="6" stroke="currentColor" strokeWidth="2" rx="1"/>
      <rect x="9" y="15" width="6" height="6" stroke="currentColor" strokeWidth="2" rx="1"/>
      
      {/* Small dots in alternating squares to show comprehensive coverage */}
      <circle cx="6" cy="6" r="1" fill="currentColor"/>
      <circle cx="18" cy="6" r="1" fill="currentColor"/>
      <circle cx="6" cy="18" r="1" fill="currentColor"/>
      <circle cx="18" cy="18" r="1" fill="currentColor"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
    </svg>
  );
}

BroadStrategyIcon.propTypes = {
  className: PropTypes.string,
};

export default BroadStrategyIcon;

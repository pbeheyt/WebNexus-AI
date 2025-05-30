// src/components/icons/ModelParametersIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

export function ModelParametersIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Top slider track */}
      <line x1="3" y1="6" x2="21" y2="6"/>
      {/* Top slider handle */}
      <circle cx="15" cy="6" r="1.5" fill="currentColor"/>
      
      {/* Middle slider track */}
      <line x1="3" y1="12" x2="21" y2="12"/>
      {/* Middle slider handle */}
      <circle cx="7" cy="12" r="1.5" fill="currentColor"/>
      
      {/* Bottom slider track */}
      <line x1="3" y1="18" x2="21" y2="18"/>
      {/* Bottom slider handle */}
      <circle cx="17" cy="18" r="1.5" fill="currentColor"/>
    </svg>
  );
}

ModelParametersIcon.propTypes = {
  className: PropTypes.string,
};

export default ModelParametersIcon;

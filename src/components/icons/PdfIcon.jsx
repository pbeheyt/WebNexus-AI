// src/components/icons/PdfIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Icon representing a PDF document.
 * Uses a hardcoded red color for the stroke.
 */
export function PdfIcon({ className = 'w-5 h-5', ...props }) {
  const pdfColor = '#F40F02'; // PDF red color

  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={className}
      {...props}
    >
      <path
        d='M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z'
        stroke={pdfColor}
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M14 2V8H20'
        stroke={pdfColor}
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M9 13H15'
        stroke={pdfColor}
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M9 17H12'
        stroke={pdfColor}
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

PdfIcon.propTypes = {
  className: PropTypes.string,
};

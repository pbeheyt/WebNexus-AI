import React, { memo } from 'react';

/**
 * Reusable Copy Button Icon component
 * Provides consistent SVG icons for different copy states
 * @param {Object} props - Component props
 * @param {string} props.state - Current copy state ('idle', 'copied', or 'error')
 * @returns {JSX.Element} - The appropriate icon based on state
 */
const CopyButtonIcon = memo(({ state = 'idle' }) => {
  switch (state) {
    case 'copied':
      // Checkmark icon for copied state
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      );
    case 'error':
      // X icon for error state
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      );
    default:
      // Default copy icon
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 352.804 352.804" fill="currentColor" className="w-3 h-3">
          <path d="M318.54,57.282h-47.652V15c0-8.284-6.716-15-15-15H34.264c-8.284,0-15,6.716-15,15v265.522c0,8.284,6.716,15,15,15h47.651v42.281c0,8.284,6.716,15,15,15H318.54c8.284,0,15-6.716,15-15V72.282C333.54,63.998,326.824,57.282,318.54,57.282z M49.264,265.522V30h191.623v27.282H96.916c-8.284,0-15,6.716-15,15v193.24H49.264z M303.54,322.804H111.916V87.282H303.54V322.804z"/>
        </svg>
      );
  }
});

export default CopyButtonIcon;
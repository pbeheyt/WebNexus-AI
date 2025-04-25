import React from 'react';

export function TextSizeIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 7V6h16v1"/>
      <path d="M10 18h4"/>
      <path d="M12 6v12"/>
      <path d="M17 11l-1-1-1 1"/>
      <path d="M7 11l1-1 1 1"/>
      <path d="M15 15H9"/>
    </svg>
  );
}

import React from 'react';

export function TextSizeIcon({ className = 'w-4 h-4', ...props }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      className={className} 
      viewBox="0 0 1024 1024" 
      fill="currentColor"
      {...props}
    >
      <path d="M64 512h384v128H320v384H192V640H64z m896-256H708.26v768h-136.5V256H320.02V128h640z"/>
    </svg>
  );
}

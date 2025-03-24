// src/components/layout/Tooltip.jsx
import React from 'react';

export function Tooltip({ show, message }) {
  if (!show) {
    return null;
  }

  return (
    <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 w-32 text-center shadow-lg">
      {message}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-8 border-transparent border-b-gray-800"></div>
    </div>
  );
}
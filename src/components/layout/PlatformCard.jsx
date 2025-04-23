// src/components/layout/PlatformCard.jsx
import React, { useRef } from 'react';

export function PlatformCard({
  id,
  name,
  iconUrl,
  selected,
  onClick,
  showName = true
}) {
  const cardRef = useRef(null);

  // Handle card click
  const handleClick = () => {
      onClick(id);
  };

  return (
    <div
      ref={cardRef}
      className={`
        flex flex-col items-center justify-center p-2 rounded-md transition-all duration-200 select-none cursor-pointer
        ${selected
          ? 'bg-gray-200 dark:bg-gray-700'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        }
      `}
      onClick={handleClick}
    >
      <div className="relative">
        <img
          src={iconUrl}
          alt={name}
          className={`${showName ? 'w-5 h-5' : 'w-7 h-7'} object-contain`}
        />
      </div>

      {showName && (
        <div className="text-xs text-center mt-1.5 text-theme-secondary">
          {name}
        </div>
      )}
    </div>
  );
}
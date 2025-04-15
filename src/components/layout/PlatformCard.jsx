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
        ${selected ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-theme-hover'}
      `}
      onClick={handleClick}
    >
      <div className="relative">
        <img
          src={iconUrl}
          alt={name}
          className={`${showName ? 'w-6 h-6' : 'w-8 h-8'} object-contain`}
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
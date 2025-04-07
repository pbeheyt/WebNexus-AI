import React, { useState, useRef } from 'react';
import { Tooltip } from './Tooltip'; // Assuming Tooltip is in the same directory or correctly imported

export function PlatformCard({
  id,
  name,
  iconUrl,
  selected,
  onClick,
  showName = true
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const cardRef = useRef(null);

  // Handle card click
  const handleClick = () => {
    if (!isDisabled) {
      onClick(id);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`
        flex flex-col items-center justify-center p-2 rounded-md transition-all duration-200 select-none
        ${selected ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-theme-hover'}
        ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
      onMouseEnter={() => isDisabled && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={handleClick}
      aria-disabled={isDisabled}
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

      {/* Tooltip component */}
      <Tooltip 
        show={showTooltip} 
        message="API credentials required" 
        targetRef={cardRef} 
      />
    </div>
  );
}

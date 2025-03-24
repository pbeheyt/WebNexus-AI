import React, { useState } from 'react';
import { Tooltip } from './Tooltip'; // Adjust the import path as needed

export function PlatformCard({
  id,
  name,
  iconUrl,
  selected,
  onClick,
  hasCredentials = true,
  checkCredentials = false,
  showName = true
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Determine if card should be disabled
  const isDisabled = checkCredentials && !hasCredentials;

  // Dynamic classes based on state
  const cardClasses = `
    flex flex-col items-center justify-center p-1 rounded border border-gray-200
    dark:border-gray-700 transition-all duration-200
    ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
    ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
    relative
  `;

  const handleClick = () => {
    if (!isDisabled) {
      onClick(id);
    }
  };

  return (
    <div
      className={cardClasses}
      onMouseEnter={() => isDisabled && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={handleClick}
    >
      <div className={`relative ${isDisabled ? 'grayscale' : ''}`}>
        <img
          src={iconUrl}
          alt={name}
          className={showName ? "w-5 h-5 object-contain" : "w-9 h-9 object-contain"}
        />
        
        {/* Disabled visual indicator */}
        {isDisabled && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-full absolute opacity-20"></div>
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-5a1 1 0 100-2 1 1 0 000 2z" />
            </svg>
          </div>
        )}
      </div>
      
      {showName && <div className="text-xs text-center mt-1">{name}</div>}

      {/* Tooltip component */}
      <Tooltip show={showTooltip} message="API credentials required" />
    </div>
  );
}

export default PlatformCard;
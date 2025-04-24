// src/components/layout/PlatformIcon.jsx
import React from 'react';

/**
 * Reusable component for displaying platform icons.
 * Handles conditional inversion for specific platforms (ChatGPT, Grok).
 * @param {object} props - Component props
 * @param {string} props.platformId - The unique ID of the platform (e.g., 'chatgpt', 'gemini').
 * @param {string} props.iconUrl - The URL of the icon image.
 * @param {string} props.altText - The alt text for the image.
 * @param {string} [props.className=''] - Optional additional CSS classes for the img tag.
 */
export function PlatformIcon({ platformId, iconUrl, altText, className = '' }) {
  // Determine if inversion is needed
  const needsInvert = platformId === 'chatgpt' || platformId === 'grok';
  
  // Combine base classes, passed classes, and conditional invert class
  const finalClassName = `
    object-contain 
    select-none 
    ${className} 
    ${needsInvert ? 'invert dark:invert-0' : ''}
  `.trim().replace(/\s+/g, ' '); // Trim and remove extra spaces

  return (
    <img
      src={iconUrl}
      alt={altText}
      className={finalClassName}
    />
  );
}

export default PlatformIcon;

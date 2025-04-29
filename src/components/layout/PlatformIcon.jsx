// src/components/layout/PlatformIcon.jsx
import React from 'react';

import { useUI } from '../../contexts/UIContext';

/**
 * Reusable component for displaying platform icons.
 * Handles conditional inversion for specific platforms (ChatGPT, Grok).
 * @param {object} props - Component props
 * @param {string} props.platformId - The unique ID of the platform (e.g., 'chatgpt', 'gemini').
 * @param {string} props.iconUrl - The URL of the icon image.
 * @param {string} props.altText - The alt text for the image.
 * @param {string} [props.className=''] - Optional additional CSS classes for the img tag.
 */
export function PlatformIcon({
  platformId,
  iconUrl,
  altText,
  className = '',
  ...props
}) {
  const { theme } = useUI();
  const needsInvert =
    theme === 'light' && (platformId === 'chatgpt' || platformId === 'grok');
  const invertClass = needsInvert ? 'invert' : '';

  // Combine base classes with passed classes
  const finalClassName = `
    object-contain
    select-none
    ${invertClass}
    ${className}
  `
    .trim()
    .replace(/\s+/g, ' ');

  return (
    <img src={iconUrl} alt={altText} className={finalClassName} {...props} />
  );
}

export default PlatformIcon;

import React from 'react';

/**
 * Renders a single platform logo item for selection.
 * Scales smoothly on hover (scale-125). Selected item maintains scale.
 * Platform name is NEVER displayed.
 * No visible border or focus outline/ring is applied on click/active, enforced via CSS.
 * Default focus outline is allowed for keyboard navigation (:focus-visible).
 * Accepts a disabled prop to control active state and cursor during processing.
 *
 * @param {object} props - Component props
 * @param {string} props.id - Platform identifier
 * @param {string} props.name - Platform display name (used for aria-label)
 * @param {string} props.iconUrl - URL for the platform's logo
 * @param {boolean} props.isSelected - Whether this item is currently selected
 * @param {function} props.onClick - Callback function when the item is clicked (receives id)
 * @param {boolean} [props.disabled=false] - Whether the button should be disabled
 */
export function PlatformLogoItem({
  id,
  name,
  iconUrl,
  isSelected,
  onClick,
  disabled = false, // Add disabled prop
}) {
  const handleClick = () => {
    // Prevent action if disabled
    if (!disabled) {
      onClick(id);
    }
  };

  // Base classes for the button container - REMOVED inline focus/active utilities. Added specific class 'platform-logo-button'. Kept base transparent border style class.
  const baseButtonClasses = `platform-logo-button group relative flex flex-col items-center justify-center transition-all duration-300 ease-in-out ${isSelected ? 'px-4' : 'px-1'} rounded-md border-2 border-transparent disabled:opacity-50 disabled:cursor-not-allowed user-select-none cursor-pointer`; // Added 'platform-logo-button', removed focus/active utilities, kept border-2 border-transparent

  // Conditional classes for the image based on selection and hover - ensure smooth transition
  const imageBaseClasses = 'object-contain transition-transform duration-300 ease-in-out logo-hover-effect';
  // Apply scale-125 on hover (if not selected) and when selected. Base size is w-8 h-8.
  const imageSizeClasses = isSelected ? 'w-6 h-6 scale-200' : 'w-6 h-6 group-hover:scale-200';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={baseButtonClasses} // Apply the base classes
      aria-label={`Select ${name}`} // Keep name for accessibility label
      aria-pressed={isSelected}
      disabled={disabled} // Apply disabled attribute
    >
      {/* Logo Image */}
      <img
        src={iconUrl}
        alt={`${name} logo`} // Keep name for alt text
        className={`${imageBaseClasses} platform-logo-image ${imageSizeClasses}`}
      />
    </button>
  );
}

export default PlatformLogoItem;

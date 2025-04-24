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
  disabled = false,
}) {
  const handleClick = () => {
    // Prevent action if disabled
    if (!disabled) {
      onClick(id);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="platform-logo-btn-fixed group relative transition-all duration-300 ease-in-out rounded-md border-2 border-transparent disabled:opacity-50 disabled:cursor-not-allowed user-select-none cursor-pointer"
      aria-label={`Select ${name}`}
      aria-pressed={isSelected}
      disabled={disabled}
    >
      {/* Logo Image */}
      <img
        src={iconUrl}
        alt={name}
        className={`platform-logo-img-fixed ${id === 'chatgpt' ? 'invert dark:invert-0' : ''}`}
      />
    </button>
  );
}

export default PlatformLogoItem;

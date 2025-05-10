// src/settings/components/ui/common/SettingsCard.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * A reusable card component for settings sections.
 *
 * @param {Object} props - Component props.
 * @param {React.ReactNode} props.children - The content of the card.
 * @param {string} [props.className=''] - Additional CSS classes for the card.
 * @param {string} [props.as='div'] - The HTML element type to render the card as (e.g., 'div', 'form').
 * @param {Object} [props.otherProps] - Any other props to spread onto the root element.
 */
export function SettingsCard({ children, className = '', as: Component = 'div', ...otherProps }) {
  const baseClasses = 'bg-theme-surface p-5 rounded-lg border border-theme';

  const combinedClasses = [baseClasses, className].join(' ').trim();

  return (
    <Component className={combinedClasses} {...otherProps}>
      {children}
    </Component>
  );
}

SettingsCard.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  as: PropTypes.elementType,
};

export default SettingsCard;

// src/settings/components/ui/common/SelectorSection.jsx
import React from 'react';
import PropTypes from 'prop-types';

import SettingsCard from './SettingsCard';

/**
 * A reusable section component for displaying a title, an optional description,
 * and a primary child element (typically a selector), wrapped in a SettingsCard.
 *
 * @param {Object} props - Component props
 * @param {string} props.title - The title of the section.
 * @param {string} [props.description] - An optional description text to display below the title.
 * @param {React.ReactNode} props.children - The main content of the section (e.g., a CustomSelect).
 * @param {string} [props.className=''] - Additional CSS classes for the SettingsCard wrapper.
 * @param {React.ReactNode} [props.actionElement] - An optional element to display on the right of the title.
 * @param {React.ReactNode} [props.inlineControl] - An optional control to display inline with the title.
 */
export function SelectorSection({ title, description, children, className = '', actionElement, inlineControl }) {
  return (
    <SettingsCard className={`selector-section-container mb-6 ${className}`}>
        {(title || inlineControl || actionElement) && (
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              {title && (
                <h3 className='text-lg font-medium text-theme-primary select-none'>
                  {title}
                </h3>
              )}
              {inlineControl && <div className="ml-4">{inlineControl}</div>}
            </div>
            {actionElement && <div className="ml-auto pl-2">{actionElement}</div>}
          </div>
        )}
      {description && (
        <p className='text-sm text-theme-secondary mb-4 select-none'>
          {description}
        </p>
      )}
      {children}
    </SettingsCard>
  );
}

SelectorSection.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
            children: PropTypes.node,
  className: PropTypes.string,
  actionElement: PropTypes.node,
  inlineControl: PropTypes.node,
};

export default SelectorSection;

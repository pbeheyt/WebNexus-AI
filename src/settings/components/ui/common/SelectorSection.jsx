// src/settings/components/ui/common/SelectorSection.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * A reusable section component for displaying a title, an optional description,
 * and a primary child element (typically a selector).
 *
 * @param {Object} props - Component props
 * @param {string} props.title - The title of the section.
 * @param {string} [props.description] - An optional description text to display below the title.
 * @param {React.ReactNode} props.children - The main content of the section (e.g., a CustomSelect).
 * @param {string} [props.className=''] - Additional CSS classes for the main container.
 */
export function SelectorSection({ title, description, children, className = '', actionElement, inlineControl }) {
  return (
    <div
      className={`selector-section-container p-5 bg-theme-surface border border-theme rounded-lg mb-6 ${className}`}
    >
        {(title || inlineControl || actionElement) && (
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              {title && (
                <h3 className='text-lg font-medium text-theme-primary select-none'>
                  {title}
                </h3>
              )}
              {inlineControl && <div className="ml-3">{inlineControl}</div>}
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
    </div>
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

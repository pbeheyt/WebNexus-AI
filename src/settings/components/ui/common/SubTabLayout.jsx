// src/settings/components/ui/common/SubTabLayout.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * A reusable layout component for displaying content switchable by sub-tabs.
 *
 * @param {Object} props - Component props
 * @param {Array<{id: string, label: string}>} props.tabs - Configuration for the sub-tabs.
 * @param {string} props.activeTabId - The ID of the currently active sub-tab.
 * @param {(tabId: string) => void} props.onTabSelect - Callback function when a sub-tab is selected.
 * @param {(activeTabId: string) => React.ReactNode} props.children - A function that returns the content for the active tab.
 * @param {string} [props.className=''] - Additional CSS classes for the main container.
 */
export function SubTabLayout({
  tabs,
  activeTabId,
  onTabSelect,
  children,
  className = '',
}) {
  return (
    <div className={`sub-tab-layout ${className}`}>
      <div className='sub-tab-navigation flex border-b border-theme mb-5'>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type='button'
            role='tab'
            aria-selected={activeTabId === tab.id}
            className={`sub-tab-btn relative py-2 px-4 text-sm cursor-pointer bg-transparent border-none transition-colors select-none
              ${
                activeTabId === tab.id
                  ? 'text-primary font-medium after:content-[""] after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-0.5 after:bg-primary'
                  : 'text-theme-secondary hover:text-theme-primary'
              }
            `}
            onClick={() => onTabSelect(tab.id)}
            disabled={activeTabId === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className='sub-tab-content'>
        {typeof children === 'function' ? children(activeTabId) : children}
      </div>
    </div>
  );
}

SubTabLayout.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeTabId: PropTypes.string.isRequired,
  onTabSelect: PropTypes.func.isRequired,
  children: PropTypes.func.isRequired, // Expecting a render prop
  className: PropTypes.string,
};

export default SubTabLayout;

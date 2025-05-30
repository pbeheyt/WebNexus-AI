// src/sidepanel/components/Header.jsx
import React from 'react';
import PropTypes from 'prop-types';

function Header({ isExpanded }) {
  // This component is now a placeholder for future content.
  if (!isExpanded) {
    return null;
  }

  return (
    <div className='px-3 py-2 border-b border-theme'>
      <p className='text-xs text-theme-secondary italic'>
        Future content will go here. (This section is collapsible)
      </p>
    </div>
  );
}

Header.propTypes = {
  isExpanded: PropTypes.bool,
};

export default Header;
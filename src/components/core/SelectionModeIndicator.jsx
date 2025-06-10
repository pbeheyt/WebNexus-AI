// src/components/core/SelectionModeIndicator.jsx
import React from 'react';
import PropTypes from 'prop-types';

import { MouseIcon } from '../icons/MouseIcon';

export function SelectionModeIndicator({ className = '' }) {
  return (
    <div className={`flex items-center gap-1 w-full mt-3 cursor-default ${className}`}>
      <MouseIcon className="w-5 h-5 text-theme-primary flex-shrink-0" />
      <span className="text-sm text-theme-primary font-medium truncate ml-1">
        Selected Text
      </span>
    </div>
  );
}

SelectionModeIndicator.propTypes = {
  className: PropTypes.string,
};

export default SelectionModeIndicator;

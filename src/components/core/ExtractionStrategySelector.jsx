// src/components/core/ExtractionStrategySelector.jsx
import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

import {
  STORAGE_KEYS,
  EXTRACTION_STRATEGIES,
  DEFAULT_EXTRACTION_STRATEGY,
} from '../../shared/constants';
import { logger } from '../../shared/logger';
import { FocusedStrategyIcon, BroadStrategyIcon } from '../';

import { IconButton } from './IconButton';

export function ExtractionStrategySelector({ disabled = false, onChange, className = '' }) {
  const [currentStrategy, setCurrentStrategy] = useState(DEFAULT_EXTRACTION_STRATEGY);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const loadStrategy = async () => {
      try {
        const result = await chrome.storage.sync.get(
          STORAGE_KEYS.GENERAL_CONTENT_EXTRACTION_STRATEGY
        );
        const storedStrategy =
          result[STORAGE_KEYS.GENERAL_CONTENT_EXTRACTION_STRATEGY];

        // After installation, a default is set by the background script.
        // We primarily check if the stored value is one of the known valid strategies.
        if (
          storedStrategy === EXTRACTION_STRATEGIES.FOCUSED ||
          storedStrategy === EXTRACTION_STRATEGIES.BROAD
        ) {
          setCurrentStrategy(storedStrategy);
        } else {
          // This case implies either storage corruption, a new strategy value not yet handled,
          // or accessed before install (though background should set it on install).
          // For UI stability, use the component's defined default and log a warning.
          // Do NOT write back to storage here; background handles initial default.
          setCurrentStrategy(DEFAULT_EXTRACTION_STRATEGY);
          logger.service.warn(
            `ExtractionStrategySelector: Unexpected or no strategy value ('${storedStrategy}') found in sync storage. Using UI default '${DEFAULT_EXTRACTION_STRATEGY}'. This should be rare after initial install.`
          );
        }
      } catch (error) {
        logger.service.error('Error loading extraction strategy:', error);
        // Fallback to UI default if loading fails catastrophically
        setCurrentStrategy(DEFAULT_EXTRACTION_STRATEGY);
      }
    };
    loadStrategy();
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleStrategyChange = async (newStrategy) => {
    if (newStrategy === currentStrategy) {
      setIsDropdownOpen(false);
      return;
    }
    try {
      await chrome.storage.sync.set({
        [STORAGE_KEYS.GENERAL_CONTENT_EXTRACTION_STRATEGY]: newStrategy,
      });
      setCurrentStrategy(newStrategy);
      if (onChange) {
        onChange(newStrategy);
      }
    } catch (error) {
      logger.service.error('Error saving extraction strategy:', error);
    }
    setIsDropdownOpen(false);
  };

  const StrategyIcon =
    currentStrategy === EXTRACTION_STRATEGIES.FOCUSED
      ? FocusedStrategyIcon
      : BroadStrategyIcon;
  const strategyLabel =
    currentStrategy === EXTRACTION_STRATEGIES.FOCUSED
      ? 'Focused'
      : 'Broad';

    return (
      <div className={`relative inline-block ${className}`} ref={dropdownRef}>
        <IconButton
          ref={triggerRef}
          icon={StrategyIcon}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={disabled}
          aria-label={`Current strategy: ${strategyLabel}. Click to change.`}
          title={`Extraction: ${strategyLabel}`}
          className={`p-1 rounded-md transition-colors ${
            disabled
              ? 'text-theme-disabled cursor-not-allowed'
              : 'text-theme-secondary hover:text-primary hover:bg-theme-active'
          }`}
          iconClassName="w-5 h-5"
        />
        <div
          className={`absolute top-full right-0 mt-1 bg-theme-surface border border-theme rounded-md shadow-md p-1 w-fit min-w-0 max-w-48 z-50 transition-all duration-300 ease-in-out ${
            isDropdownOpen
              ? 'opacity-100 max-h-[150px] overflow-y-auto'
              : 'opacity-0 max-h-0 overflow-hidden'
          }`}
          role="menu"
        >
          <button
            onClick={() => handleStrategyChange(EXTRACTION_STRATEGIES.FOCUSED)}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-theme-hover rounded cursor-pointer ${
              currentStrategy === EXTRACTION_STRATEGIES.FOCUSED
                ? 'text-primary'
                : 'text-theme-primary'
            }`}
            role="menuitem"
            disabled={disabled}
          >
            <FocusedStrategyIcon className="w-5 h-5 mr-1" />
            Focused
          </button>
          <button
            onClick={() => handleStrategyChange(EXTRACTION_STRATEGIES.BROAD)}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-theme-hover rounded cursor-pointer ${
              currentStrategy === EXTRACTION_STRATEGIES.BROAD
                ? 'text-primary'
                : 'text-theme-primary'
            }`}
            role="menuitem"
            disabled={disabled}
          >
            <BroadStrategyIcon className="w-5 h-5 mr-1" />
            Broad
          </button>
        </div>
      </div>
    );
}

ExtractionStrategySelector.propTypes = {
  disabled: PropTypes.bool,
  onChange: PropTypes.func,
  className: PropTypes.string,
};

export default ExtractionStrategySelector;

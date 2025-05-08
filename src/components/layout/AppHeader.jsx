import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import { useUI } from '../../contexts/UIContext';
import { logger } from '../../shared/logger';
import { STORAGE_KEYS } from '../../shared/constants';
import { IconButton } from '../core/IconButton';
import { Toggle } from '../core/Toggle';
import {
  InfoIcon,
  TextSizeIcon,
  SunIcon,
  MoonIcon,
  SettingsIcon,
  RefreshIcon,
  ChevronDownIcon,
  XIcon,
  FloatingButtonIcon
} from '../icons';

export function AppHeader({
  children,
  showSettingsButton = true,
  showRefreshButton = false,
  onClose,
  onRefreshClick,
  isExpanded = false,
  isRefreshing = false,
  onToggleExpand = () => {},
  showExpandToggle = false,
  className = '',
  showBorder = true,
  showInfoButton = false,
  infoButtonRef,
  onInfoMouseEnter,
  onInfoMouseLeave,
  onInfoFocus,
  onInfoBlur,
  infoButtonAriaLabel,
}) {
  const { theme, toggleTheme, textSize, toggleTextSize } = useUI();
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [isFloatingButtonToggleReady, setIsFloatingButtonToggleReady] = useState(false);

  // Load preference for floating button on mount
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const result = await chrome.storage.sync.get(
          STORAGE_KEYS.SHOW_FLOATING_ACTION_BUTTON
        );
        if (result[STORAGE_KEYS.SHOW_FLOATING_ACTION_BUTTON] !== undefined) {
          setShowFloatingButton(result[STORAGE_KEYS.SHOW_FLOATING_ACTION_BUTTON]);
        } else {
          // If not set, default to false and save it
          setShowFloatingButton(false);
          await chrome.storage.sync.set({
            [STORAGE_KEYS.SHOW_FLOATING_ACTION_BUTTON]: false,
          });
        }
      } catch (error) {
        logger.popup.error('Error loading floating button preference:', error);
        setShowFloatingButton(false); // Default to false on error
      } finally {
        setIsFloatingButtonToggleReady(true);
      }
    };
    loadPreference();
  }, []);

  const handleFloatingButtonToggle = async (newCheckedState) => {
    setShowFloatingButton(newCheckedState);
    try {
      await chrome.storage.sync.set({
        [STORAGE_KEYS.SHOW_FLOATING_ACTION_BUTTON]: newCheckedState,
      });
      logger.popup.info(
        `Floating action button preference set to: ${newCheckedState}`
      );
    } catch (error) {
      logger.popup.error('Error saving floating button preference:', error);
    }
  };

  const openSettings = () => {
    try {
      chrome.runtime.openOptionsPage();
    } catch (error) {
      logger.popup.error('Could not open options page:', error);
      // Fallback for environments where openOptionsPage might not be available or fail
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    }
  };

  // Construct the base classes and conditionally add the border classes
  const headerClasses = `
    flex items-center justify-between
    ${showBorder ? 'border-b border-theme' : ''}
    select-none
    ${className} // Append any custom classes passed via props
  `
    .trim()
    .replace(/\s+/g, ' '); // Trim whitespace and normalize spaces

  return (
    <header className={headerClasses}>
      <h1 className='text-base font-semibold flex items-center'>
        {/* Ensure chrome API is available before accessing runtime */}
        {typeof chrome !== 'undefined' &&
          chrome.runtime &&
          chrome.runtime.getURL && (
            <img
              src={chrome.runtime.getURL('images/logo.png')}
              alt='AI Content Assistant logo'
              className='w-5 h-5 mr-2'
            />
          )}
        <span className='truncate overflow-hidden whitespace-nowrap max-w-[150px]'>
          WebNexus AI
        </span>
      </h1>

      <div className='flex items-center gap-1'>
        {/* Floating Action Button Toggle */}
        {isFloatingButtonToggleReady && (
          <div
            className="flex items-center mr-1"
            title={
              showFloatingButton
                ? 'Hide Floating Action Button on pages'
                : 'Show Floating Action Button on pages'
            }
          >
            <FloatingButtonIcon className="w-4 h-4 text-theme-secondary mr-1.5" />
            <Toggle
              id="floating-button-toggle"
              checked={showFloatingButton}
              onChange={handleFloatingButtonToggle}
              className="w-7 h-3.5" // Slightly smaller toggle
              aria-label={
                showFloatingButton
                  ? 'Disable floating action button'
                  : 'Enable floating action button'
              }
            />
          </div>
        )}

        {/* Info button */}
        {showInfoButton && (
          <IconButton
            ref={infoButtonRef}
            icon={InfoIcon}
            iconClassName='w-4 h-4'
            className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={onInfoMouseEnter}
            onMouseLeave={onInfoMouseLeave}
            onFocus={onInfoFocus}
            onBlur={onInfoBlur}
            ariaLabel={infoButtonAriaLabel}
            // title={infoButtonAriaLabel}
          />
        )}

        {/* Text size toggle button */}
        <button
          onClick={toggleTextSize}
          className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
          title={
            textSize === 'sm'
              ? 'Switch to Base Size'
              : textSize === 'base'
                ? 'Switch to Large Size'
                : 'Switch to Small Size'
          }
        >
          <TextSizeIcon />
        </button>

        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Settings button */}
        {showSettingsButton && (
          <button
            onClick={openSettings}
            className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
            title='Settings'
          >
            <SettingsIcon />
          </button>
        )}

        {/* Render any custom buttons passed as children */}
        {children}

        {/* Conditionally render Refresh button */}
        {showRefreshButton && (
          <button
            onClick={
              typeof onRefreshClick === 'function' && !isRefreshing ? onRefreshClick : undefined
            }
            className={`p-1 rounded transition-colors ${
              isRefreshing
                ? 'text-theme-disabled cursor-not-allowed'
                : 'text-theme-secondary hover:text-primary hover:bg-theme-active'
            }`}
            title={isRefreshing ? 'Refreshing...' : 'Clear chat'}
            disabled={isRefreshing}
          >
            <RefreshIcon className={`w-4 h-4 select-none ${
              isRefreshing ? 'animate-spin' : ''
            }`} />
          </button>
        )}

        {/* Chevron Expand/Collapse Button - Conditionally Rendered */}
        {showExpandToggle && (
          <button
            onClick={onToggleExpand}
            className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
            title={isExpanded ? 'Collapse header' : 'Expand header'}
            aria-expanded={isExpanded}
          >
            <ChevronDownIcon
              className={`w-4 h-4 transition-transform select-none ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}

        {/* Conditionally render Close button if onClose prop is provided */}
        {typeof onClose === 'function' && (
          <button
            onClick={onClose}
            className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
            title='Close'
          >
            <XIcon />
          </button>
        )}
      </div>
    </header>
  );
}

AppHeader.propTypes = {
  children: PropTypes.node,
  showSettingsButton: PropTypes.bool,
  showRefreshButton: PropTypes.bool,
  onClose: PropTypes.func,
  onRefreshClick: PropTypes.func,
  isExpanded: PropTypes.bool,
  isRefreshing: PropTypes.bool,
  onToggleExpand: PropTypes.func,
  showExpandToggle: PropTypes.bool,
  className: PropTypes.string,
  showBorder: PropTypes.bool,
  showInfoButton: PropTypes.bool,
  infoButtonRef: PropTypes.object,
  onInfoMouseEnter: PropTypes.func,
  onInfoMouseLeave: PropTypes.func,
  onInfoFocus: PropTypes.func,
  onInfoBlur: PropTypes.func,
  infoButtonAriaLabel: PropTypes.string,
};

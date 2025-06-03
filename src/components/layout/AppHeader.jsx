import React from 'react';
import PropTypes from 'prop-types';

import { useUI } from '../../contexts/UIContext';
import { logger } from '../../shared/logger';
import {
  IconButton,
  InfoIcon,
  TextSizeIcon,
  SunIcon,
  MoonIcon,
  SettingsIcon,
  RefreshIcon,
  ChevronDownIcon,
  XIcon,
  ArrowUpIcon, // Added for history button
  HistoryIcon, // Added for history button
  PlusIcon, // Add this
} from '../';

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
  // New props for history view toggle
  showHistoryButton = false,
  onToggleHistoryView,
  currentView = 'chat',
  showNewChatButton = false, // Add this line
  onNewChatClick,            // Add this line
}) {
  const { theme, toggleTheme, textSize, toggleTextSize } = useUI();

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
    ${className} // Append any custom classes passed via props
  `
    .trim()
    .replace(/\s+/g, ' '); // Trim whitespace and normalize spaces

  return (
    <header className={headerClasses}>
      <h1 className='text-base font-semibold flex items-center'>
        {/* Ensure chrome API is available before accessing runtime */}
        <div className='select-none'>
          {typeof chrome !== 'undefined' &&
            chrome.runtime &&
            chrome.runtime.getURL && (
              <img
                src={chrome.runtime.getURL('images/logo.png')}
                alt='AI Content Assistant logo'
                className='w-5 h-5 mr-2'
              />
            )}
        </div>
        <span className='truncate overflow-hidden whitespace-nowrap max-w-[150px]'>
          WebNexus AI
        </span>
      </h1>

      <div className='flex items-center gap-1'>
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

        {/* History Toggle Button */}
        {showHistoryButton && (
          <button
            onClick={onToggleHistoryView}
            className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
            title={currentView === 'chat' ? 'View Chat History' : 'Back to Active Chat'}
            aria-label={currentView === 'chat' ? 'View Chat History' : 'Back to Active Chat'}
          >
            {currentView === 'chat' ? <HistoryIcon className="w-4 h-4" /> : <ArrowUpIcon className="w-4 h-4 transform rotate-[-90deg]" />}
          </button>
        )}

        {/* New Chat Button */}
        {showNewChatButton && (
          <button
            onClick={onNewChatClick}
            className='p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors'
            title='New Chat'
            aria-label='Start a new chat'
          >
            <PlusIcon className='w-4 h-4' />
          </button>
        )}

        {/* Render any custom buttons passed as children */}
        {children}

        {/* Conditionally render Refresh button */}
        {showRefreshButton && (
          <button
            onClick={
              typeof onRefreshClick === 'function' && !isRefreshing
                ? onRefreshClick
                : undefined
            }
            className={`p-1 rounded transition-colors ${
              isRefreshing
                ? 'text-theme-disabled cursor-not-allowed'
                : 'text-theme-secondary hover:text-primary hover:bg-theme-active'
            }`}
            title={isRefreshing ? 'Refreshing...' : 'Clear chat'}
            disabled={isRefreshing}
          >
            <RefreshIcon
              className={`w-4 h-4 select-none ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
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
  // New prop types
  showHistoryButton: PropTypes.bool,
  onToggleHistoryView: PropTypes.func,
  currentView: PropTypes.oneOf(['chat', 'history']),
  showNewChatButton: PropTypes.bool, // Add this line
  onNewChatClick: PropTypes.func,    // Add this line
};

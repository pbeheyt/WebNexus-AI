import React from 'react';
import { useUI } from '../../contexts/UIContext';
import { 
  IconButton, 
  InfoIcon,
  TextSizeIcon,
  SunIcon,
  MoonIcon,
  SettingsIcon,
  RefreshIcon,
  ChevronDownIcon,
  XIcon
} from '../';

export function AppHeader({
  children,
  showSettingsButton = true,
  showRefreshButton = false,
  onClose,
  onRefreshClick,
  isExpanded = false,
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

  const openSettings = () => {
    try {
      chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error('Could not open options page:', error);
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
  `.trim().replace(/\s+/g, ' '); // Trim whitespace and normalize spaces

  return (
    <header className={headerClasses}>
      <h1 className="text-base font-semibold flex items-center">
        {/* Ensure chrome API is available before accessing runtime */}
        {typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL && (
           <img src={chrome.runtime.getURL('images/icon128.png')} alt="AI Content Assistant logo" className="w-5 h-5 mr-2" />
        )}
        <span className="truncate overflow-hidden whitespace-nowrap max-w-[150px]">
          WebNexus AI
        </span>
      </h1>

      <div className="flex items-center gap-1">
        {/* Info button */}
        {showInfoButton && (
          <IconButton
            ref={infoButtonRef}
            icon={InfoIcon}
            iconClassName="w-4 h-4"
            className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
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
          className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
          title={
            textSize === 'sm' ? "Switch to Base Size" :
            textSize === 'base' ? "Switch to Large Size" :
            "Switch to Small Size"
          }
        >
          <TextSizeIcon />
        </button>

        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Settings button */}
        {showSettingsButton && (
          <button
            onClick={openSettings}
            className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
            title="Settings"
          >
            <SettingsIcon />
          </button>
        )}

        {/* Render any custom buttons passed as children */}
        {children}

        {/* Conditionally render Refresh button */}
        {showRefreshButton && (
          <button
            onClick={typeof onRefreshClick === 'function' ? onRefreshClick : undefined}
            className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
            title="Clear chat"
          >
              <RefreshIcon className="w-4 h-4 select-none" />
          </button>
        )}

        {/* Chevron Expand/Collapse Button - Conditionally Rendered */}
        {showExpandToggle && (
          <button
            onClick={onToggleExpand}
            className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
            title={isExpanded ? "Collapse header" : "Expand header"}
            aria-expanded={isExpanded}
          >
            <ChevronDownIcon className={`w-4 h-4 transition-transform select-none ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}

        {/* Conditionally render Close button if onClose prop is provided */}
        {typeof onClose === 'function' && (
          <button
            onClick={onClose}
            className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
            title="Close"
          >
            <XIcon />
          </button>
        )}
      </div>
    </header>
  );
}

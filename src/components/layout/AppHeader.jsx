import React from 'react';
import { useUI } from '../../contexts/UIContext';

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
          AI Insightr
        </span>
      </h1>

      <div className="flex items-center gap-1">
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
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7V6h16v1"/>
            <path d="M10 18h4"/>
            <path d="M12 6v12"/>
            <path d="M17 11l-1-1-1 1"/>
            <path d="M7 11l1-1 1 1"/>
            <path d="M15 15H9"/>
          </svg>
        </button>

        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21.21 12.79z"></path>
            </svg>
          )}
        </button>

        {/* Settings button */}
        {showSettingsButton && (
          <button
            onClick={openSettings}
            className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1.51-1V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H15a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 select-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
              <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
            </svg>
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
            <svg className={`w-4 h-4 transition-transform select-none ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 9l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        {/* Conditionally render Close button if onClose prop is provided */}
        {typeof onClose === 'function' && (
          <button
            onClick={onClose}
            className="p-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

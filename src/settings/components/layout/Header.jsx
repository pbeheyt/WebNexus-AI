// src/settings/components/layout/Header.jsx
import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { Button } from '../../../components';

const Header = () => {
  const { theme, toggleTheme } = useTheme();
  
  const handleBackClick = () => {
    window.close();
  };
  
  return (
    <header className="flex items-center justify-between mb-6 pb-4 border-b border-theme">
      {/* Updated h1: text size, logo, text content */}
      <h1 className="text-lg font-semibold flex items-center"> {/* Changed text-xl to text-lg, removed gap */}
        <img 
          src={chrome.runtime.getURL('images/icon128.png')} 
          alt="AI Content Assistant logo" 
          className="w-5 h-5 mr-2" // Added img tag with specified classes
        />
        AI Content Assistant {/* Changed text content */}
      </h1>
      
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"> {/* Changed w-5 h-5 to w-4 h-4 */}
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
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"> {/* Changed w-5 h-5 to w-4 h-4 */}
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21.21 12.79z"></path>
            </svg>
          )}
        </button>
        
        {/* Replaced Button component with a simple button and X icon */}
        <button
          onClick={() => window.close()} // Changed handler
          className="p-2 ml-1 text-theme-secondary hover:text-primary hover:bg-theme-active rounded transition-colors" // Changed p-1 to p-2
          title="Close Settings" // Added title
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" stroke="currentColor">
            <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;

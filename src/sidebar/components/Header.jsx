import React from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import { useTheme } from '../../contexts/ThemeContext';
import ModelSelector from './ModelSelector';

function Header({ onClose }) {
  const { platforms, selectedPlatformId, selectPlatform } = useSidebarPlatform();
  const { theme, toggleTheme } = useTheme(); // Use global theme context

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <div className="text-lg font-semibold flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" fill="currentColor"/>
            <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2"/>
          </svg>
          AI Summarizer
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-1 bg-transparent border-none text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer rounded"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21.21 12.79z"></path>
              </svg>
            )}
          </button>
          
          <button
            onClick={onClose}
            className="p-1 bg-transparent border-none text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer rounded"
            title="Close sidebar"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="flex gap-2">
        <div className="grid grid-cols-3 gap-1">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              className={`flex flex-col items-center justify-center p-1 rounded border border-gray-200 dark:border-gray-700 transition-all duration-200 cursor-pointer ${
                platform.id === selectedPlatformId ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              onClick={() => selectPlatform(platform.id)}
            >
              <img 
                src={platform.iconUrl} 
                alt={platform.name} 
                className="w-5 h-5 object-contain"
              />
              <div className="text-xs text-center mt-1">{platform.name}</div>
            </div>
          ))}
        </div>
      </div>
      
      <ModelSelector />
    </div>
  );
}

export default Header;
import React, { createContext, useContext, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../constants';

const SidebarThemeContext = createContext(null);

export function SidebarThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  
  // Initialize theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.THEME);
        const savedTheme = result[STORAGE_KEYS.THEME];
        
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
          setTheme(savedTheme);
        } else {
          // Default to system preference
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setTheme(prefersDark ? 'dark' : 'light');
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      }
    };
    
    loadTheme();
  }, []);
  
  // Apply theme changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  // Toggle theme
  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    try {
      await chrome.storage.sync.set({ [STORAGE_KEYS.THEME]: newTheme });
      
      // Notify parent frame about theme change
      window.parent.postMessage({ type: 'THEME_CHANGED', theme: newTheme }, '*');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };
  
  return (
    <SidebarThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </SidebarThemeContext.Provider>
  );
}

export const useSidebarTheme = () => useContext(SidebarThemeContext);
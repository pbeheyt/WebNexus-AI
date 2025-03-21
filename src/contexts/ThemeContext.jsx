// src/contexts/ThemeContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import themeService from '../services/ThemeService';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    let unsubscribe = null;
    
    const initTheme = async () => {
      try {
        // Initialize theme service
        const currentTheme = await themeService.initialize();
        setTheme(currentTheme);
        setInitialized(true);
        
        // Subscribe to theme changes
        unsubscribe = themeService.subscribe((newTheme) => {
          setTheme(newTheme);
        });
      } catch (error) {
        console.error('Error initializing theme:', error);
        setInitialized(true); // Still mark as initialized to render UI
      }
    };
    
    initTheme();
    
    // Cleanup subscription
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);
  
  const toggleTheme = async () => {
    try {
      // Toggle theme using service
      const newTheme = await themeService.toggleTheme();
      setTheme(newTheme);
    } catch (error) {
      console.error('Error toggling theme:', error);
    }
  };
  
  // Show loading state if theme isn't initialized yet
  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-theme-primary">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
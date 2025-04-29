// src/contexts/UIContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import uiService from '../services/UIService';
import logger from '../shared/logger';

const UIContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  textSize: 'sm',
  toggleTextSize: () => {},
});

export function UIProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [textSize, setTextSize] = useState('sm');
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    let unsubscribe = null;
    
    const initUI = async () => {
      try {
        // Initialize UI service
        const { theme: currentTheme, textSize: currentTextSize } = await uiService.initialize();
        setTheme(currentTheme);
        setTextSize(currentTextSize);
        setInitialized(true);
        
        // Subscribe to UI changes
        unsubscribe = uiService.subscribe(({ theme: newTheme, textSize: newTextSize }) => {
          setTheme(newTheme);
          setTextSize(newTextSize);
        });
      } catch (error) {
        logger.popup.error('Error initializing UI:', error);
        setInitialized(true); // Still mark as initialized to render UI
      }
    };
    
    initUI();
    
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
      const newTheme = await uiService.toggleTheme();
      setTheme(newTheme);
    } catch (error) {
      logger.popup.error('Error toggling theme:', error);
    }
  };

  const toggleTextSize = async () => {
    try {
      // Toggle text size using service
      const newTextSize = await uiService.toggleTextSize();
      setTextSize(newTextSize);
    } catch (error) {
      logger.popup.error('Error toggling text size:', error);
    }
  };
  
  // Show loading state if UI isn't initialized yet
  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-theme-primary">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <UIContext.Provider value={{ theme, toggleTheme, textSize, toggleTextSize }}>
      {children}
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);

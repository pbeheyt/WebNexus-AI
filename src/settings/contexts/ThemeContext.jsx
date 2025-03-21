// import React, { createContext, useContext, useEffect, useState } from 'react';

// const ThemeContext = createContext(null);

// export const useTheme = () => useContext(ThemeContext);

// export const ThemeProvider = ({ children }) => {
//   const [theme, setTheme] = useState('light');
  
//   useEffect(() => {
//     // Load theme from storage
//     const loadTheme = async () => {
//       try {
//         const { ui_preferences } = await chrome.storage.sync.get('ui_preferences');
//         const savedTheme = ui_preferences?.theme || 'light';
//         setTheme(savedTheme);
//       } catch (error) {
//         console.error('Error loading theme:', error);
//       }
//     };
    
//     loadTheme();
//   }, []);
  
//   // Apply theme changes to document element
//   useEffect(() => {
//     if (theme === 'dark') {
//       document.documentElement.classList.add('dark');
//     } else {
//       document.documentElement.classList.remove('dark');
//     }
    
//     document.documentElement.setAttribute('data-theme', theme);
//   }, [theme]);
  
//   const toggleTheme = async () => {
//     const newTheme = theme === 'light' ? 'dark' : 'light';
    
//     try {
//       // Get current preferences
//       const { ui_preferences = {} } = await chrome.storage.sync.get('ui_preferences');
      
//       // Update theme preference
//       await chrome.storage.sync.set({
//         ui_preferences: {
//           ...ui_preferences,
//           theme: newTheme
//         }
//       });
      
//       setTheme(newTheme);
//     } catch (error) {
//       console.error('Error saving theme preference:', error);
//     }
//   };
  
//   return (
//     <ThemeContext.Provider value={{ theme, toggleTheme }}>
//       {children}
//     </ThemeContext.Provider>
//   );
// };
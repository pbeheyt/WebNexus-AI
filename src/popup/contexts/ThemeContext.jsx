// import { createContext, useContext, useEffect, useState } from 'react';
// import themeService from '../../services/ThemeService';
// import { THEMES } from '../../utils/themeUtils';

// const ThemeContext = createContext(null);

// export function ThemeProvider({ children }) {
//   const [theme, setTheme] = useState(THEMES.LIGHT);
  
//   useEffect(() => {
//     // Initialize theme service and get current theme
//     const initTheme = async () => {
//       const currentTheme = await themeService.initialize();
//       setTheme(currentTheme);
//     };
    
//     initTheme();
//   }, []);
  
//   // Apply theme changes to document element
//   useEffect(() => {
//     if (theme) {
//       document.documentElement.setAttribute('data-theme', theme);
//     }
//   }, [theme]);
  
//   const toggleTheme = async () => {
//     const newTheme = await themeService.toggleTheme();
//     setTheme(newTheme);
//   };
  
//   return (
//     <ThemeContext.Provider value={{ theme, toggleTheme }}>
//       {children}
//     </ThemeContext.Provider>
//   );
// }

// export const useTheme = () => useContext(ThemeContext);
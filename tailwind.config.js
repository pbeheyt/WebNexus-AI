module.exports = {
  content: [
    "./src/**/*.{js,jsx}",
    "./popup.html",
    "./settings.html"
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Brand colors (consistent across themes)
        primary: {
          DEFAULT: '#FF7B00',
          hover: '#E06E00',
          secondary: '#FF9D45',
        },
        error: '#FF4545',
        success: '#4CAF50',
        warning: '#FFC107',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      // Define theme-aware utility classes
      const themeUtilities = {
        // Light theme (default)
        '.bg-theme-primary': { backgroundColor: '#F8F8F8' },
        '.bg-theme-surface': { backgroundColor: '#FFFFFF' },
        '.bg-theme-hover': { backgroundColor: '#F2F2F2' },
        '.bg-theme-active': { backgroundColor: 'rgba(255, 123, 0, 0.05)' },
        
        '.text-theme-primary': { color: '#333333' },
        '.text-theme-secondary': { color: '#666666' },
        
        '.border-theme': { borderColor: '#E0E0E0' },
        '.divide-theme': { divideColor: '#E0E0E0' },
        
        '.shadow-theme-light': { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' },
        '.shadow-theme-medium': { boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)' },
        
        '.dark .bg-theme-primary': { backgroundColor: '#1E1E1E' },
        '.dark .bg-theme-surface': { backgroundColor: '#2D2D2D' },
        '.dark .bg-theme-hover': { backgroundColor: '#353535' },
        '.dark .bg-theme-active': { backgroundColor: 'rgba(255, 123, 0, 0.1)' },
        
        '.dark .text-theme-primary': { color: '#FFFFFF' },
        '.dark .text-theme-secondary': { color: '#B0B0B0' },
        
        '.dark .border-theme': { borderColor: '#3D3D3D' },
        '.dark .divide-theme': { divideColor: '#3D3D3D' },
        
        '.dark .shadow-theme-light': { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' },
        '.dark .shadow-theme-medium': { boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' },
      };
      
      addUtilities(themeUtilities);
    }
  ],
}
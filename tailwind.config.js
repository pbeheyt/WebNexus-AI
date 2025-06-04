/** @type {import('tailwindcss').Config} */
const containerQueries = require('@tailwindcss/container-queries');
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './popup.html',
    './settings.html',
    './sidepanel.html',
    './*.html',
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      typography: (theme) => ({
        DEFAULT: {
          // Applies to the base 'prose' class
          css: {
            // Target inline code elements specifically
            code: {
              // Reset potential default styles if needed, though usually handled by prose
            },
            // Explicitly remove content from pseudo-elements for inline code
            'code::before': {
              content: 'none', // Remove backtick before
            },
            'code::after': {
              content: 'none', // Remove backtick after
            },
            // Ensure block code (pre code) is not affected if it had different defaults
            'pre code::before': null, // Use null to potentially revert to any other defaults if needed
            'pre code::after': null,
          },
        },
      }),

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
      scale: {
        200: '2',
      },
      animation: {
        bounce: 'bounce 1s infinite',
        'rotate-180-once': 'rotate-180-once 0.5s ease-in-out',
      },
      keyframes: {
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'rotate-180-once': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(180deg)' },
        },
      },
    },
  },
  plugins: [
    containerQueries,
    require('@tailwindcss/typography'),
    // Original theme-aware utility classes
    function ({ addUtilities }) {
      // Define theme-aware utility classes
      const themeUtilities = {
        // Light theme (default)
        '.bg-theme-surface': { backgroundColor: '#FFFFFF' },
        '.bg-theme-primary': { backgroundColor: '#FAFBFC' },
        '.bg-theme-secondary': { backgroundColor: '#F1F3F4' },
        '.bg-theme-hover': { backgroundColor: '#F2F2F2' },
        '.bg-theme-active': { backgroundColor: 'rgba(255, 123, 0, 0.05)' },
        
        '.text-theme-primary': { color: '#333333' },
        '.text-theme-secondary': { color: '#666666' },
        
        '.border-theme': { borderColor: '#EEEEEE' },
        '.divide-theme': { divideColor: '#E0E0E0' },
        
        '.shadow-theme-light': { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' },
        '.shadow-theme-medium': { boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)' },
        
        '.dark .bg-theme-surface': { backgroundColor: '#1A1A1A' },
        '.dark .bg-theme-primary': { backgroundColor: '#232323' },
        '.dark .bg-theme-secondary': { backgroundColor: '#2D2D2D' },
        '.dark .bg-theme-hover': { backgroundColor: '#4A4A4A' },
        '.dark .bg-theme-active': { backgroundColor: 'rgba(255, 123, 0, 0.1)' },

        '.dark .text-theme-primary': { color: '#FFFFFF' },
        '.dark .text-theme-secondary': { color: '#B0B0B0' },

        '.dark .border-theme': { borderColor: '#404040' },
        '.dark .divide-theme': { divideColor: '#3D3D3D' },

        '.dark .shadow-theme-light': {
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        },
        '.dark .shadow-theme-medium': {
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
        },
      };

      addUtilities(themeUtilities);
    },

    // New custom group variants for code block hover states
    function ({ addVariant, e }) {
      // Add custom group variants for code blocks and message containers
      addVariant('code-block-group-hover', ({ modifySelectors, separator }) => {
        modifySelectors(({ className }) => {
          return `.code-block-group:hover .${e(`code-block-group-hover${separator}${className}`)}`;
        });
      });

      addVariant('message-group-hover', ({ modifySelectors, separator }) => {
        modifySelectors(({ className }) => {
          return `.message-group:hover .${e(`message-group-hover${separator}${className}`)}`;
        });
      });
    },
  ],
};

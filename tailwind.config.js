module.exports = {
  content: [
    "./src/**/*.{js,jsx}",
    "./popup.html",
    "./settings.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF7B00',
          hover: '#E06E00',
          secondary: '#FF9D45',
        },
        background: {
          primary: 'var(--bg-primary)',
          surface: 'var(--bg-surface)',
          hover: 'var(--bg-surface-hover)',
          active: 'var(--bg-surface-active)',
        },
        border: 'var(--border-color)',
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        error: 'var(--error-color)',
        success: 'var(--success-color)',
        warning: 'var(--warning-color)',
      },
      boxShadow: {
        light: 'var(--shadow-light)',
        medium: 'var(--shadow-medium)',
      },
      transitionProperty: {
        fast: 'var(--transition-fast)',
        medium: 'var(--transition-medium)',
      },
    },
  },
  plugins: [],
}
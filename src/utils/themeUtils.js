// src/utils/themeUtils.js

/**
 * Theme utility functions for consistent theme management
 */

// Constants
export const THEME_STORAGE_KEY = 'ui_preferences.theme';
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

/**
 * Apply theme to document
 * @param {string} theme - The theme to apply ('light' or 'dark')
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Get system preference for dark mode
 * @returns {boolean} True if system prefers dark mode
 */
export function getSystemThemePreference() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
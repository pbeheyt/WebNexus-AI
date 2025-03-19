// src/services/ThemeService.js
import { THEMES } from '../utils/themeUtils';

/**
 * Service for managing theme settings
 */
class ThemeService {
  constructor() {
    this.themeStorageKey = 'ui_preferences.theme';
    this.initialized = false;
  }

  /**
   * Initialize theme service
   * @returns {Promise<string>} Current theme
   */
  async initialize() {
    if (this.initialized) {
      return this.getCurrentTheme();
    }

    try {
      // Load from storage
      const result = await chrome.storage.sync.get(this.themeStorageKey);
      let theme = result[this.themeStorageKey];

      // If no theme is saved or it's invalid, use system preference
      if (!theme || (theme !== THEMES.LIGHT && theme !== THEMES.DARK)) {
        theme = this.getSystemPreference();
        // Save the detected preference
        await this.saveTheme(theme);
      }

      // Apply theme to document
      this.applyTheme(theme);
      this.initialized = true;
      return theme;
    } catch (error) {
      console.error('Theme service initialization error:', error);
      // Fallback to light theme
      this.applyTheme(THEMES.LIGHT);
      return THEMES.LIGHT;
    }
  }

  /**
   * Get system preference for dark mode
   * @returns {string} Theme based on system preference
   */
  getSystemPreference() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? THEMES.DARK : THEMES.LIGHT;
  }

  /**
   * Apply theme to document
   * @param {string} theme - Theme to apply
   */
  applyTheme(theme) {
    if (theme === THEMES.DARK) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  /**
   * Save theme preference
   * @param {string} theme - Theme to save
   * @returns {Promise<void>}
   */
  async saveTheme(theme) {
    try {
      await chrome.storage.sync.set({ [this.themeStorageKey]: theme });
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  }

  /**
   * Get current theme
   * @returns {string} Current theme
   */
  getCurrentTheme() {
    return document.documentElement.classList.contains('dark') ? THEMES.DARK : THEMES.LIGHT;
  }

  /**
   * Toggle between light and dark themes
   * @returns {Promise<string>} New theme
   */
  async toggleTheme() {
    const currentTheme = this.getCurrentTheme();
    const newTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    
    this.applyTheme(newTheme);
    await this.saveTheme(newTheme);
    
    return newTheme;
  }
}

export default new ThemeService();
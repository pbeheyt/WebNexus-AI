// src/services/ThemeService.js
import { THEME_STORAGE_KEY, THEMES, applyTheme, getSystemThemePreference } from '../utils/themeUtils';

/**
 * Service for managing theme across extension contexts
 */
class ThemeService {
  constructor() {
    this.initialized = false;
    this.currentTheme = null;
  }

  /**
   * Initialize the theme service
   * @returns {Promise<string>} The current theme
   */
  async initialize() {
    if (this.initialized) {
      return this.currentTheme;
    }

    // Get theme from storage or system preference
    const { [THEME_STORAGE_KEY]: storedTheme } = await chrome.storage.sync.get(THEME_STORAGE_KEY);
    
    this.currentTheme = storedTheme || 
      (getSystemThemePreference() ? THEMES.DARK : THEMES.LIGHT);
    
    // Apply theme to document
    applyTheme(this.currentTheme);
    
    // Set up storage change listener
    chrome.storage.onChanged.addListener(this._handleStorageChange.bind(this));
    
    this.initialized = true;
    return this.currentTheme;
  }

  /**
   * Get the current theme
   * @returns {Promise<string>} The current theme
   */
  async getTheme() {
    if (!this.initialized) {
      return this.initialize();
    }
    return this.currentTheme;
  }

  /**
   * Set the current theme
   * @param {string} theme - The theme to set ('light' or 'dark')
   * @returns {Promise<void>}
   */
  async setTheme(theme) {
    if (!Object.values(THEMES).includes(theme)) {
      throw new Error(`Invalid theme: ${theme}`);
    }

    if (!this.initialized) {
      await this.initialize();
    }

    // Only update if changed
    if (this.currentTheme !== theme) {
      this.currentTheme = theme;
      
      // Save to storage (this will trigger update in other contexts)
      await chrome.storage.sync.set({ [THEME_STORAGE_KEY]: theme });
      
      // Apply immediately in current context
      applyTheme(theme);
    }
  }

  /**
   * Toggle between light and dark themes
   * @returns {Promise<string>} The new theme
   */
  async toggleTheme() {
    const currentTheme = await this.getTheme();
    const newTheme = currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
    await this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * Handle storage changes
   * @private
   */
  _handleStorageChange(changes, namespace) {
    if (namespace === 'sync' && THEME_STORAGE_KEY in changes) {
      const newTheme = changes[THEME_STORAGE_KEY].newValue;
      if (newTheme !== this.currentTheme) {
        this.currentTheme = newTheme;
        applyTheme(newTheme);
      }
    }
  }
}

// Create and export singleton instance
const themeService = new ThemeService();
export default themeService;
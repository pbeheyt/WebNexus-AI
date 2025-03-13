// src/popup/services/ThemeService.js
export default class ThemeService {
  constructor(storageService) {
    this.storageService = storageService;
    this.THEME_KEY = 'theme_preference';
    this.THEMES = {
      DARK: 'dark',
      LIGHT: 'light'
    };
  }

  async getTheme() {
    const theme = await this.storageService.get(this.THEME_KEY);
    return theme || this.THEMES.DARK; // Default to dark theme
  }

  async setTheme(theme) {
    await this.storageService.set({ [this.THEME_KEY]: theme });
    return theme;
  }

  async toggleTheme() {
    const currentTheme = await this.getTheme();
    const newTheme = currentTheme === this.THEMES.DARK ? this.THEMES.LIGHT : this.THEMES.DARK;
    return this.setTheme(newTheme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
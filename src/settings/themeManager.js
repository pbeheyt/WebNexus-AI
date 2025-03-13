// src/settings/themeManager.js
import themeService from '../services/ThemeService';

export async function initializeTheme() {
  // Initialize theme service, which will set the theme from storage
  await themeService.initialize();
  // No toggle UI needed here - it automatically updates from storage events
}
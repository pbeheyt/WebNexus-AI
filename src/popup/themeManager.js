// src/popup/themeManager.js
import themeService from '../services/ThemeService';
import { THEMES } from '../utils/themeUtils';

export async function initializeTheme() {
  // Get theme toggle button
  const themeToggleBtn = document.querySelector('.theme-toggle-btn');
  if (!themeToggleBtn) return;
  
  // Initialize theme service
  const currentTheme = await themeService.initialize();
  
  // Update toggle button state
  updateToggleButtonState(themeToggleBtn, currentTheme);
  
  // Add click handler
  themeToggleBtn.addEventListener('click', async () => {
    const newTheme = await themeService.toggleTheme();
    updateToggleButtonState(themeToggleBtn, newTheme);
  });
}

function updateToggleButtonState(toggleButton, theme) {
  // Update button icon based on theme
  if (theme === THEMES.DARK) {
    toggleButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
    `; // Sun icon for when in dark mode
    toggleButton.title = 'Switch to Light Mode';
  } else {
    toggleButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21.21 12.79z"></path>
      </svg>
    `; // Moon icon for when in light mode
    toggleButton.title = 'Switch to Dark Mode';
  }
}
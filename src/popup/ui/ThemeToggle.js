// src/popup/ui/ThemeToggle.js
export default class ThemeToggle {
  constructor(element, themeService, statusManager) {
    this.element = element;
    this.themeService = themeService;
    this.statusManager = statusManager;
    this.currentTheme = 'dark'; // Default
  }

  async initialize() {
    try {
      // Get current theme
      this.currentTheme = await this.themeService.getTheme();
      
      // Apply theme to document
      this.themeService.applyTheme(this.currentTheme);
      
      // Render initial button state
      this.renderButton();
      
      // Add click event listener
      this.element.addEventListener('click', this.handleToggle.bind(this));
    } catch (error) {
      console.error('Error initializing theme toggle:', error);
    }
  }
  
  async handleToggle() {
    try {
      // Toggle theme
      this.currentTheme = await this.themeService.toggleTheme();
      
      // Apply theme to document
      this.themeService.applyTheme(this.currentTheme);
      
      // Update button appearance
      this.renderButton();
      
      // Show notification
      if (this.statusManager) {
        const themeName = this.currentTheme === 'dark' ? 'Dark' : 'Light';
        this.statusManager.updateStatus(`${themeName} theme applied`);
      }
    } catch (error) {
      console.error('Error toggling theme:', error);
    }
  }
  
  renderButton() {
    // Set button title based on current theme
    const nextThemeName = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.element.title = `Switch to ${nextThemeName} theme`;
    
    // Update button icon based on current theme
    this.element.innerHTML = this.currentTheme === 'dark' 
      ? `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
          <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" fill="currentColor"/>
          <path d="M12 3V5M12 19V21M21 12H19M5 12H3M18.364 5.636L16.95 7.05M7.05 16.95L5.636 18.364M18.364 18.364L16.95 16.95M7.05 7.05L5.636 5.636" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`
      : `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;
  }
}
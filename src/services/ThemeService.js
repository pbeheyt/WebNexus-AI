// src/services/ThemeService.js
class ThemeService {
  #theme = 'light';
  #observers = new Set();
  #storageKey = 'ui_preferences.theme';

  async initialize() {
    try {
      // Get theme from storage
      const result = await chrome.storage.sync.get(this.#storageKey);
      const savedTheme = result[this.#storageKey];
      
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        this.#theme = savedTheme;
      } else {
        // Default to system preference if no saved theme
        this.#theme = this.#getSystemPreference();
      }

      // Listen for storage changes from other contexts
      chrome.storage.onChanged.addListener(this.#handleStorageChange.bind(this));
      
      // Apply theme immediately
      this.applyTheme(this.#theme);
      
      return this.#theme;
    } catch (error) {
      console.error('Theme service initialization error:', error);
      return 'light'; // Default fallback
    }
  }

  async toggleTheme() {
    try {
      const newTheme = this.#theme === 'dark' ? 'light' : 'dark';
      this.#theme = newTheme;
      
      // Save to storage
      await chrome.storage.sync.set({ [this.#storageKey]: newTheme });
      
      // Apply theme
      this.applyTheme(newTheme);
      
      // Notify observers
      this.#notifyObservers();
      
      return newTheme;
    } catch (error) {
      console.error('Error toggling theme:', error);
      return this.#theme; // Return current theme on error
    }
  }

  getCurrentTheme() {
    return this.#theme;
  }

  subscribe(callback) {
    this.#observers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.#observers.delete(callback);
    };
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  #notifyObservers() {
    for (const callback of this.#observers) {
      try {
        callback(this.#theme);
      } catch (error) {
        console.error('Error in theme observer callback:', error);
      }
    }
  }

  #handleStorageChange(changes, namespace) {
    if (namespace === 'sync' && changes[this.#storageKey]) {
      const newValue = changes[this.#storageKey].newValue;
      
      if (newValue && newValue !== this.#theme) {
        this.#theme = newValue;
        this.applyTheme(this.#theme);
        this.#notifyObservers();
      }
    }
  }

  #getSystemPreference() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
}

// Export singleton instance
const themeService = new ThemeService();
export default themeService;
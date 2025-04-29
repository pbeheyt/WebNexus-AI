const { STORAGE_KEYS } = require('../shared/constants');
const logger = require('../shared/logger.js').service;

class UIService {
  #theme = 'light';
  #textSize = 'sm';
  #observers = new Set();
  #storageKey = STORAGE_KEYS.THEME_PREFERENCE;
  #textSizeStorageKey = STORAGE_KEYS.TEXT_SIZE_PREFERENCE;

  async initialize() {
    try {
      // Get preferences from storage
      const result = await chrome.storage.sync.get([
        this.#storageKey,
        this.#textSizeStorageKey,
      ]);
      const savedTheme = result[this.#storageKey];
      const savedTextSize = result[this.#textSizeStorageKey];

      // Set theme
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        this.#theme = savedTheme;
      } else {
        // Default to system preference if no saved theme
        this.#theme = this.#getSystemPreference();
      }

      // Set text size
      if (
        savedTextSize &&
        (savedTextSize === 'sm' ||
          savedTextSize === 'base' ||
          savedTextSize === 'lg')
      ) {
        this.#textSize = savedTextSize;
      } else {
        this.#textSize = 'sm'; // Default size
      }

      // Listen for storage changes from other contexts
      chrome.storage.onChanged.addListener(
        this.#handleStorageChange.bind(this)
      );

      // Apply preferences immediately
      this.applyTheme(this.#theme);
      this.applyTextSize(this.#textSize);

      return {
        theme: this.#theme,
        textSize: this.#textSize,
      };
    } catch (error) {
      logger.error('UI service initialization error:', error);
      return {
        theme: 'light',
        textSize: 'sm',
      };
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
      logger.error('Error toggling theme:', error);
      return this.#theme;
    }
  }

  async toggleTextSize() {
    try {
      let newTextSize;
      if (this.#textSize === 'sm') {
        newTextSize = 'base';
      } else if (this.#textSize === 'base') {
        newTextSize = 'lg';
      } else {
        newTextSize = 'sm';
      }
      this.#textSize = newTextSize;

      // Save to storage
      await chrome.storage.sync.set({
        [this.#textSizeStorageKey]: newTextSize,
      });

      // Apply text size
      this.applyTextSize(newTextSize);

      // Notify observers
      this.#notifyObservers();

      return newTextSize;
    } catch (error) {
      logger.error('Error toggling text size:', error);
      return this.#textSize;
    }
  }

  getCurrentTheme() {
    return this.#theme;
  }

  getCurrentTextSize() {
    return this.#textSize;
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

  applyTextSize(size) {
    document.documentElement.classList.remove(
      'text-sm',
      'text-base',
      'text-lg'
    );
    const sizeClass =
      size === 'base' ? 'text-base' : size === 'lg' ? 'text-lg' : 'text-sm';
    document.documentElement.classList.add(sizeClass);
  }

  #notifyObservers() {
    for (const callback of this.#observers) {
      try {
        callback({
          theme: this.#theme,
          textSize: this.#textSize,
        });
      } catch (error) {
        logger.error('Error in UI observer callback:', error);
      }
    }
  }

  #handleStorageChange(changes, namespace) {
    if (namespace === 'sync') {
      if (changes[this.#storageKey]) {
        const newTheme = changes[this.#storageKey].newValue;
        if (newTheme && newTheme !== this.#theme) {
          this.#theme = newTheme;
          this.applyTheme(this.#theme);
          this.#notifyObservers();
        }
      } else if (changes[this.#textSizeStorageKey]) {
        const newTextSize = changes[this.#textSizeStorageKey].newValue;
        if (newTextSize && newTextSize !== this.#textSize) {
          this.#textSize = newTextSize;
          this.applyTextSize(this.#textSize);
          this.#notifyObservers();
        }
      }
    }
  }

  #getSystemPreference() {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
}

// Export singleton instance
const uiService = new UIService();
module.exports = uiService;

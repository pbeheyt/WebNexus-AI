// src/settings/controllers/ShortcutsController.js
import { STORAGE_KEYS, DEFAULT_SHORTCUT_SETTINGS } from '../../shared/constants.js';

export default class ShortcutsController {
  constructor(storageService, eventBus, notificationManager) {
    this.storageService = storageService;
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
    this.settings = null;
    this.commands = [];
    this.lastSaveTimestamp = 0; // Track last save time
  }

  async initialize(container) {
    try {
      console.log('Initializing shortcuts controller');
      // Load settings
      await this.loadSettings();
      
      // Get initial commands
      try {
        this.commands = await this.getExtensionCommands();
      } catch (error) {
        console.error('Error fetching extension commands:', error);
        this.commands = []; // Set default empty array
      }
      
      console.log('Shortcuts controller initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing shortcuts controller:', error);
      this.notificationManager.error(`Error loading shortcut settings: ${error.message}`);
      // Initialize with default values to prevent rendering issues
      this.settings = this.getDefaultSettings();
      this.commands = [];
      return false;
    }
  }
  
  async loadSettings() {
    try {
      console.log('Loading shortcut settings');
      
      let result;
      try {
        result = await this.storageService.get(STORAGE_KEYS.SHORTCUT_SETTINGS);
      } catch (storageError) {
        console.error('Storage error when loading shortcut settings:', storageError);
        result = null;
      }
      
      // If no settings or storage error, use defaults
      if (!result) {
        this.settings = this.getDefaultSettings();
      } else {
        // Ensure all default settings exist by merging
        this.settings = {
          ...this.getDefaultSettings(),
          ...result
        };
      }
      
      console.log('Shortcut settings loaded:', this.settings);
      return this.settings;
    } catch (error) {
      console.error('Error loading shortcut settings:', error);
      this.settings = this.getDefaultSettings();
      throw error;
    }
  }
  
  getDefaultSettings() {
    // Define default settings here to ensure they always exist
    return {
      summarization_behavior: 'selection', // Default to respecting selection
    };
  }
  
  async updateSettings(newSettings) {
    try {
      console.log('Updating shortcut settings:', newSettings);
      
      // Debounce rapid saves (prevent saving more than once every 300ms)
      const now = Date.now();
      if (now - this.lastSaveTimestamp < 300) {
        console.log('Debouncing rapid setting update');
        return this.settings;
      }
      this.lastSaveTimestamp = now;
      
      // Get the latest settings first to avoid race conditions
      await this.loadSettings();
      
      // Merge with existing settings
      const updatedSettings = {
        ...this.settings,
        ...newSettings
      };
      
      // Save to storage
      await this.storageService.set({ [STORAGE_KEYS.SHORTCUT_SETTINGS]: updatedSettings });
      
      // Wait briefly to ensure storage is committed
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Update local copy
      this.settings = updatedSettings;
      
      // Publish event
      this.eventBus.publish('shortcuts:updated', this.settings);
      
      console.log('Shortcut settings updated successfully');
      return this.settings;
    } catch (error) {
      console.error('Error updating shortcut settings:', error);
      throw error;
    }
  }
  
  // Method to check if Chrome command exists
  async getExtensionCommands() {
    try {
      // Check if Chrome API is available
      if (typeof chrome !== 'undefined' && chrome.commands && chrome.commands.getAll) {
        console.log('Fetching extension commands from Chrome API');
        return await chrome.commands.getAll();
      } else {
        console.warn('Chrome commands API not available, using mock data');
        // Return mock data for testing or when API is unavailable
        return [
          { name: 'summarize-page', description: 'Summarize current page', shortcut: 'Not set' },
          { name: 'open-popup', description: 'Activate the extension', shortcut: 'Not set' }
        ];
      }
    } catch (error) {
      console.error('Error getting extension commands:', error);
      return [];
    }
  }
  
  // Open the Chrome keyboard shortcuts page
  openChromeShortcutsPage() {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      } else {
        console.error('Chrome API not available for creating tabs');
        this.notificationManager.error('Cannot access Chrome settings. Please go to chrome://extensions/shortcuts manually.');
      }
    } catch (error) {
      console.error('Error opening Chrome shortcuts page:', error);
      this.notificationManager.error('Error opening shortcuts page. Please go to chrome://extensions/shortcuts manually.');
    }
  }
  
  refresh() {
    console.log('Refreshing shortcuts controller');
    Promise.all([
      this.loadSettings(),
      this.getExtensionCommands()
    ]).then(([settings, commands]) => {
      this.commands = commands;
      this.eventBus.publish('shortcuts:refreshed', { settings, commands });
    }).catch(error => {
      console.error('Error refreshing shortcuts:', error);
    });
  }
}
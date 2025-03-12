import { CONTENT_TYPES } from '../utils/constants.js';

// Form for content type settings
export default class SettingsForm {
  constructor(settingsController, eventBus, notificationManager) {
    this.settingsController = settingsController;
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
    this.contentType = null;
    this.container = null;
    this.settings = {};
    
    // Subscribe to settings update events
    this.eventBus.subscribe('settings:updated', ({ contentType }) => {
      if (contentType === this.contentType) {
        this.loadSettings();
      }
    });
  }

  initialize(container, contentType) {
    this.container = container;
    this.contentType = contentType;
    this.loadSettings();
  }

  async loadSettings() {
    if (!this.contentType) return;
    
    try {
      this.settings = await this.settingsController.getSettings(this.contentType);
      this.render();
    } catch (error) {
      console.error('Error loading settings:', error);
      this.notificationManager.error(`Error loading settings: ${error.message}`);
    }
  }

  render() {
    if (!this.container || !this.contentType) return;
    
    // Only render for Reddit and YouTube
    if (this.contentType !== CONTENT_TYPES.REDDIT && this.contentType !== CONTENT_TYPES.YOUTUBE) {
      this.container.innerHTML = '';
      return;
    }
    
    // Create settings section
    const section = document.createElement('div');
    section.className = 'settings-section';
    
    const heading = document.createElement('h3');
    heading.className = 'type-heading';
    heading.textContent = 'Content Settings';
    
    const settingsForm = document.createElement('div');
    settingsForm.className = 'settings-form';
    
    // Create max comments input
    if (this.contentType === CONTENT_TYPES.REDDIT || this.contentType === CONTENT_TYPES.YOUTUBE) {
      const formGroup = document.createElement('div');
      formGroup.className = 'form-group';
      
      const label = document.createElement('label');
      label.htmlFor = 'max-comments';
      label.textContent = 'Maximum Comments to Extract:';
      
      const input = document.createElement('input');
      input.type = 'number';
      input.id = 'max-comments';
      input.className = 'settings-input';
      input.min = '1';
      input.max = '1000';
      input.value = this.settings.maxComments || 
                    (this.contentType === CONTENT_TYPES.REDDIT ? 200 : 50);
      
      const helpText = document.createElement('p');
      helpText.className = 'help-text';
      helpText.textContent = 'Set the maximum number of comments to extract. Higher values may increase processing time.';
      
      // Input change handler
      input.addEventListener('change', () => {
        this.handleSettingChange('maxComments', parseInt(input.value, 10));
      });
      
      formGroup.appendChild(label);
      formGroup.appendChild(input);
      formGroup.appendChild(helpText);
      
      settingsForm.appendChild(formGroup);
    }
    
    section.appendChild(heading);
    section.appendChild(settingsForm);
    
    // Replace existing settings if it exists
    const existingSettings = this.container.querySelector('.settings-section');
    if (existingSettings) {
      this.container.replaceChild(section, existingSettings);
    } else {
      this.container.innerHTML = '';
      this.container.appendChild(section);
    }
  }

  async handleSettingChange(key, value) {
    try {
      // Validate numeric inputs
      if (key === 'maxComments') {
        if (isNaN(value) || value < 1) value = 1;
        if (value > 1000) value = 1000;
      }
      
      // Update the settings
      await this.settingsController.updateSettings(this.contentType, { [key]: value });
      
      // Visual feedback
      const input = document.getElementById('max-comments');
      if (input) {
        input.classList.add('updated');
        setTimeout(() => {
          input.classList.remove('updated');
        }, 500);
      }
    } catch (error) {
      console.error('Error saving setting:', error);
      this.notificationManager.error(`Error saving setting: ${error.message}`);
    }
  }

  setContentType(contentType) {
    this.contentType = contentType;
    this.loadSettings();
  }
}
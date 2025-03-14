// src/settings/ui/SettingsForm.js
import { CONTENT_TYPES } from '../utils/constants.js';

export default class SettingsForm {
  constructor(settingsController, eventBus, notificationManager) {
    this.settingsController = settingsController;
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
    this.containers = {};
    this.settings = {};
    
    // Subscribe to settings update events
    this.eventBus.subscribe('settings:updated', this.handleSettingsUpdate.bind(this));
  }

  initialize() {
    // Get container elements for each content type
    this.containers = {
      [CONTENT_TYPES.GENERAL]: document.getElementById('general-settings-container'),
      [CONTENT_TYPES.REDDIT]: document.getElementById('reddit-settings-container'),
      [CONTENT_TYPES.YOUTUBE]: document.getElementById('youtube-settings-container')
    };
    
    // Load settings for each content type
    Object.values(CONTENT_TYPES).forEach(type => {
      this.loadSettings(type);
    });
  }

  handleSettingsUpdate({ contentType, settings }) {
    this.settings[contentType] = settings;
    this.renderSettings(contentType);
  }

  async loadSettings(contentType) {
    if (!this.containers[contentType]) return;
    
    try {
      const settings = await this.settingsController.getSettings(contentType);
      this.settings[contentType] = settings;
      this.renderSettings(contentType);
    } catch (error) {
      console.error(`Error loading settings for ${contentType}:`, error);
      this.notificationManager.error(`Error loading settings: ${error.message}`);
    }
  }

  renderSettings(contentType) {
    const container = this.containers[contentType];
    if (!container) return;
    
    // Create settings section
    const section = document.createElement('div');
    section.className = 'settings-section';
    
    const settingsForm = document.createElement('div');
    settingsForm.className = 'settings-form';
    
    // Add content type specific settings
    switch (contentType) {
      case CONTENT_TYPES.GENERAL:
        this.addGeneralSettings(settingsForm, contentType);
        break;
      case CONTENT_TYPES.REDDIT:
        this.addRedditSettings(settingsForm, contentType);
        break;
      case CONTENT_TYPES.YOUTUBE:
        this.addYoutubeSettings(settingsForm, contentType);
        break;
    }
    
    section.appendChild(settingsForm);
    
    // Replace existing settings if it exists
    const existingSettings = container.querySelector('.settings-section');
    if (existingSettings) {
      container.replaceChild(section, existingSettings);
    } else {
      container.innerHTML = '';
      container.appendChild(section);
    }
  }

  addGeneralSettings(form, contentType) {
    const helpText = document.createElement('p');
    helpText.textContent = 'General web content extraction has no configurable settings.';
    form.appendChild(helpText);
  }

  addRedditSettings(form, contentType) {
    this.addMaxCommentsInput(form, contentType, 'Number of comments to extract from Reddit posts');
  }

  addYoutubeSettings(form, contentType) {
    this.addMaxCommentsInput(form, contentType, 'Number of comments to extract from YouTube videos');
  }

  addMaxCommentsInput(form, contentType, helpText) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    
    const label = document.createElement('label');
    label.htmlFor = `max-comments-${contentType}`;
    label.textContent = 'Maximum Comments:';
    
    const input = document.createElement('input');
    input.type = 'number';
    input.id = `max-comments-${contentType}`;
    input.className = 'settings-input';
    input.min = '1';
    input.max = '1000';
    input.value = this.settings[contentType]?.maxComments || 
                  (contentType === CONTENT_TYPES.REDDIT ? 100 : 20);
    
    const help = document.createElement('p');
    help.className = 'help-text';
    help.textContent = helpText;
    
    // Input change handler
    input.addEventListener('change', () => {
      this.handleSettingChange(contentType, 'maxComments', parseInt(input.value, 10));
    });
    
    formGroup.appendChild(label);
    formGroup.appendChild(input);
    formGroup.appendChild(help);
    
    form.appendChild(formGroup);
  }

  async handleSettingChange(contentType, key, value) {
    try {
      // Validate numeric inputs
      if (key === 'maxComments') {
        if (isNaN(value) || value < 1) value = 1;
        if (value > 1000) value = 1000;
      }
      
      // Update the settings
      await this.settingsController.updateSettings(contentType, { [key]: value });
      
      // Visual feedback
      const input = document.getElementById(`max-comments-${contentType}`);
      if (input) {
        input.classList.add('updated');
        setTimeout(() => {
          input.classList.remove('updated');
        }, 500);
      }
      
      this.notificationManager.success(`Updated ${key} setting`);
    } catch (error) {
      console.error('Error saving setting:', error);
      this.notificationManager.error(`Error saving setting: ${error.message}`);
    }
  }
}
// src/settings/controllers/TemplateCustomizationController.js
import templateService from '../../services/TemplateService.js';
import configManager from '../../services/ConfigManager.js';
import TemplateCustomizationTab from '../ui/TemplateCustomizationTab.js';

export default class TemplateCustomizationController {
  constructor(eventBus, notificationManager) {
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
    this.tabComponent = null;
  }
  
  async initialize(container) {
    try {
      // Initialize config manager
      await configManager.initialize();
      
      // Create and initialize tab component
      this.tabComponent = new TemplateCustomizationTab(
        templateService,
        configManager,
        this.eventBus,
        this.notificationManager
      );
      
      this.tabComponent.initialize(container);
      
      return true;
    } catch (error) {
      console.error('Error initializing template customization:', error);
      this.notificationManager.error(`Error initializing template customization: ${error.message}`);
      return false;
    }
  }
}
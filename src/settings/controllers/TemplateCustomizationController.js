// src/settings/controllers/TemplateCustomizationController.js
import TemplateCustomizationTab from '../ui/TemplateCustomizationTab.js';

export default class TemplateCustomizationController {
  constructor(templateService, configManager, eventBus, notificationManager) {
    this.templateService = templateService;
    this.configManager = configManager;
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
    this.tabComponent = null;
  }
  
  async initialize(container) {
    try {
      // Create and initialize tab component
      this.tabComponent = new TemplateCustomizationTab(
        this.templateService,
        this.configManager,
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
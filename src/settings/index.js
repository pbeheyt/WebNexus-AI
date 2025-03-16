// src/settings/index.js
import EventBus from './utils/events.js';
import StorageService from './services/StorageService.js';
import ContentTypeService from './services/ContentTypeService.js';
import PromptService from './services/PromptService.js';
import NotificationManager from './ui/NotificationManager.js';
import TabManager from './ui/TabManager.js';
import PromptList from './ui/PromptList.js';
import PromptForm from './ui/PromptForm.js';
import PromptDetail from './ui/PromptDetail.js';
import SettingsForm from './ui/SettingsForm.js';
import PromptController from './controllers/PromptController.js';
import SettingsController from './controllers/SettingsController.js';
import TemplateCustomizationController from './controllers/TemplateCustomizationController.js';
import ConfigImportExportController from './controllers/ConfigImportExportController.js';
import MainController from './controllers/MainController.js';
import { initializeTheme } from './themeManager';
import configManager from '../services/ConfigManager';

// Initialize the settings page
document.addEventListener('DOMContentLoaded', async () => {
  await initializeTheme();
  
  // Initialize config manager first
  await configManager.initialize();

  // Create event bus
  const eventBus = new EventBus();
  
  // Initialize services
  const storageService = new StorageService();
  const contentTypeService = new ContentTypeService(storageService, eventBus);
  const promptService = new PromptService(storageService, eventBus);
  
  // Initialize UI components
  const notificationManager = new NotificationManager(
    document.getElementById('notification')
  );
  
  const tabManager = new TabManager(
    document.querySelector('.tab-nav'),
    eventBus
  );
  
  // Initialize controllers
  const promptController = new PromptController(
    promptService,
    notificationManager
  );
  
  const settingsController = new SettingsController(
    contentTypeService,
    notificationManager
  );
  
  // Initialize template customization controller with new architecture
  const templateCustomizationController = new TemplateCustomizationController(
    eventBus,
    notificationManager
  );
  
  // Initialize config import/export controller
  const configImportExportController = new ConfigImportExportController(
    notificationManager
  );
  
  // Initialize UI with controllers
  const promptList = new PromptList(
    promptController,
    eventBus
  );
  
  const promptForm = new PromptForm(
    promptController,
    eventBus,
    notificationManager
  );
  
  const promptDetail = new PromptDetail(
    promptController,
    eventBus,
    notificationManager
  );
  
  const settingsForm = new SettingsForm(
    settingsController,
    eventBus,
    notificationManager
  );
  
  // Initialize main controller
  const mainController = new MainController(
    tabManager,
    promptList,
    promptForm,
    promptDetail,
    settingsForm,
    templateCustomizationController,
    promptService,
    contentTypeService,
    notificationManager,
    eventBus
  );
  
  // Initialize config import/export
  const importExportContainer = document.getElementById('config-import-export');
  if (importExportContainer) {
    configImportExportController.initialize(importExportContainer);
  }
  
  // Start the application
  mainController.initialize().catch(error => {
    console.error('Application initialization error:', error);
    notificationManager.error(`Failed to initialize application: ${error.message}`);
  });
});
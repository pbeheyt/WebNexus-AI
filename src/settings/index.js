// src/settings/index.js
import EventBus from './utils/events.js';
import StorageService from './services/StorageService.js';
import ConfigService from './services/ConfigService.js';
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
import ConfigImportExportController from './controllers/ConfigImportExportController.js';  // Import new controller
import MainController from './controllers/MainController.js';
import { initializeTheme } from './themeManager';

// Initialize the settings page
document.addEventListener('DOMContentLoaded', async () => {
  await initializeTheme();

  // Create event bus
  const eventBus = new EventBus();
  
  // Initialize services
  const storageService = new StorageService();
  const configService = new ConfigService(storageService);
  const contentTypeService = new ContentTypeService(storageService, eventBus);
  const promptService = new PromptService(storageService, configService, eventBus);
  
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
  
  // Initialize new controller for import/export
  const configImportExportController = new ConfigImportExportController(
    configService,
    storageService,
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
    configImportExportController,  // Add the new controller
    promptService,
    contentTypeService,
    notificationManager,
    eventBus
  );
  
  // Start the application
  mainController.initialize().catch(error => {
    console.error('Application initialization error:', error);
    notificationManager.error(`Failed to initialize application: ${error.message}`);
  });
});
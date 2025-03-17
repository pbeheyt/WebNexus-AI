// src/settings/index.js
import EventBus from './utils/events.js';
import StorageService from './services/StorageService.js';
import NotificationManager from './ui/NotificationManager.js';
import TabManager from './ui/TabManager.js';
import PromptList from './ui/PromptList.js';
import PromptForm from './ui/PromptForm.js';
import PromptDetail from './ui/PromptDetail.js';
import SettingsForm from './ui/SettingsForm.js';
import PromptController from './controllers/PromptController.js';
import SettingsController from './controllers/SettingsController.js';
import TemplateCustomizationController from './controllers/TemplateCustomizationController.js';
import ShortcutsController from './controllers/ShortcutsController.js';
import ShortcutsTab from './ui/ShortcutsTab.js';
import MainController from './controllers/MainController.js';
import { initializeTheme } from './themeManager.js';
import configManager from '../services/ConfigManager.js';
import templateService from '../services/TemplateService.js';

// Initialize the settings page
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize theme and global services
  await initializeTheme();
  await configManager.initialize();
  
  // Create event bus and core services
  const eventBus = new EventBus();
  const storageService = new StorageService();
  
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
    storageService,
    configManager,
    eventBus,
    notificationManager
  );
  
  const settingsController = new SettingsController(
    storageService,
    configManager,
    notificationManager
  );
  
  // Initialize template customization controller
  const templateCustomizationController = new TemplateCustomizationController(
    templateService,
    configManager,
    eventBus,
    notificationManager
  );
  
  // Initialize shortcuts controller
  const shortcutsController = new ShortcutsController(
    storageService,
    eventBus,
    notificationManager
  );
  
  // Initialize UI components
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
  
  const shortcutsTab = new ShortcutsTab(
    shortcutsController,
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
    shortcutsController,
    promptController,
    settingsController,
    notificationManager,
    eventBus
  );
  
  // Start the application
  mainController.initialize().catch(error => {
    console.error('Application initialization error:', error);
    notificationManager.error(`Failed to initialize application: ${error.message}`);
  });
  
  // Initialize shortcuts tab
  const shortcutsContainer = document.getElementById('shortcuts');
  if (shortcutsContainer) {
    shortcutsTab.initialize(shortcutsContainer);
  }
});
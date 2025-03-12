import EventBus from './utils/events.js';
import StorageService from './services/StorageService.js';
import ConfigService from './services/ConfigService.js';
import ContentTypeService from './services/ContentTypeService.js';
import PromptService from './services/PromptService.js';
import NotificationManager from './ui/NotificationManager.js';
import TabManager from './ui/TabManager.js';
import PromptList from './ui/PromptList.js';
import PromptForm from './ui/PromptForm.js';
import SettingsForm from './ui/SettingsForm.js';
import PromptController from './controllers/PromptController.js';
import SettingsController from './controllers/SettingsController.js';
import MainController from './controllers/MainController.js';

// Initialize the settings page
document.addEventListener('DOMContentLoaded', () => {
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
    document.getElementById('all-prompts'),
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
    settingsForm,
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
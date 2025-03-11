// popup/index.js
import StorageService from './services/StorageService.js';
import TabService from './services/TabService.js';
import ContentService from './services/ContentService.js';
import PlatformService from './services/PlatformService.js';
import PromptService from './services/PromptService.js';
import ContentTypeView from './ui/ContentTypeView.js';
import PlatformSelector from './ui/PlatformSelector.js';
import PromptSelector from './ui/PromptSelector.js';
import StatusManager from './ui/StatusManager.js';
import SummarizeController from './controllers/SummarizeController.js';
import MainController from './controllers/MainController.js';

document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const contentTypeDisplay = document.getElementById('contentTypeDisplay');
  const promptTypeSelect = document.getElementById('promptType');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const statusMessage = document.getElementById('statusMessage');
  const settingsBtn = document.getElementById('settingsBtn');
  const platformOptions = document.getElementById('platformOptions');
  
  // Initialize services
  const storageService = new StorageService();
  const tabService = new TabService();
  const contentService = new ContentService(tabService);
  const platformService = new PlatformService(storageService);
  const promptService = new PromptService(storageService);
  
  // Initialize UI components
  const contentTypeView = new ContentTypeView(contentTypeDisplay);
  const statusManager = new StatusManager(statusMessage, summarizeBtn);
  
  const platformSelector = new PlatformSelector(
    platformOptions, 
    (platformId) => mainController.handlePlatformChange(platformId)
  );
  
  const promptSelector = new PromptSelector(
    promptTypeSelect,
    (promptId) => mainController.handlePromptChange(promptId)
  );
  
  // Initialize controllers
  const summarizeController = new SummarizeController(
    contentService,
    promptService,
    storageService
  );
  
  const mainController = new MainController(
    tabService,
    contentService,
    platformService,
    promptService,
    summarizeController,
    statusManager,
    contentTypeView,
    platformSelector,
    promptSelector
  );
  
  // Set up event listeners
  summarizeBtn.addEventListener('click', () => mainController.handleSummarize());
  settingsBtn.addEventListener('click', () => mainController.openSettings());
  
  // Initialize the application
  mainController.initialize();
});
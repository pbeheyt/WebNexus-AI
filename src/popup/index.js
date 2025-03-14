// popup/index.js
import StorageService from './services/StorageService.js';
import ConfigService from './services/ConfigService.js';
import TabService from './services/TabService.js';
import ContentService from './services/ContentService.js';
import PlatformService from './services/PlatformService.js';
import DefaultPromptPreferencesService from './services/DefaultPromptPreferencesService.js';
import PreferenceService from './services/PreferenceService.js';
import PromptService from './services/PromptService.js';
import ContentTypeView from './ui/ContentTypeView.js';
import PlatformSelector from './ui/PlatformSelector.js';
import PromptTypeToggle from './ui/PromptTypeToggle.js';
import CustomPromptSelector from './ui/CustomPromptSelector.js';
import DefaultPromptConfigPanel from './ui/DefaultPromptConfigPanel.js';
import StatusManager from './ui/StatusManager.js';
import SummarizeController from './controllers/SummarizeController.js';
import MainController from './controllers/MainController.js';
import { initializeTheme } from './themeManager';

document.addEventListener('DOMContentLoaded', async () => {
  await initializeTheme();

  // Get DOM elements
  const contentTypeDisplay = document.getElementById('contentTypeDisplay');
  const promptTypeToggleElement = document.getElementById('promptTypeToggle');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const statusMessage = document.getElementById('statusMessage');
  const settingsBtn = document.getElementById('settingsBtn');
  const platformOptions = document.getElementById('platformOptions');
  const toastElement = document.getElementById('toast');
  const defaultPromptConfigContainer = document.getElementById('defaultPromptConfig');
  const customPromptSelectorContainer = document.getElementById('customPromptSelector');

  // Initialize services
  const storageService = new StorageService();
  const configService = new ConfigService();
  const tabService = new TabService();
  const contentService = new ContentService(tabService);
  const platformService = new PlatformService(storageService);
  const defaultPromptPreferencesService = new DefaultPromptPreferencesService(storageService, configService);
  const preferenceService = new PreferenceService(storageService);
  const promptService = new PromptService(storageService, configService, defaultPromptPreferencesService);

  // Initialize UI components
  const contentTypeView = new ContentTypeView(contentTypeDisplay);
  const statusManager = new StatusManager(statusMessage, summarizeBtn, toastElement);

  const platformSelector = new PlatformSelector(
    platformOptions,
    (platformId) => mainController.handlePlatformChange(platformId)
  );

  const promptTypeToggle = new PromptTypeToggle(
    promptTypeToggleElement,
    (isDefault) => mainController.handlePromptTypeToggle(isDefault),
    preferenceService,
    statusManager
  );

  const customPromptSelector = new CustomPromptSelector(
    customPromptSelectorContainer,
    promptService,
    (promptId) => mainController.handlePromptChange(promptId),
    preferenceService,
    statusManager
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
    defaultPromptPreferencesService,
    preferenceService,
    summarizeController,
    statusManager,
    contentTypeView,
    platformSelector,
    promptTypeToggle,
    customPromptSelector,
    DefaultPromptConfigPanel
  );

  // Set up event listeners
  summarizeBtn.addEventListener('click', () => mainController.handleSummarize());
  settingsBtn.addEventListener('click', () => mainController.openSettings());

  // Set up message listener for YouTube comments notification
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'youtubeCommentsNotLoaded') {
      statusManager.notifyCommentsNotLoaded();
    }
  });

  // Check if there's a pending YouTube comments notification
  const { youtubeCommentsNotLoaded } = await storageService.get('youtubeCommentsNotLoaded', 'local') || {};

  if (youtubeCommentsNotLoaded) {
    // Show notification
    statusManager.notifyCommentsNotLoaded();

    // Clear notification state
    await storageService.set({ youtubeCommentsNotLoaded: false }, 'local');
  }

  // Initialize the application
  mainController.initialize();

  // Add transition classes after small delay to prevent initial animations
  setTimeout(() => {
    document.body.classList.add('transitions-enabled');
  }, 100);
});

// src/popup/index.js
import StorageService from './services/StorageService.js';
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
import QuickPromptEditor from './ui/QuickPromptEditor.js';
import StatusManager from './ui/StatusManager.js';
import SummarizeController from './controllers/SummarizeController.js';
import MainController from './controllers/MainController.js';
import { initializeTheme } from './themeManager';
import configManager from '../services/ConfigManager.js';
import promptBuilder from '../services/PromptBuilder.js';

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
  const quickPromptEditorContainer = document.getElementById('quickPromptEditor');

  // Initialize services
  const storageService = new StorageService();
  const tabService = new TabService();
  const contentService = new ContentService(tabService);
  const platformService = new PlatformService(storageService);
  
  // Initialize configManager early
  await configManager.initialize();

  const defaultPromptPreferencesService = new DefaultPromptPreferencesService(
    storageService,
    promptBuilder
  );
  
  const preferenceService = new PreferenceService(storageService);
  
  const promptService = new PromptService(
    storageService, 
    configManager,
    defaultPromptPreferencesService
  );

  // Initialize UI components
  const contentTypeView = new ContentTypeView(contentTypeDisplay);
  const statusManager = new StatusManager(statusMessage, summarizeBtn, toastElement);

  const platformSelector = new PlatformSelector(
    platformOptions,
    (platformId) => mainController.handlePlatformChange(platformId)
  );

  const promptTypeToggle = new PromptTypeToggle(
    promptTypeToggleElement,
    (promptType) => mainController.handlePromptTypeToggle(promptType),
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
  
  const quickPromptEditor = new QuickPromptEditor(
    quickPromptEditorContainer,
    (text) => mainController.handleQuickPromptChange(text),
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
    DefaultPromptConfigPanel,
    quickPromptEditor
  );

  // Subscribe to config changes
  const unsubscribeFromConfig = configManager.subscribe(() => {
    if (mainController && typeof mainController.refreshConfiguration === 'function') {
      mainController.refreshConfiguration();
    }
  });

  // Set up event listeners
  summarizeBtn.addEventListener('click', () => mainController.handleSummarize());
  
  // Add keyboard shortcut (Enter key) for summarize action
  document.addEventListener('keydown', (event) => {
    // Only handle Enter key presses
    if (event.key === 'Enter') {
      // Handle textarea behavior specifically
      if (document.activeElement.tagName === 'TEXTAREA') {
        // If Shift+Enter, allow default behavior (new line)
        if (event.shiftKey) {
          return;
        }
        
        // If just Enter, prevent default and trigger summarize
        event.preventDefault();
        
        // Check if the summarize button is enabled
        if (!summarizeBtn.disabled) {
          mainController.handleSummarize();
        }
        return;
      }
      
      // Don't interfere with regular input fields
      if (document.activeElement.tagName === 'INPUT' && 
          document.activeElement.type !== 'radio' && 
          document.activeElement.type !== 'checkbox') {
        return;
      }
      
      // For any other element, prevent default and trigger summarize
      event.preventDefault();
      if (!summarizeBtn.disabled) {
        mainController.handleSummarize();
      }
    }
  });
  
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

  // Clean up on unload
  window.addEventListener('unload', () => {
    if (unsubscribeFromConfig) {
      unsubscribeFromConfig();
    }
    
    if (mainController.selectionCheckInterval) {
      clearInterval(mainController.selectionCheckInterval);
    }
  });
});
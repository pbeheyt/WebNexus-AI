// src/settings/controllers/MainController.js
import { TABS } from '../utils/constants.js';

export default class MainController {
  constructor(
    tabManager,
    promptList,
    promptForm,
    promptDetail,
    settingsForm,
    configImportExportController,  // Added new controller
    promptService,
    contentTypeService,
    notificationManager,
    eventBus
  ) {
    this.tabManager = tabManager;
    this.promptList = promptList;
    this.promptForm = promptForm;
    this.promptDetail = promptDetail;
    this.settingsForm = settingsForm;
    this.configImportExportController = configImportExportController;  // Added new controller
    this.promptService = promptService;
    this.contentTypeService = contentTypeService;
    this.notificationManager = notificationManager;
    this.eventBus = eventBus;
    
    // Subscribe to tab changes
    this.eventBus.subscribe('tab:changed', this.handleTabChange.bind(this));
  }

  async initialize() {
    try {
      // Check for and migrate legacy data first
      await this.promptService.migrateFromLegacyFormat();
      
      // Initialize components
      this.tabManager.initialize();
      this.promptList.initialize();
      this.promptForm.initialize();
      this.promptDetail.initialize();
      this.settingsForm.initialize();
      
      // Initialize import/export controller
      const importExportContainer = document.getElementById('import-export-container');
      if (importExportContainer) {
        this.configImportExportController.initialize(importExportContainer);
      }
      
      // Set up back button
      document.getElementById('backBtn')?.addEventListener('click', () => {
        window.close();
      });
    } catch (error) {
      this.notificationManager.error(`Error initializing settings: ${error.message}`);
    }
  }

  handleTabChange(tabId) {
    // We can react to tab changes here if needed
    // console.log(`Tab changed to: ${tabId}`);
  }
}
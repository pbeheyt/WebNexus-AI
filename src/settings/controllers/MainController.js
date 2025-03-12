import { CONTENT_TYPES } from '../utils/constants.js';

// Main application controller
export default class MainController {
  constructor(
    tabManager,
    promptList,
    promptForm,
    settingsForm,
    promptService,
    contentTypeService,
    notificationManager,
    eventBus
  ) {
    this.tabManager = tabManager;
    this.promptList = promptList;
    this.promptForm = promptForm;
    this.settingsForm = settingsForm;
    this.promptService = promptService;
    this.contentTypeService = contentTypeService;
    this.notificationManager = notificationManager;
    this.eventBus = eventBus;
    
    // Subscribe to tab changes
    this.eventBus.subscribe('tab:changed', (contentType) => {
      this.handleTabChange(contentType);
    });
  }

  async initialize() {
    try {
      // Initialize tab manager
      this.tabManager.initialize();
      
      // Check for and migrate legacy data
      await this.promptService.migrateFromLegacyFormat();
      
      // Initialize components for default tab
      this.handleTabChange(CONTENT_TYPES.GENERAL);
      
      // Set up back button
      document.getElementById('backBtn')?.addEventListener('click', () => {
        window.close();
      });
    } catch (error) {
      console.error('Initialization error:', error);
      this.notificationManager.error(`Error initializing settings: ${error.message}`);
    }
  }

  handleTabChange(contentType) {
    // Get tab content container
    const tabContent = this.tabManager.getTabContent(contentType);
    
    if (!tabContent) return;
    
    // Clear tab content
    tabContent.innerHTML = '';
    
    // Create content structure
    const settingsContainer = document.createElement('div');
    settingsContainer.className = 'settings-container';
    
    const promptsContainer = document.createElement('div');
    promptsContainer.className = 'prompts-container';
    
    const formContainer = document.createElement('div');
    formContainer.className = 'form-container';
    
    // Add dividers
    const divider1 = document.createElement('hr');
    divider1.className = 'settings-divider';
    
    const divider2 = document.createElement('hr');
    divider2.className = 'settings-divider';
    
    // Assemble content
    tabContent.appendChild(settingsContainer);
    tabContent.appendChild(divider1);
    tabContent.appendChild(promptsContainer);
    tabContent.appendChild(divider2);
    tabContent.appendChild(formContainer);
    
    // Initialize components for this tab
    this.settingsForm.initialize(settingsContainer, contentType);
    this.promptList.initialize(promptsContainer, contentType);
    this.promptForm.initialize(formContainer, contentType);
  }
}
// Main application controller with optimized tab content management
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
    this.initializedTabs = new Set();
    
    // Subscribe to tab changes
    this.eventBus.subscribe('tab:changed', (contentType) => {
      this.handleTabChange(contentType);
    });
  }

  async initialize() {
    try {
      // Check for and migrate legacy data first
      await this.promptService.migrateFromLegacyFormat();
      
      // Initialize tab manager - this will trigger tab:changed event
      this.tabManager.initialize();
      
      // Set up back button
      document.getElementById('backBtn')?.addEventListener('click', () => {
        window.close();
      });
    } catch (error) {
      this.notificationManager.error(`Error initializing settings: ${error.message}`);
    }
  }

  handleTabChange(contentType) {
    // Don't reinitialize tabs that have already been set up
    if (this.initializedTabs.has(contentType)) {
      return;
    }
    
    // Get tab content container
    const tabContent = this.tabManager.getTabContent(contentType);
    
    if (!tabContent) {
      return;
    }
    
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
    
    // Mark this tab as initialized
    this.initializedTabs.add(contentType);
  }
}
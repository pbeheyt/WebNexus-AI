// src/popup/controllers/MainController.js
export default class MainController {
  constructor(
    tabService,
    contentService,
    platformService,
    promptService,
    defaultPromptPreferencesService,
    summarizeController,
    statusManager,
    contentTypeView,
    platformSelector,
    promptTypeToggle,
    customPromptSelector,
    defaultPromptConfigPanel
  ) {
    this.tabService = tabService;
    this.contentService = contentService;
    this.platformService = platformService;
    this.promptService = promptService;
    this.defaultPromptPreferencesService = defaultPromptPreferencesService;
    this.summarizeController = summarizeController;
    this.statusManager = statusManager;
    this.contentTypeView = contentTypeView;
    this.platformSelector = platformSelector;
    this.promptTypeToggle = promptTypeToggle;
    this.customPromptSelector = customPromptSelector;
    this.defaultPromptConfigPanel = defaultPromptConfigPanel;
    
    // Application state
    this.state = {
      currentTab: null,
      contentType: null,
      isSupported: false,
      platforms: [],
      selectedPlatformId: null,
      selectedPromptId: null,
      isProcessing: false,
      isDefaultPromptType: true
    };
    
    // Preloaded data repository
    this.dataRepository = {
      platforms: null,
      defaultPrompts: null,
      customPrompts: null,
      defaultPromptPreferences: null,
      defaultPromptParameters: null
    };
  }

  async initialize() {
    try {
      this.statusManager.updateStatus('Loading extension data...', true);
      
      // Get current tab info
      this.state.currentTab = await this.tabService.getCurrentTab();
      
      if (!this.state.currentTab || !this.state.currentTab.url) {
        this.statusManager.updateStatus('Cannot access current tab', false, false);
        return;
      }
      
      // Detect content type
      this.state.contentType = this.contentService.detectContentType(this.state.currentTab.url);
      this.state.isSupported = true;
      
      // Update content type display
      this.contentTypeView.update(this.state.contentType);
      
      // PRELOADING PHASE: Load all required data in parallel
      const [
        platformData,
        defaultAndCustomPrompts,
        defaultPromptPreferences,
        defaultPromptParameters
      ] = await Promise.all([
        this.platformService.loadPlatforms(),
        this.promptService.loadPrompts(this.state.contentType),
        this.defaultPromptPreferencesService.getPreferences(this.state.contentType),
        this.defaultPromptPreferencesService.getParameterOptions(this.state.contentType)
      ]);
      
      // Store everything in memory repository
      this.dataRepository = {
        platforms: platformData.platforms,
        selectedPlatformId: platformData.preferredPlatformId,
        defaultPrompts: defaultAndCustomPrompts.prompts.filter(p => p.isDefault),
        customPrompts: defaultAndCustomPrompts.prompts.filter(p => !p.isDefault),
        preferredPromptId: defaultAndCustomPrompts.preferredPromptId,
        defaultPromptPreferences: defaultPromptPreferences,
        defaultPromptParameters: defaultPromptParameters
      };
      
      // Set initial state from repository
      this.state.platforms = this.dataRepository.platforms;
      this.state.selectedPlatformId = this.dataRepository.selectedPlatformId;
      this.state.selectedPromptId = this.dataRepository.preferredPromptId;
      this.state.isDefaultPromptType = this.dataRepository.preferredPromptId === this.state.contentType;
      
      // RENDERING PHASE: Initialize UI components with preloaded data
      
      // Render platform selector
      this.platformSelector.render(
        this.dataRepository.platforms, 
        this.dataRepository.selectedPlatformId
      );
      
      // Initialize prompt type toggle
      this.promptTypeToggle.initialize();
      this.promptTypeToggle.setType(this.state.isDefaultPromptType);
      
      // Pre-initialize both UI components with already loaded data
      await this.initializeDefaultPromptConfig();
      await this.initializeCustomPromptSelector();
      
      // Show the appropriate container based on initial state
      const defaultContainer = document.getElementById('defaultPromptConfig');
      const customContainer = document.getElementById('customPromptSelector');
      
      if (this.state.isDefaultPromptType) {
        defaultContainer.classList.remove('hidden');
        customContainer.classList.add('hidden');
      } else {
        defaultContainer.classList.add('hidden');
        customContainer.classList.remove('hidden');
      }
      
      // Update status
      this.statusManager.updateStatus('Ready to summarize.', false, this.state.isSupported);
    } catch (error) {
      console.error('Initialization error:', error);
      this.statusManager.updateStatus(`Error: ${error.message}`, false, false);
    }
  }

  async handlePlatformChange(platformId) {
    try {
      await this.platformService.setPreferredPlatform(platformId);
      this.state.selectedPlatformId = platformId;
      
      const platformName = this.state.platforms.find(p => p.id === platformId)?.name || platformId;
      this.statusManager.updateStatus(`Platform set to ${platformName}`);
    } catch (error) {
      console.error('Platform change error:', error);
      this.statusManager.updateStatus(`Error changing platform: ${error.message}`);
    }
  }

  async handlePromptChange(promptId) {
    this.state.selectedPromptId = promptId;
  }

  handlePromptTypeToggle(isDefault) {
    try {
      this.state.isDefaultPromptType = isDefault;
      
      // Since both containers are pre-initialized, just toggle visibility
      const defaultContainer = document.getElementById('defaultPromptConfig');
      const customContainer = document.getElementById('customPromptSelector');
      
      if (isDefault) {
        defaultContainer.classList.remove('hidden');
        customContainer.classList.add('hidden');
        
        // Use default prompt ID (content type)
        this.state.selectedPromptId = this.state.contentType;
      } else {
        defaultContainer.classList.add('hidden');
        customContainer.classList.remove('hidden');
        
        // Use first custom prompt ID if available
        if (this.dataRepository.customPrompts.length > 0) {
          this.state.selectedPromptId = this.dataRepository.customPrompts[0].id;
        }
      }
    } catch (error) {
      console.error('Error toggling prompt type:', error);
      this.statusManager.updateStatus(`Error: ${error.message}`);
    }
  }

  async initializeDefaultPromptConfig() {
    const configContainer = document.getElementById('defaultPromptConfig');
    if (!configContainer) return;
    
    try {
      // Create the config panel with preloaded data
      const configPanel = new this.defaultPromptConfigPanel(
        this.defaultPromptPreferencesService, 
        this.state.contentType,
        async () => {
          // When preferences change, update status
          this.statusManager.updateStatus('Default prompt preferences updated');
        }
      );
      
      // Pass preloaded data to the panel
      await configPanel.initializeWithData(
        configContainer,
        this.dataRepository.defaultPromptPreferences,
        this.dataRepository.defaultPromptParameters
      );
      
      // Set selected prompt ID to content type for default prompts
      if (this.state.isDefaultPromptType) {
        this.state.selectedPromptId = this.state.contentType;
      }
    } catch (error) {
      console.error('Error initializing default prompt config:', error);
      configContainer.classList.add('hidden');
    }
  }

  async initializeCustomPromptSelector() {
    try {
      // Initialize with preloaded data
      await this.customPromptSelector.initializeWithData(
        this.state.contentType,
        this.dataRepository.customPrompts,
        this.dataRepository.preferredPromptId
      );
    } catch (error) {
      console.error('Error initializing custom prompt selector:', error);
      this.statusManager.updateStatus(`Error: ${error.message}`);
    }
  }

  async handleSummarize() {
    if (this.state.isProcessing || !this.state.isSupported) return;
    
    this.state.isProcessing = true;
    
    await this.summarizeController.summarize(
      this.state.currentTab.id,
      this.state.contentType,
      this.state.currentTab.url,
      this.state.selectedPromptId,
      this.state.selectedPlatformId,
      (message, isProcessing = true) => {
        this.statusManager.updateStatus(message, isProcessing, this.state.isSupported);
        this.state.isProcessing = isProcessing;
      }
    );
  }

  openSettings() {
    try {
      chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error('Could not open options page:', error);
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    }
  }
}
// src/popup/controllers/MainController.js
export default class MainController {
  constructor(
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
    defaultPromptConfigPanel
  ) {
    this.tabService = tabService;
    this.contentService = contentService;
    this.platformService = platformService;
    this.promptService = promptService;
    this.defaultPromptPreferencesService = defaultPromptPreferencesService;
    this.preferenceService = preferenceService;
    this.summarizeController = summarizeController;
    this.statusManager = statusManager;
    this.contentTypeView = contentTypeView;
    this.platformSelector = platformSelector;
    this.promptTypeToggle = promptTypeToggle;
    this.customPromptSelector = customPromptSelector;
    this.defaultPromptConfigPanel = defaultPromptConfigPanel;
    
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
  }

  /**
   * Initialize the main controller
   */
  async initialize() {
    try {
      this.statusManager.updateStatus('Detecting page content...', true);
      
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
      
      // Load platforms
      const { platforms, preferredPlatformId } = await this.platformService.loadPlatforms();
      this.state.platforms = platforms;
      this.state.selectedPlatformId = preferredPlatformId;
      
      // Render platform selector
      this.platformSelector.render(platforms, preferredPlatformId);
      
      // Set content type for prompt toggle
      if (this.promptTypeToggle) {
        this.promptTypeToggle.setContentType(this.state.contentType);
      }
      
      // Load prompt type preference
      if (this.preferenceService) {
        try {
          const promptTypePreference = await this.preferenceService.getPromptTypePreference(this.state.contentType);
          this.state.isDefaultPromptType = promptTypePreference === 'default';
        } catch (error) {
          console.error('Error loading prompt type preference:', error);
        }
      }
      
      // Initialize prompt type toggle UI
      if (this.promptTypeToggle) {
        await this.promptTypeToggle.initialize();
        
        // Ensure toggle matches loaded preference
        this.promptTypeToggle.setType(this.state.isDefaultPromptType);
      }
      
      // Show/hide appropriate containers based on the prompt type
      const defaultContainer = document.getElementById('defaultPromptConfig');
      const customContainer = document.getElementById('customPromptSelector');
      
      if (defaultContainer && customContainer) {
        if (this.state.isDefaultPromptType) {
          defaultContainer.classList.remove('hidden');
          customContainer.classList.add('hidden');
        } else {
          defaultContainer.classList.add('hidden');
          customContainer.classList.remove('hidden');
        }
      }
      
      // Initialize appropriate prompt UI
      if (this.state.isDefaultPromptType) {
        await this.initializeDefaultPromptConfig();
      } else {
        await this.initializeCustomPromptSelector();
      }
      
      // Load previously selected prompt ID
      if (this.preferenceService) {
        try {
          const savedPromptId = await this.preferenceService.getSelectedPromptId(
            this.state.contentType,
            this.state.isDefaultPromptType
          );
          
          if (savedPromptId) {
            this.state.selectedPromptId = savedPromptId;
            
            // If using custom prompts, also update the selector UI
            if (!this.state.isDefaultPromptType && this.customPromptSelector) {
              await this.customPromptSelector.setSelectedPromptId(savedPromptId);
            }
          } else if (this.state.isDefaultPromptType) {
            // Default to content type as prompt ID for default type
            this.state.selectedPromptId = this.state.contentType;
          }
        } catch (error) {
          console.error('Error loading saved prompt ID:', error);
          if (this.state.isDefaultPromptType) {
            this.state.selectedPromptId = this.state.contentType;
          }
        }
      }
      
      // Update status
      this.statusManager.updateStatus('Ready to summarize.', false, this.state.isSupported);
    } catch (error) {
      console.error('Initialization error:', error);
      this.statusManager.updateStatus(`Error: ${error.message}`, false, false);
    }
  }

  /**
   * Handle platform change
   * @param {string} platformId - The platform ID
   */
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

  /**
   * Handle prompt change
   * @param {string} promptId - The prompt ID
   */
  async handlePromptChange(promptId) {
    const previousId = this.state.selectedPromptId;
    this.state.selectedPromptId = promptId;
    
    // Save selection if changed
    if (previousId !== promptId && this.preferenceService) {
      try {
        await this.preferenceService.saveSelectedPromptId(
          this.state.contentType,
          this.state.isDefaultPromptType,
          promptId
        );
      } catch (error) {
        console.error('Error saving prompt selection:', error);
      }
    }
  }

  /**
   * Handle prompt type toggle
   * @param {boolean} isDefault - Whether to use default (true) or custom (false) prompt
   */
  async handlePromptTypeToggle(isDefault) {
    try {
      // Only proceed if it's a change
      if (this.state.isDefaultPromptType !== isDefault) {
        this.state.isDefaultPromptType = isDefault;
        
        // Save preference
        if (this.preferenceService) {
          try {
            await this.preferenceService.savePromptTypePreference(this.state.contentType, isDefault);
          } catch (error) {
            console.error('Error saving prompt type preference:', error);
          }
        }
        
        // Show/hide appropriate containers
        const defaultContainer = document.getElementById('defaultPromptConfig');
        const customContainer = document.getElementById('customPromptSelector');
        
        if (isDefault) {
          defaultContainer.classList.remove('hidden');
          customContainer.classList.add('hidden');
          
          // Initialize default prompt config if needed
          await this.initializeDefaultPromptConfig();
          
          // Load appropriate prompt ID
          if (this.preferenceService) {
            try {
              const savedPromptId = await this.preferenceService.getSelectedPromptId(
                this.state.contentType, 
                true
              );
              
              if (savedPromptId) {
                this.state.selectedPromptId = savedPromptId;
              } else {
                // Default to content type as prompt ID
                this.state.selectedPromptId = this.state.contentType;
              }
            } catch (error) {
              console.error('Error loading saved prompt ID:', error);
              this.state.selectedPromptId = this.state.contentType;
            }
          } else {
            // Default to content type as prompt ID
            this.state.selectedPromptId = this.state.contentType;
          }
        } else {
          defaultContainer.classList.add('hidden');
          customContainer.classList.remove('hidden');
          
          // Initialize custom prompt selector if needed
          await this.initializeCustomPromptSelector();
          
          // Load appropriate prompt ID
          if (this.preferenceService) {
            try {
              const savedPromptId = await this.preferenceService.getSelectedPromptId(
                this.state.contentType, 
                false
              );
              
              if (savedPromptId) {
                this.state.selectedPromptId = savedPromptId;
                
                // Update custom prompt selector
                if (this.customPromptSelector) {
                  await this.customPromptSelector.setSelectedPromptId(savedPromptId);
                }
              }
            } catch (error) {
              console.error('Error loading saved prompt ID:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error toggling prompt type:', error);
      this.statusManager.updateStatus(`Error: ${error.message}`);
    }
  }

  /**
   * Initialize default prompt config panel
   */
  async initializeDefaultPromptConfig() {
    const configContainer = document.getElementById('defaultPromptConfig');
    if (!configContainer) return;
    
    try {
      // Create and initialize config panel
      const configPanel = new this.defaultPromptConfigPanel(
        this.defaultPromptPreferencesService, 
        this.state.contentType,
        async () => {
          // When preferences change, update status
          this.statusManager.updateStatus('Default prompt preferences updated');
        },
        this.statusManager
      );
      
      await configPanel.initialize(configContainer);
      
      // Set selected prompt ID to content type (default)
      this.state.selectedPromptId = this.state.contentType;
      
      // Save selection
      if (this.preferenceService) {
        try {
          await this.preferenceService.saveSelectedPromptId(
            this.state.contentType,
            true,
            this.state.selectedPromptId
          );
        } catch (error) {
          console.error('Error saving default prompt selection:', error);
        }
      }
    } catch (error) {
      console.error('Error initializing default prompt config:', error);
      configContainer.classList.add('hidden');
    }
  }

  /**
   * Initialize custom prompt selector
   */
  async initializeCustomPromptSelector() {
    try {
      await this.customPromptSelector.initialize(this.state.contentType);
    } catch (error) {
      console.error('Error initializing custom prompt selector:', error);
      this.statusManager.updateStatus(`Error: ${error.message}`);
    }
  }

  /**
   * Handle summarize action
   */
  async handleSummarize() {
    if (this.state.isProcessing || !this.state.isSupported) return;
    
    this.state.isProcessing = true;
    
    // Ensure clean state before summarizing
    try {
      await chrome.storage.local.set({ youtubeCommentsNotLoaded: false });
    } catch (error) {
      console.error('Error resetting comment notification state:', error);
    }
    
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

  /**
   * Open settings page
   */
  openSettings() {
    try {
      chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error('Could not open options page:', error);
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    }
  }
}
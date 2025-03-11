// popup/controllers/MainController.js
export default class MainController {
  constructor(
    tabService,
    contentService,
    platformService,
    promptService,
    summarizeController,
    statusManager,
    contentTypeView,
    platformSelector,
    promptSelector
  ) {
    this.tabService = tabService;
    this.contentService = contentService;
    this.platformService = platformService;
    this.promptService = promptService;
    this.summarizeController = summarizeController;
    this.statusManager = statusManager;
    this.contentTypeView = contentTypeView;
    this.platformSelector = platformSelector;
    this.promptSelector = promptSelector;
    
    this.state = {
      currentTab: null,
      contentType: null,
      isSupported: false,
      platforms: [],
      selectedPlatformId: null,
      selectedPromptId: null,
      isProcessing: false
    };
  }

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
      
      // Load prompts for this content type
      const { prompts, preferredPromptId } = await this.promptService.loadPrompts(this.state.contentType);
      this.state.selectedPromptId = preferredPromptId;
      
      // Render prompt selector
      this.promptSelector.render(prompts, preferredPromptId);
      
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
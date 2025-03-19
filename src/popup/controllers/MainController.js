// src/popup/controllers/MainController.js
import { PROMPT_TYPES, CONTENT_TYPES, SHARED_TYPE } from '../constants.js';

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
    defaultPromptConfigPanel,
    quickPromptEditor,
    apiModeToggle,
    modelSelector
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
    this.quickPromptEditor = quickPromptEditor;
    this.apiModeToggle = apiModeToggle;
    this.modelSelector = modelSelector;

    this.state = {
      currentTab: null,
      contentType: null,
      isSupported: false,
      platforms: [],
      selectedPlatformId: null,
      selectedPromptId: null,
      isProcessing: false,
      promptType: PROMPT_TYPES.DEFAULT,
      apiModeEnabled: false,
      selectedModelId: null,
      availableModels: []
    };

    this.selectionCheckInterval = null;
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

      // First detect content type based on URL pattern only (without checking for selection)
      this.state.contentType = this.contentService.getUrlContentType(this.state.currentTab.url);
      this.state.isSupported = true;

      // Update content type display initially
      this.contentTypeView.update(this.state.contentType);

      // Now check for text selection
      const hasSelection = await this.contentService.checkForTextSelection();
      if (hasSelection) {
        // If there's selected text, update content type and view
        this.state.contentType = CONTENT_TYPES.SELECTED_TEXT;
        this.contentTypeView.update(this.state.contentType);
      }

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
          this.state.promptType = promptTypePreference || PROMPT_TYPES.DEFAULT;
        } catch (error) {
          console.error('Error loading prompt type preference:', error);
        }
      }

      // Initialize prompt type toggle UI
      if (this.promptTypeToggle) {
        await this.promptTypeToggle.initialize();

        // Ensure toggle matches loaded preference
        this.promptTypeToggle.setType(this.state.promptType);
      }

      // Show/hide appropriate containers based on the prompt type
      const defaultContainer = document.getElementById('defaultPromptConfig');
      const customContainer = document.getElementById('customPromptSelector');
      const quickContainer = document.getElementById('quickPromptEditor');

      if (defaultContainer && customContainer && quickContainer) {
        // Hide all containers first
        defaultContainer.classList.add('hidden');
        customContainer.classList.add('hidden');
        quickContainer.classList.add('hidden');

        // Show the appropriate container
        if (this.state.promptType === PROMPT_TYPES.DEFAULT) {
          defaultContainer.classList.remove('hidden');
        } else if (this.state.promptType === PROMPT_TYPES.CUSTOM) {
          customContainer.classList.remove('hidden');
        } else if (this.state.promptType === PROMPT_TYPES.QUICK) {
          quickContainer.classList.remove('hidden');
        }
      }

      // Initialize appropriate prompt UI based on type
      if (this.state.promptType === PROMPT_TYPES.DEFAULT) {
        await this.initializeDefaultPromptConfig();
      } else if (this.state.promptType === PROMPT_TYPES.CUSTOM) {
        await this.initializeCustomPromptSelector();
      } else if (this.state.promptType === PROMPT_TYPES.QUICK) {
        await this.initializeQuickPromptEditor();
      }

      // Load previously selected prompt ID
      if (this.preferenceService) {
        try {
          const savedPromptId = await this.preferenceService.getSelectedPromptId(
            this.state.contentType,
            this.state.promptType
          );

          if (savedPromptId) {
            this.state.selectedPromptId = savedPromptId;

            // If using custom prompts, also update the selector UI
            if (this.state.promptType === PROMPT_TYPES.CUSTOM && this.customPromptSelector) {
              await this.customPromptSelector.setSelectedPromptId(savedPromptId);
            }
          } else if (this.state.promptType === PROMPT_TYPES.DEFAULT) {
            // Default to content type as prompt ID for default type
            this.state.selectedPromptId = this.state.contentType;
          } else if (this.state.promptType === PROMPT_TYPES.QUICK) {
            // Default to 'quick' as prompt ID for quick type
            this.state.selectedPromptId = 'quick';
          }
        } catch (error) {
          console.error('Error loading saved prompt ID:', error);
          if (this.state.promptType === PROMPT_TYPES.DEFAULT) {
            this.state.selectedPromptId = this.state.contentType;
          } else if (this.state.promptType === PROMPT_TYPES.QUICK) {
            this.state.selectedPromptId = 'quick';
          }
        }
      }

      // Initialize API mode components
      await this.initializeApiMode();

      // Start monitoring for selection changes
      this.setupSelectionMonitoring();

      // Update status
      this.statusManager.updateStatus('Ready to summarize.', false, this.state.isSupported);
    } catch (error) {
      console.error('Initialization error:', error);
      this.statusManager.updateStatus(`Error: ${error.message}`, false, false);
    }
  }

  /**
   * Initialize API mode components
   */
  async initializeApiMode() {
    try {
      if (!this.apiModeToggle || !this.state.selectedPlatformId) return;

      // Check if API mode is available for the platform
      const isApiModeAvailable = await this.checkApiModeAvailable();

      if (!isApiModeAvailable) {
        // Hide API mode toggle if not available
        const apiModeSection = document.getElementById('apiModeSection');
        if (apiModeSection) {
          apiModeSection.style.display = 'none';
        }
        return;
      }

      // Get saved API mode preferences
      const apiModePrefs = await this.getApiModePreferences();

      // Initialize API mode toggle with saved preferences
      await this.apiModeToggle.initialize(
        this.state.selectedPlatformId,
        apiModePrefs.enabled
      );

      // Update internal state
      this.state.apiModeEnabled = apiModePrefs.enabled;
      this.state.selectedModelId = apiModePrefs.model;

      // If API mode is enabled, set up model selector
      if (this.state.apiModeEnabled) {
        await this.initializeModelSelector();
      }

      // Update UI visibility
      this.updateApiModeVisibility();
    } catch (error) {
      console.error('Error initializing API mode:', error);
    }
  }

  /**
   * Initialize model selector component
   */
  async initializeModelSelector() {
    try {
      if (!this.modelSelector || !this.state.selectedPlatformId) return;

      // Load available models for the current platform
      const models = await this.getApiModels();
      this.state.availableModels = models;

      // Get the selected model (saved preference or default)
      let selectedModel = this.state.selectedModelId;
      if (!selectedModel && models.length > 0) {
        // Use default model or first available
        selectedModel = models.find(m => m.isDefault)?.id || models[0].id;
        this.state.selectedModelId = selectedModel;
      }

      // Initialize the model selector component
      this.modelSelector.initialize(
        this.state.selectedPlatformId,
        models,
        selectedModel
      );

      // Make model selector visible if API mode is enabled
      this.modelSelector.setVisible(this.state.apiModeEnabled);
    } catch (error) {
      console.error('Error initializing model selector:', error);
    }
  }

  /**
   * Handle API mode toggle change
   * @param {boolean} enabled - New enabled state
   * @param {string} platformId - Platform ID
   */
  async handleApiModeToggle(enabled, platformId) {
    try {
      // Update state
      this.state.apiModeEnabled = enabled;

      // Save preference
      await this.saveApiModePreferences();

      // Update UI visibility
      this.updateApiModeVisibility();

      // Initialize or update model selector if enabled
      if (enabled) {
        await this.initializeModelSelector();
      }
    } catch (error) {
      console.error('Error handling API mode toggle:', error);
    }
  }

  /**
   * Handle model selection change
   * @param {string} modelId - Selected model ID
   * @param {string} platformId - Platform ID
   */
  async handleModelChange(modelId, platformId) {
    try {
      // Update state
      this.state.selectedModelId = modelId;

      // Save preference
      await this.saveApiModePreferences();
    } catch (error) {
      console.error('Error handling model change:', error);
    }
  }

  /**
   * Update API mode component visibility
   */
  updateApiModeVisibility() {
    // Update model selector visibility
    if (this.modelSelector) {
      this.modelSelector.setVisible(this.state.apiModeEnabled);
    }

    // Update status message to show API mode is active
    if (this.state.apiModeEnabled) {
      this.statusManager.updateStatus(`API Mode active - using ${this.state.selectedPlatformId} API`);
    }
  }

  /**
   * Check if API mode is available for the current platform
   * @returns {Promise<boolean>} - Availability result
   */
  async checkApiModeAvailable() {
    try {
      if (!this.state.selectedPlatformId) return false;

      // Call background script to check API mode availability
      const response = await chrome.runtime.sendMessage({
        action: 'checkApiModeAvailable',
        platformId: this.state.selectedPlatformId
      });

      return response && response.success && response.isAvailable;
    } catch (error) {
      console.error('Error checking API mode availability:', error);
      return false;
    }
  }

  /**
   * Get available API models for the current platform
   * @returns {Promise<Array>} - Available models
   */
  async getApiModels() {
    try {
      if (!this.state.selectedPlatformId) return [];

      // Call background script to get available models
      const response = await chrome.runtime.sendMessage({
        action: 'getApiModels',
        platformId: this.state.selectedPlatformId
      });

      if (response && response.success && response.models) {
        return response.models;
      }

      return [];
    } catch (error) {
      console.error('Error getting API models:', error);
      return [];
    }
  }

  /**
   * Get API mode preferences for the current platform
   * @returns {Promise<Object>} - API mode preferences
   */
  async getApiModePreferences() {
    try {
      // Call background script to get API mode preferences
      const response = await chrome.runtime.sendMessage({
        action: 'getApiModePreferences',
        platformId: this.state.selectedPlatformId
      });

      if (response && response.success) {
        return response.preferences;
      }

      return { enabled: false, model: null };
    } catch (error) {
      console.error('Error getting API mode preferences:', error);
      return { enabled: false, model: null };
    }
  }

  /**
   * Save API mode preferences
   * @returns {Promise<boolean>} - Success indicator
   */
  async saveApiModePreferences() {
    try {
      // Call background script to save API mode preferences
      const response = await chrome.runtime.sendMessage({
        action: 'saveApiModePreferences',
        platformId: this.state.selectedPlatformId,
        preferences: {
          enabled: this.state.apiModeEnabled,
          model: this.state.selectedModelId
        }
      });

      return response && response.success;
    } catch (error) {
      console.error('Error saving API mode preferences:', error);
      return false;
    }
  }

  /**
   * Handle summarize action
   */
  async handleSummarize() {
    if (this.state.isProcessing || !this.state.isSupported) return;

    // Check if quick prompt is empty when using quick prompt type
    if (this.state.promptType === PROMPT_TYPES.QUICK && this.quickPromptEditor) {
      const quickPromptText = this.quickPromptEditor.getText();
      if (!quickPromptText.trim()) {
        this.statusManager.updateStatus('Please enter a prompt in the Quick Prompt editor', false, true);
        this.statusManager.showToast('Quick Prompt cannot be empty', 'error');
        return;
      }
    }

    this.state.isProcessing = true;

    // Determine if we're dealing with selected text
    const hasSelection = this.state.contentType === CONTENT_TYPES.SELECTED_TEXT;

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
      hasSelection,
      this.state.apiModeEnabled,
      this.state.selectedModelId,
      (message, isProcessing = true) => {
        this.statusManager.updateStatus(message, isProcessing, this.state.isSupported);
        this.state.isProcessing = isProcessing;
      }
    );
  }

  /**
   * Initialize custom prompt selector
   */
  async initializeCustomPromptSelector() {
    try {
      // Pass current content type to the selector
      await this.customPromptSelector.initialize(this.state.contentType);
    } catch (error) {
      console.error('Error initializing custom prompt selector:', error);
      this.statusManager.updateStatus(`Error: ${error.message}`);
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

      // Update API mode components when platform changes
      await this.initializeApiMode();
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
          this.state.promptType,
          promptId
        );
      } catch (error) {
        console.error('Error saving prompt selection:', error);
      }
    }
  }

  /**
   * Handle prompt type toggle
   * @param {string} promptType - The prompt type ('default', 'custom', or 'quick')
   */
  async handlePromptTypeToggle(promptType) {
    try {
      // Only proceed if it's a change
      if (this.state.promptType !== promptType) {
        this.state.promptType = promptType;

        // Save preference
        if (this.preferenceService) {
          try {
            await this.preferenceService.savePromptTypePreference(this.state.contentType, promptType);
          } catch (error) {
            console.error('Error saving prompt type preference:', error);
          }
        }

        // Show/hide appropriate containers
        const defaultContainer = document.getElementById('defaultPromptConfig');
        const customContainer = document.getElementById('customPromptSelector');
        const quickContainer = document.getElementById('quickPromptEditor');

        if (defaultContainer && customContainer && quickContainer) {
          // Hide all containers first
          defaultContainer.classList.add('hidden');
          customContainer.classList.add('hidden');
          quickContainer.classList.add('hidden');

          // Show the appropriate container based on type
          if (promptType === PROMPT_TYPES.DEFAULT) {
            defaultContainer.classList.remove('hidden');
            await this.initializeDefaultPromptConfig();

            // Load appropriate prompt ID
            if (this.preferenceService) {
              try {
                const savedPromptId = await this.preferenceService.getSelectedPromptId(
                  this.state.contentType,
                  PROMPT_TYPES.DEFAULT
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
          } else if (promptType === PROMPT_TYPES.CUSTOM) {
            customContainer.classList.remove('hidden');
            await this.initializeCustomPromptSelector();

            // Load appropriate prompt ID
            if (this.preferenceService) {
              try {
                const savedPromptId = await this.preferenceService.getSelectedPromptId(
                  this.state.contentType,
                  PROMPT_TYPES.CUSTOM
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
          } else if (promptType === PROMPT_TYPES.QUICK) {
            quickContainer.classList.remove('hidden');
            await this.initializeQuickPromptEditor();

            // Set prompt ID to 'quick'
            this.state.selectedPromptId = 'quick';

            // Save selection
            if (this.preferenceService) {
              try {
                await this.preferenceService.saveSelectedPromptId(
                  this.state.contentType,
                  PROMPT_TYPES.QUICK,
                  'quick'
                );
              } catch (error) {
                console.error('Error saving quick prompt selection:', error);
              }
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
            PROMPT_TYPES.DEFAULT,
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
   * Initialize quick prompt editor
   */
  async initializeQuickPromptEditor() {
    try {
      if (this.quickPromptEditor) {
        await this.quickPromptEditor.initialize(this.state.contentType);
      }
    } catch (error) {
      console.error('Error initializing quick prompt editor:', error);
      this.statusManager.updateStatus(`Error: ${error.message}`);
    }
  }

  /**
   * Handle quick prompt change
   * @param {string} text - The new quick prompt text
   */
  async handleQuickPromptChange(text) {
    // The QuickPromptEditor already handles saving text to storage
    // This method exists for potential future extensions or validations
    // It also maintains architectural symmetry with other handler methods
  }

  /**
   * Setup monitoring for selection changes
   */
  setupSelectionMonitoring() {
    // Cancel any existing interval
    if (this.selectionCheckInterval) {
      clearInterval(this.selectionCheckInterval);
    }

    // Set up a new interval to check for selection changes
    this.selectionCheckInterval = setInterval(async () => {
      await this.refreshContentTypeDetection();
    }, 1000); // Check every second
  }

  /**
   * Refresh content type detection
   */
  async refreshContentTypeDetection() {
    if (!this.state.currentTab?.url) return;

    const hasSelection = await this.contentService.checkForTextSelection();
    let newContentType;

    if (hasSelection) {
      newContentType = CONTENT_TYPES.SELECTED_TEXT;
    } else {
      // Non-selection based detection
      if (this.state.currentTab.url.endsWith('.pdf') ||
          this.state.currentTab.url.includes('/pdf/') ||
          this.state.currentTab.url.includes('pdfviewer') ||
          (this.state.currentTab.url.includes('chrome-extension://') &&
           this.state.currentTab.url.includes('pdfviewer'))) {
        newContentType = CONTENT_TYPES.PDF;
      } else if (this.state.currentTab.url.includes('youtube.com/watch')) {
        newContentType = CONTENT_TYPES.YOUTUBE;
      } else if (this.state.currentTab.url.includes('reddit.com/r/') &&
                 this.state.currentTab.url.includes('/comments/')) {
        newContentType = CONTENT_TYPES.REDDIT;
      } else {
        newContentType = CONTENT_TYPES.GENERAL;
      }
    }

    // Only update if content type has changed
    if (newContentType !== this.state.contentType) {
      this.state.contentType = newContentType;
      this.contentTypeView.update(newContentType);

      // Reload appropriate prompts based on content type
      if (this.state.promptType === PROMPT_TYPES.DEFAULT) {
        await this.initializeDefaultPromptConfig();
      } else if (this.state.promptType === PROMPT_TYPES.CUSTOM) {
        await this.initializeCustomPromptSelector();
      }
    }
  }

  /**
   * Refresh configuration and update UI
   */
  async refreshConfiguration() {
    try {
      // Reload prompt configuration
      if (this.state.promptType === PROMPT_TYPES.DEFAULT) {
        await this.initializeDefaultPromptConfig();
      } else if (this.state.promptType === PROMPT_TYPES.CUSTOM) {
        await this.initializeCustomPromptSelector();
      } else if (this.state.promptType === PROMPT_TYPES.QUICK) {
        await this.initializeQuickPromptEditor();
      }

      // Update status
      this.statusManager.updateStatus('Configuration updated', false, this.state.isSupported);
    } catch (error) {
      console.error('Error refreshing configuration:', error);
      this.statusManager.updateStatus(`Error refreshing: ${error.message}`, false, this.state.isSupported);
    }
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

  /**
   * Clean up resources when component is destroyed
   */
  destroy() {
    // Clear the selection check interval
    if (this.selectionCheckInterval) {
      clearInterval(this.selectionCheckInterval);
      this.selectionCheckInterval = null;
    }

    // Other cleanup...
  }
}

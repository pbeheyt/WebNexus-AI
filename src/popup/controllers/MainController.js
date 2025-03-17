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
    quickPromptEditor
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

    this.state = {
      currentTab: null,
      contentType: null,
      isSupported: false,
      platforms: [],
      selectedPlatformId: null,
      selectedPromptId: null,
      isProcessing: false,
      promptType: PROMPT_TYPES.DEFAULT  // Changed from isDefaultPromptType boolean to string enum
    };

    this.selectionCheckInterval = null; // Add this property
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
      hasSelection, // Pass selection state
      (message, isProcessing = true) => {
        this.statusManager.updateStatus(message, isProcessing, this.state.isSupported);
        this.state.isProcessing = isProcessing;
      }
    );
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

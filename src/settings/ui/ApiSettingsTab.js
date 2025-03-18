// src/settings/ui/ApiSettingsTab.js

/**
 * UI component for API settings tab
 */
class ApiSettingsTab {
  constructor(apiSettingsController, eventBus, notificationManager) {
    this.apiSettingsController = apiSettingsController;
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
    this.container = null;
    this.platforms = [];
    this.selectedPlatformId = null;
    this.modelsCache = {};
    
    // Bind methods
    this.render = this.render.bind(this);
    this.handlePlatformSelect = this.handlePlatformSelect.bind(this);
    this.handleSaveCredentials = this.handleSaveCredentials.bind(this);
    this.handleRemoveCredentials = this.handleRemoveCredentials.bind(this);
    this.handleTestCredentials = this.handleTestCredentials.bind(this);
    this.handleSaveAdvancedSettings = this.handleSaveAdvancedSettings.bind(this);
    
    // Subscribe to events
    this.eventBus.subscribe('api:credentials:updated', this.handleCredentialsUpdated.bind(this));
    this.eventBus.subscribe('api:settings:updated', this.handleSettingsUpdated.bind(this));
  }
  
  /**
   * Initialize the tab
   * @param {HTMLElement} container Tab container element
   * @returns {Promise<boolean>} Success indicator
   */
  async initialize(container) {
    this.container = container;
    
    try {
      // Initialize the controller
      await this.apiSettingsController.initialize();
      
      // Get platforms with credentials
      this.platforms = this.apiSettingsController.getPlatformsWithCredentials();
      
      // Set first platform as selected by default
      if (this.platforms.length > 0) {
        this.selectedPlatformId = this.platforms[0].id;
      }
      
      // Render the UI
      this.render();
      
      return true;
    } catch (error) {
      console.error('Error initializing API settings tab:', error);
      this.notificationManager.error(`Failed to initialize API settings: ${error.message}`);
      
      // Render error state
      this.renderError(error);
      
      return false;
    }
  }
  
  /**
   * Render the tab content
   */
  render() {
    if (!this.container) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create tab structure
    const tabContent = document.createElement('div');
    tabContent.className = 'api-settings-tab-content';
    
    // Add header with description
    const header = document.createElement('div');
    header.className = 'api-settings-header';
    header.innerHTML = `
      <h2 class="type-heading">API Settings</h2>
      <p class="section-description">
        Configure API credentials for different AI platforms. These settings will be used when making API requests
        directly from the browser extension.
      </p>
    `;
    tabContent.appendChild(header);
    
    // Platform selection sidebar
    const platformSidebar = this.createPlatformSidebar();
    
    // Platform details panel
    const platformDetails = document.createElement('div');
    platformDetails.className = 'platform-details-panel';
    platformDetails.id = 'platform-details-panel';
    
    // If a platform is selected, render its details
    if (this.selectedPlatformId) {
      const platform = this.platforms.find(p => p.id === this.selectedPlatformId);
      if (platform) {
        this.renderPlatformDetails(platformDetails, platform);
      }
    } else {
      // Show message to select a platform
      platformDetails.innerHTML = `
        <div class="empty-state">
          <p>Select a platform from the list to configure its API settings.</p>
        </div>
      `;
    }
    
    // Create layout with sidebar and details
    const layout = document.createElement('div');
    layout.className = 'api-settings-layout';
    layout.appendChild(platformSidebar);
    layout.appendChild(platformDetails);
    
    tabContent.appendChild(layout);
    
    // Add to container
    this.container.appendChild(tabContent);
    
    // Apply necessary styles
    this.applyStyles();
  }
  
  /**
   * Create platform selection sidebar
   * @returns {HTMLElement} Sidebar element
   */
  createPlatformSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'platform-sidebar';
    
    const title = document.createElement('h3');
    title.className = 'sidebar-title';
    title.textContent = 'AI Platforms';
    sidebar.appendChild(title);
    
    // Platform list
    const platformList = document.createElement('ul');
    platformList.className = 'platform-list';
    
    this.platforms.forEach(platform => {
      const item = document.createElement('li');
      item.className = 'platform-item';
      if (platform.id === this.selectedPlatformId) {
        item.classList.add('selected');
      }
      
      // Add indicator if platform has credentials
      if (platform.credentials) {
        item.classList.add('has-credentials');
      }
      
      // Create platform icon and name
      let iconHtml = '';
      if (platform.icon) {
        iconHtml = `<img class="platform-icon" src="${platform.icon}" alt="${platform.name} icon">`;
      } else {
        // Fallback icon
        iconHtml = `<div class="platform-icon-placeholder">${platform.name.charAt(0)}</div>`;
      }
      
      item.innerHTML = `
        ${iconHtml}
        <span class="platform-name">${platform.name}</span>
        ${platform.credentials ? '<span class="credentials-badge">✓</span>' : ''}
      `;
      
      // Select platform when clicked
      item.addEventListener('click', () => {
        this.handlePlatformSelect(platform.id);
      });
      
      platformList.appendChild(item);
    });
    
    sidebar.appendChild(platformList);
    
    return sidebar;
  }
  
  /**
   * Render details for a specific platform
   * @param {HTMLElement} container Details container element
   * @param {Object} platform Platform details
   */
  renderPlatformDetails(container, platform) {
    // Clear container
    container.innerHTML = '';
    
    // Platform header
    const header = document.createElement('div');
    header.className = 'platform-header';
    
    let iconHtml = '';
    if (platform.icon) {
      iconHtml = `<img class="platform-icon-large" src="${platform.icon}" alt="${platform.name} icon">`;
    } else {
      // Fallback icon
      iconHtml = `<div class="platform-icon-placeholder-large">${platform.name.charAt(0)}</div>`;
    }
    
    header.innerHTML = `
      ${iconHtml}
      <div class="platform-header-info">
        <h3 class="platform-title">${platform.name}</h3>
        <div class="platform-actions">
          <a href="${platform.url}" target="_blank" class="platform-link">Visit Website</a>
          <a href="${platform.docUrl}" target="_blank" class="platform-link">API Documentation</a>
        </div>
      </div>
    `;
    
    container.appendChild(header);
    
    // API credentials section
    const credentialsSection = document.createElement('div');
    credentialsSection.className = 'settings-section';
    
    const credentialsTitle = document.createElement('h4');
    credentialsTitle.className = 'section-subtitle';
    credentialsTitle.textContent = 'API Credentials';
    credentialsSection.appendChild(credentialsTitle);
    
    // API key input
    const keyGroup = document.createElement('div');
    keyGroup.className = 'form-group';
    
    const keyLabel = document.createElement('label');
    keyLabel.htmlFor = `${platform.id}-api-key`;
    keyLabel.textContent = 'API Key:';
    
    const keyInput = document.createElement('input');
    keyInput.type = 'password';
    keyInput.id = `${platform.id}-api-key`;
    keyInput.className = 'api-key-input';
    keyInput.placeholder = 'Enter your API key';
    keyInput.value = platform.credentials?.apiKey || '';
    
    const showKeyToggle = document.createElement('button');
    showKeyToggle.type = 'button';
    showKeyToggle.className = 'show-key-toggle';
    showKeyToggle.textContent = 'Show';
    showKeyToggle.addEventListener('click', () => {
      // Toggle key visibility
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        showKeyToggle.textContent = 'Hide';
      } else {
        keyInput.type = 'password';
        showKeyToggle.textContent = 'Show';
      }
    });
    
    keyGroup.appendChild(keyLabel);
    keyGroup.appendChild(keyInput);
    keyGroup.appendChild(showKeyToggle);
    
    // Model selection
    const modelGroup = document.createElement('div');
    modelGroup.className = 'form-group';
    
    const modelLabel = document.createElement('label');
    modelLabel.htmlFor = `${platform.id}-model`;
    modelLabel.textContent = 'Model:';
    
    const modelSelect = document.createElement('select');
    modelSelect.id = `${platform.id}-model`;
    modelSelect.className = 'model-select';
    
    // Add loading option
    const loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.textContent = 'Loading models...';
    modelSelect.appendChild(loadingOption);
    
    modelGroup.appendChild(modelLabel);
    modelGroup.appendChild(modelSelect);
    
    // Load models for the platform
    this.loadModelsForPlatform(platform.id, modelSelect, platform.credentials?.model);
    
    // API key status message
    const statusMessage = document.createElement('div');
    statusMessage.id = `${platform.id}-status`;
    statusMessage.className = 'status-message';
    if (platform.credentials) {
      statusMessage.textContent = 'API key configured';
      statusMessage.classList.add('success');
    }
    
    // Credential actions
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    
    const testBtn = document.createElement('button');
    testBtn.className = 'btn test-btn';
    testBtn.textContent = 'Test Key';
    testBtn.addEventListener('click', () => {
      this.handleTestCredentials(platform.id);
    });
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn save-btn';
    saveBtn.textContent = platform.credentials ? 'Update Key' : 'Save Key';
    saveBtn.addEventListener('click', () => {
      this.handleSaveCredentials(platform.id);
    });
    
    if (platform.credentials) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn remove-btn';
      removeBtn.textContent = 'Remove Key';
      removeBtn.addEventListener('click', () => {
        this.handleRemoveCredentials(platform.id);
      });
      actions.appendChild(removeBtn);
    }
    
    actions.appendChild(testBtn);
    actions.appendChild(saveBtn);
    
    credentialsSection.appendChild(keyGroup);
    credentialsSection.appendChild(modelGroup);
    credentialsSection.appendChild(statusMessage);
    credentialsSection.appendChild(actions);
    
    container.appendChild(credentialsSection);
    
    // Advanced settings section
    const advancedSection = document.createElement('div');
    advancedSection.className = 'settings-section';
    
    const advancedTitle = document.createElement('h4');
    advancedTitle.className = 'section-subtitle';
    advancedTitle.textContent = 'Advanced Settings';
    advancedSection.appendChild(advancedTitle);
    
    // Get advanced settings for this platform
    const advancedSettings = platform.advancedSettings || {};
    
    // Max tokens setting
    const tokensGroup = document.createElement('div');
    tokensGroup.className = 'form-group';
    
    const tokensLabel = document.createElement('label');
    tokensLabel.htmlFor = `${platform.id}-max-tokens`;
    tokensLabel.textContent = this.getTokensLabel(platform.id);
    
    const tokensInput = document.createElement('input');
    tokensInput.type = 'number';
    tokensInput.id = `${platform.id}-max-tokens`;
    tokensInput.className = 'settings-input';
    tokensInput.min = '50';
    tokensInput.max = '32000';
    tokensInput.value = advancedSettings.maxTokens || this.getDefaultMaxTokens(platform.id);
    
    const tokensHelp = document.createElement('p');
    tokensHelp.className = 'help-text';
    tokensHelp.textContent = 'Maximum number of tokens to generate in the response.';
    
    tokensGroup.appendChild(tokensLabel);
    tokensGroup.appendChild(tokensInput);
    tokensGroup.appendChild(tokensHelp);
    
    // Temperature setting
    const temperatureGroup = document.createElement('div');
    temperatureGroup.className = 'form-group';
    
    const temperatureLabel = document.createElement('label');
    temperatureLabel.htmlFor = `${platform.id}-temperature`;
    temperatureLabel.textContent = 'Temperature:';
    
    const temperatureInput = document.createElement('input');
    temperatureInput.type = 'number';
    temperatureInput.id = `${platform.id}-temperature`;
    temperatureInput.className = 'settings-input';
    temperatureInput.min = '0';
    temperatureInput.max = '2';
    temperatureInput.step = '0.1';
    temperatureInput.value = advancedSettings.temperature || '0.7';
    
    const temperatureHelp = document.createElement('p');
    temperatureHelp.className = 'help-text';
    temperatureHelp.textContent = 'Controls randomness: lower values are more deterministic, higher values more creative.';
    
    temperatureGroup.appendChild(temperatureLabel);
    temperatureGroup.appendChild(temperatureInput);
    temperatureGroup.appendChild(temperatureHelp);
    
    // Additional platform-specific settings
    let extraSettings = null;
    switch (platform.id) {
      case 'claude':
        extraSettings = this.createClaudeSettings(platform, advancedSettings);
        break;
      case 'chatgpt':
        extraSettings = this.createChatGptSettings(platform, advancedSettings);
        break;
      // Add other platforms as needed
    }
    
    advancedSection.appendChild(tokensGroup);
    advancedSection.appendChild(temperatureGroup);
    
    if (extraSettings) {
      advancedSection.appendChild(extraSettings);
    }
    
    // Advanced settings actions
    const advancedActions = document.createElement('div');
    advancedActions.className = 'form-actions';
    
    const saveAdvancedBtn = document.createElement('button');
    saveAdvancedBtn.className = 'btn save-btn';
    saveAdvancedBtn.textContent = 'Save Settings';
    saveAdvancedBtn.addEventListener('click', () => {
      this.handleSaveAdvancedSettings(platform.id);
    });
    
    advancedActions.appendChild(saveAdvancedBtn);
    advancedSection.appendChild(advancedActions);
    
    container.appendChild(advancedSection);
  }
  
  /**
   * Create Claude-specific settings
   * @param {Object} platform Platform details
   * @param {Object} advancedSettings Advanced settings
   * @returns {HTMLElement} Settings element
   */
  createClaudeSettings(platform, advancedSettings) {
    const container = document.createElement('div');
    
    // System prompt
    const systemGroup = document.createElement('div');
    systemGroup.className = 'form-group';
    
    const systemLabel = document.createElement('label');
    systemLabel.htmlFor = `${platform.id}-system-prompt`;
    systemLabel.textContent = 'System Prompt:';
    
    const systemInput = document.createElement('textarea');
    systemInput.id = `${platform.id}-system-prompt`;
    systemInput.className = 'system-prompt-input';
    systemInput.placeholder = 'Enter a system prompt for Claude API requests';
    systemInput.value = advancedSettings.systemPrompt || '';
    
    const systemHelp = document.createElement('p');
    systemHelp.className = 'help-text';
    systemHelp.textContent = 'Optional system prompt to provide context for Claude API requests.';
    
    systemGroup.appendChild(systemLabel);
    systemGroup.appendChild(systemInput);
    systemGroup.appendChild(systemHelp);
    
    container.appendChild(systemGroup);
    
    return container;
  }
  
  /**
   * Create ChatGPT-specific settings
   * @param {Object} platform Platform details
   * @param {Object} advancedSettings Advanced settings
   * @returns {HTMLElement} Settings element
   */
  createChatGptSettings(platform, advancedSettings) {
    const container = document.createElement('div');
    
    // Top P setting
    const topPGroup = document.createElement('div');
    topPGroup.className = 'form-group';
    
    const topPLabel = document.createElement('label');
    topPLabel.htmlFor = `${platform.id}-top-p`;
    topPLabel.textContent = 'Top P:';
    
    const topPInput = document.createElement('input');
    topPInput.type = 'number';
    topPInput.id = `${platform.id}-top-p`;
    topPInput.className = 'settings-input';
    topPInput.min = '0';
    topPInput.max = '1';
    topPInput.step = '0.01';
    topPInput.value = advancedSettings.topP || '1';
    
    const topPHelp = document.createElement('p');
    topPHelp.className = 'help-text';
    topPHelp.textContent = 'Alternative to temperature, controls diversity via nucleus sampling.';
    
    topPGroup.appendChild(topPLabel);
    topPGroup.appendChild(topPInput);
    topPGroup.appendChild(topPHelp);
    
    // System prompt
    const systemGroup = document.createElement('div');
    systemGroup.className = 'form-group';
    
    const systemLabel = document.createElement('label');
    systemLabel.htmlFor = `${platform.id}-system-prompt`;
    systemLabel.textContent = 'System Prompt:';
    
    const systemInput = document.createElement('textarea');
    systemInput.id = `${platform.id}-system-prompt`;
    systemInput.className = 'system-prompt-input';
    systemInput.placeholder = 'Enter a system prompt for ChatGPT API requests';
    systemInput.value = advancedSettings.systemPrompt || '';
    
    const systemHelp = document.createElement('p');
    systemHelp.className = 'help-text';
    systemHelp.textContent = 'Optional system prompt to provide context for ChatGPT API requests.';
    
    systemGroup.appendChild(systemLabel);
    systemGroup.appendChild(systemInput);
    systemGroup.appendChild(systemHelp);
    
    container.appendChild(topPGroup);
    container.appendChild(systemGroup);
    
    return container;
  }
  
  /**
   * Load models for a platform
   * @param {string} platformId Platform ID
   * @param {HTMLSelectElement} selectElement Select element
   * @param {string} selectedModel Selected model ID
   */
  async loadModelsForPlatform(platformId, selectElement, selectedModel) {
    try {
      // Check if models are already in cache
      if (!this.modelsCache[platformId]) {
        // Get available models
        this.modelsCache[platformId] = await this.apiSettingsController.getAvailableModels(platformId);
      }
      
      const models = this.modelsCache[platformId];
      
      // Clear select element
      selectElement.innerHTML = '';
      
      if (models && models.length > 0) {
        // Add models to select element
        models.forEach(model => {
          const option = document.createElement('option');
          option.value = model;
          option.textContent = model;
          
          // Select the current model if available
          if (selectedModel && model === selectedModel) {
            option.selected = true;
          }
          
          selectElement.appendChild(option);
        });
      } else {
        // No models available
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No models available';
        selectElement.appendChild(option);
      }
    } catch (error) {
      console.error(`Error loading models for ${platformId}:`, error);
      
      // Show error in select element
      selectElement.innerHTML = '';
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Error loading models';
      selectElement.appendChild(option);
    }
  }
  
  /**
   * Render error state
   * @param {Error} error Error object
   */
  renderError(error) {
    if (!this.container) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create error message
    const errorElement = document.createElement('div');
    errorElement.className = 'api-settings-error';
    errorElement.innerHTML = `
      <h2 class="type-heading">API Settings</h2>
      <div class="error-state">
        <p>Failed to load API settings: ${error.message}</p>
        <button class="btn retry-btn">Retry</button>
      </div>
    `;
    
    // Add retry button handler
    const retryBtn = errorElement.querySelector('.retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        // Show loading state
        this.container.innerHTML = '<div class="loading-state">Loading API settings...</div>';
        
        // Try to initialize again
        try {
          await this.apiSettingsController.initialize();
          this.platforms = this.apiSettingsController.getPlatformsWithCredentials();
          this.render();
        } catch (error) {
          this.renderError(error);
        }
      });
    }
    
    this.container.appendChild(errorElement);
  }
  
  /**
   * Apply CSS styles
   */
  applyStyles() {
    // Create style element if it doesn't exist
    let styleElement = document.getElementById('api-settings-styles');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'api-settings-styles';
      document.head.appendChild(styleElement);
    }
    
    // Define styles
    styleElement.textContent = `
      .api-settings-layout {
        display: flex;
        gap: 24px;
        min-height: 500px;
      }
      
      .platform-sidebar {
        flex: 0 0 250px;
        border-right: 1px solid var(--border-color, #ddd);
        padding-right: 20px;
      }
      
      .platform-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      .platform-item {
        display: flex;
        align-items: center;
        padding: 12px;
        margin-bottom: 8px;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.2s;
        position: relative;
      }
      
      .platform-item:hover {
        background-color: var(--bg-surface-hover, #f5f5f5);
      }
      
      .platform-item.selected {
        background-color: var(--bg-surface-active, #e6f4ea);
      }
      
      .platform-item.has-credentials::after {
        content: "";
        position: absolute;
        right: 12px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--color-accent, #34a853);
      }
      
      .platform-icon {
        width: 24px;
        height: 24px;
        margin-right: 12px;
        object-fit: contain;
      }
      
      .platform-icon-placeholder {
        width: 24px;
        height: 24px;
        margin-right: 12px;
        border-radius: 50%;
        background-color: var(--color-primary, #4285f4);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
      }
      
      .platform-details-panel {
        flex: 1;
        min-width: 0;
      }
      
      .platform-header {
        display: flex;
        align-items: center;
        margin-bottom: 24px;
      }
      
      .platform-icon-large {
        width: 48px;
        height: 48px;
        margin-right: 16px;
      }
      
      .platform-icon-placeholder-large {
        width: 48px;
        height: 48px;
        margin-right: 16px;
        border-radius: 50%;
        background-color: var(--color-primary, #4285f4);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: bold;
      }
      
      .platform-header-info {
        flex: 1;
      }
      
      .platform-title {
        margin: 0 0 8px 0;
        font-size: 20px;
      }
      
      .platform-actions {
        display: flex;
        gap: 12px;
      }
      
      .platform-link {
        color: var(--color-primary, #4285f4);
        text-decoration: none;
        font-size: 14px;
      }
      
      .platform-link:hover {
        text-decoration: underline;
      }
      
      .settings-section {
        background-color: var(--bg-surface, #ffffff);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
        border: 1px solid var(--border-color, #ddd);
      }
      
      .section-subtitle {
        margin-top: 0;
        margin-bottom: 16px;
        font-size: 16px;
      }
      
      .form-group {
        margin-bottom: 16px;
        position: relative;
      }
      
      .api-key-input {
        width: 100%;
        padding: 10px;
        border: 1px solid var(--border-color, #ddd);
        border-radius: 4px;
        font-family: monospace;
      }
      
      .show-key-toggle {
        position: absolute;
        right: 10px;
        top: 32px;
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--color-primary, #4285f4);
      }
      
      .model-select {
        width: 100%;
        padding: 10px;
        border: 1px solid var(--border-color, #ddd);
        border-radius: 4px;
      }
      
      .status-message {
        margin: 16px 0;
        padding: 10px;
        border-radius: 4px;
        background-color: var(--bg-surface-hover, #f5f5f5);
      }
      
      .status-message.success {
        background-color: var(--success-bg, #e6f4ea);
        color: var(--success-color, #34a853);
      }
      
      .status-message.error {
        background-color: var(--error-bg, #fce8e6);
        color: var(--error-color, #ea4335);
      }
      
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 16px;
      }
      
      .test-btn {
        background-color: var(--bg-surface, #ffffff);
        color: var(--color-primary, #4285f4);
        border: 1px solid var(--color-primary, #4285f4);
      }
      
      .save-btn {
        background-color: var(--color-primary, #4285f4);
        color: white;
      }
      
      .remove-btn {
        background-color: var(--bg-surface, #ffffff);
        color: var(--error-color, #ea4335);
        border: 1px solid var(--error-color, #ea4335);
      }
      
      .system-prompt-input {
        width: 100%;
        min-height: 100px;
        padding: 10px;
        border: 1px solid var(--border-color, #ddd);
        border-radius: 4px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .help-text {
        margin-top: 4px;
        font-size: 12px;
        color: var(--text-secondary, #70757a);
      }
      
      .error-state, .loading-state {
        padding: 40px;
        text-align: center;
        background-color: var(--bg-surface, #ffffff);
        border-radius: 8px;
        border: 1px solid var(--border-color, #ddd);
      }
      
      .error-state .retry-btn {
        margin-top: 16px;
      }
      
      .credentials-badge {
        margin-left: 8px;
        display: inline-flex;
        width: 16px;
        height: 16px;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background-color: var(--color-accent, #34a853);
        color: white;
        font-size: 10px;
        font-weight: bold;
      }
    `;
  }
  
  /**
   * Handle platform selection
   * @param {string} platformId Platform ID
   */
  handlePlatformSelect(platformId) {
    if (this.selectedPlatformId === platformId) return;
    
    this.selectedPlatformId = platformId;
    this.render();
  }
  
  /**
   * Handle save credentials button click
   * @param {string} platformId Platform ID
   */
  async handleSaveCredentials(platformId) {
    const apiKeyInput = document.getElementById(`${platformId}-api-key`);
    const modelSelect = document.getElementById(`${platformId}-model`);
    const statusMessage = document.getElementById(`${platformId}-status`);
    
    if (!apiKeyInput || !modelSelect || !statusMessage) {
      this.notificationManager.error('Failed to find form elements');
      return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;
    
    if (!apiKey) {
      statusMessage.textContent = 'API key cannot be empty';
      statusMessage.className = 'status-message error';
      return;
    }
    
    // Disable inputs during save
    apiKeyInput.disabled = true;
    modelSelect.disabled = true;
    statusMessage.textContent = 'Saving...';
    statusMessage.className = 'status-message';
    
    try {
      const success = await this.apiSettingsController.saveCredentials(platformId, apiKey, model);
      
      if (success) {
        statusMessage.textContent = 'API key saved successfully';
        statusMessage.className = 'status-message success';
      } else {
        statusMessage.textContent = 'Failed to save API key';
        statusMessage.className = 'status-message error';
      }
    } catch (error) {
      console.error('Error saving credentials:', error);
      statusMessage.textContent = `Error: ${error.message}`;
      statusMessage.className = 'status-message error';
    } finally {
      // Re-enable inputs
      apiKeyInput.disabled = false;
      modelSelect.disabled = false;
    }
  }
  
  /**
   * Handle remove credentials button click
   * @param {string} platformId Platform ID
   */
  async handleRemoveCredentials(platformId) {
    if (!confirm(`Are you sure you want to remove the API key for ${this.apiSettingsController.getPlatformName(platformId)}?`)) {
      return;
    }
    
    const statusMessage = document.getElementById(`${platformId}-status`);
    if (!statusMessage) return;
    
    statusMessage.textContent = 'Removing...';
    statusMessage.className = 'status-message';
    
    try {
      const success = await this.apiSettingsController.removeCredentials(platformId);
      
      if (success) {
        // Re-render after a slight delay to show the status message
        setTimeout(() => this.render(), 500);
      } else {
        statusMessage.textContent = 'Failed to remove API key';
        statusMessage.className = 'status-message error';
      }
    } catch (error) {
      console.error('Error removing credentials:', error);
      statusMessage.textContent = `Error: ${error.message}`;
      statusMessage.className = 'status-message error';
    }
  }
  
  /**
   * Handle test credentials button click
   * @param {string} platformId Platform ID
   */
  async handleTestCredentials(platformId) {
    const apiKeyInput = document.getElementById(`${platformId}-api-key`);
    const modelSelect = document.getElementById(`${platformId}-model`);
    const statusMessage = document.getElementById(`${platformId}-status`);
    
    if (!apiKeyInput || !modelSelect || !statusMessage) {
      this.notificationManager.error('Failed to find form elements');
      return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;
    
    if (!apiKey) {
      statusMessage.textContent = 'API key cannot be empty';
      statusMessage.className = 'status-message error';
      return;
    }
    
    // Show testing status
    statusMessage.textContent = 'Testing API key...';
    statusMessage.className = 'status-message';
    
    // Disable inputs during test
    apiKeyInput.disabled = true;
    modelSelect.disabled = true;
    
    try {
      const result = await this.apiSettingsController.testApiKey(platformId, apiKey, model);
      
      if (result.success) {
        statusMessage.textContent = 'API key is valid';
        statusMessage.className = 'status-message success';
      } else {
        statusMessage.textContent = `Invalid API key: ${result.message}`;
        statusMessage.className = 'status-message error';
      }
    } catch (error) {
      console.error('Error testing API key:', error);
      statusMessage.textContent = `Error: ${error.message}`;
      statusMessage.className = 'status-message error';
    } finally {
      // Re-enable inputs
      apiKeyInput.disabled = false;
      modelSelect.disabled = false;
    }
  }
  
  /**
   * Handle save advanced settings button click
   * @param {string} platformId Platform ID
   */
  async handleSaveAdvancedSettings(platformId) {
    try {
      const maxTokensInput = document.getElementById(`${platformId}-max-tokens`);
      const temperatureInput = document.getElementById(`${platformId}-temperature`);
      
      if (!maxTokensInput || !temperatureInput) {
        this.notificationManager.error('Failed to find form elements');
        return;
      }
      
      // Get values from inputs
      const maxTokens = parseInt(maxTokensInput.value, 10);
      const temperature = parseFloat(temperatureInput.value);
      
      // Validate values
      if (isNaN(maxTokens) || maxTokens < 50 || maxTokens > 32000) {
        this.notificationManager.error('Max tokens must be a number between 50 and 32000');
        return;
      }
      
      if (isNaN(temperature) || temperature < 0 || temperature > 2) {
        this.notificationManager.error('Temperature must be a number between 0 and 2');
        return;
      }
      
      // Create settings object
      const settings = {
        maxTokens,
        temperature
      };
      
      // Add platform-specific settings
      switch (platformId) {
        case 'chatgpt':
          const topPInput = document.getElementById(`${platformId}-top-p`);
          const systemPromptInput = document.getElementById(`${platformId}-system-prompt`);
          
          if (topPInput) {
            const topP = parseFloat(topPInput.value);
            if (!isNaN(topP) && topP >= 0 && topP <= 1) {
              settings.topP = topP;
            }
          }
          
          if (systemPromptInput) {
            settings.systemPrompt = systemPromptInput.value.trim();
          }
          break;
          
        case 'claude':
          const claudeSystemPromptInput = document.getElementById(`${platformId}-system-prompt`);
          if (claudeSystemPromptInput) {
            settings.systemPrompt = claudeSystemPromptInput.value.trim();
          }
          break;
      }
      
      // Save settings
      const success = await this.apiSettingsController.saveAdvancedSettings(platformId, settings);
      
      if (success) {
        this.notificationManager.success('Advanced settings saved successfully');
      } else {
        this.notificationManager.error('Failed to save advanced settings');
      }
    } catch (error) {
      console.error('Error saving advanced settings:', error);
      this.notificationManager.error(`Error: ${error.message}`);
    }
  }
  
  /**
   * Handle credentials updated event
   * @param {Object} data Event data
   */
  handleCredentialsUpdated(data) {
    // Re-fetch platforms if necessary
    if (this.platforms.some(p => p.id === data.platformId)) {
      this.apiSettingsController.initialize().then(() => {
        this.platforms = this.apiSettingsController.getPlatformsWithCredentials();
        this.render();
      });
    }
  }
  
  /**
   * Handle settings updated event
   * @param {Object} data Event data
   */
  handleSettingsUpdated(data) {
    // Update local state and re-render if necessary
    if (this.selectedPlatformId === data.platformId) {
      this.apiSettingsController.initialize().then(() => {
        this.platforms = this.apiSettingsController.getPlatformsWithCredentials();
        this.render();
      });
    }
  }
  
  /**
   * Get token label for a platform
   * @param {string} platformId Platform ID
   * @returns {string} Token label
   */
  getTokensLabel(platformId) {
    if (platformId === 'chatgpt' || platformId === 'grok') {
      return 'Max Completion Tokens:';
    }
    
    return 'Max Tokens:';
  }
  
  /**
   * Get default max tokens for a platform
   * @param {string} platformId Platform ID
   * @returns {number} Default max tokens
   */
  getDefaultMaxTokens(platformId) {
    switch (platformId) {
      case 'claude':
        return 4000;
      case 'chatgpt':
        return 2048;
      case 'gemini':
        return 2048;
      case 'mistral':
        return 4096;
      case 'deepseek':
        return 4096;
      case 'grok':
        return 4096;
      default:
        return 2048;
    }
  }
}

export default ApiSettingsTab;
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
    this.selectedModelId = null; // Track selected model for settings, initialized to null
    
    // Bind methods
    this.render = this.render.bind(this);
    this.handlePlatformSelect = this.handlePlatformSelect.bind(this);
    this.handleSaveCredentials = this.handleSaveCredentials.bind(this);
    this.handleRemoveCredentials = this.handleRemoveCredentials.bind(this);
    this.handleTestCredentials = this.handleTestCredentials.bind(this);
    this.handleSaveAdvancedSettings = this.handleSaveAdvancedSettings.bind(this);
    this.handleModelSelect = this.handleModelSelect.bind(this);
    this.renderModelAdvancedSettings = this.renderModelAdvancedSettings.bind(this);
    this.formatPrice = this.formatPrice.bind(this);
    
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
        // Set selectedModelId to the first model if available
        if (this.platforms[0].apiConfig?.models?.length > 0) {
          this.selectedModelId = this.platforms[0].apiConfig.models[0].id;
        }
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
        Configure API credentials for different AI platforms and customize advanced settings for each model. These settings will be used when making API requests 
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
          <a href="${platform.docUrl}" target="_blank" class="platform-link">API Documentation</a>
          <a href="${platform.modelApiLink}" target="_blank" class="platform-link">Model Documentation</a>
          <a href="${platform.consoleApiLink}" target="_blank" class="platform-link">API Console</a>
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
    credentialsSection.appendChild(statusMessage);
    credentialsSection.appendChild(actions);
    
    container.appendChild(credentialsSection);
    
    // Advanced settings section
    this.renderAdvancedSettingsSection(container, platform);
  }
  
  /**
   * Render advanced settings section
   * @param {HTMLElement} container Container element
   * @param {Object} platform Platform details
   */
  renderAdvancedSettingsSection(container, platform) {
    const advancedSection = document.createElement('div');
    advancedSection.className = 'settings-section';
    
    // Create a header container to hold both the title and reset button
    const headerContainer = document.createElement('div');
    headerContainer.className = 'section-header-with-actions';
    headerContainer.style.display = 'flex';
    headerContainer.style.justifyContent = 'space-between';
    headerContainer.style.alignItems = 'center';
    headerContainer.style.marginBottom = '15px';
    
    const advancedTitle = document.createElement('h4');
    advancedTitle.className = 'section-subtitle';
    advancedTitle.textContent = 'Advanced Settings';
    
    // Create reset button directly in the header
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn reset-btn';
    resetBtn.textContent = 'Reset to Configuration Defaults';
    resetBtn.style.marginLeft = 'auto';
    resetBtn.addEventListener('click', async () => {
      if (confirm(`Reset all settings for ${this.selectedModelId} to configuration defaults?`)) {
        await this.apiSettingsController.resetModelToDefaults(platform.id, this.selectedModelId);
        
        // Get the container and re-render the model settings
        const container = document.getElementById(`${platform.id}-advanced-settings-container`);
        if (container) {
          this.renderModelAdvancedSettings(container, platform, this.selectedModelId);
        }
      }
    });
    
    headerContainer.appendChild(advancedTitle);
    headerContainer.appendChild(resetBtn);
    advancedSection.appendChild(headerContainer);
    
    // Add model selector for advanced settings
    const modelSelectorGroup = document.createElement('div');
    modelSelectorGroup.className = 'form-group';
    
    const modelSelectorLabel = document.createElement('label');
    modelSelectorLabel.htmlFor = `${platform.id}-settings-model-selector`;
    modelSelectorLabel.textContent = 'Configure Settings For:';
    
    const modelSelector = document.createElement('select');
    modelSelector.id = `${platform.id}-settings-model-selector`;
    modelSelector.className = 'settings-model-selector';
    
    // Add model-specific options if models are available
    if (platform.apiConfig?.models) {
      platform.apiConfig.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.id;
        option.selected = this.selectedModelId === model.id;
        modelSelector.appendChild(option);
      });
    }
    
    // If no models, add a placeholder option
    if (!platform.apiConfig?.models || platform.apiConfig.models.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No models available';
      option.disabled = true;
      modelSelector.appendChild(option);
    }
    
    // Handle model selection change
    modelSelector.addEventListener('change', () => {
      this.handleModelSelect(platform.id, modelSelector.value);
    });
    
    modelSelectorGroup.appendChild(modelSelectorLabel);
    modelSelectorGroup.appendChild(modelSelector);
    
    advancedSection.appendChild(modelSelectorGroup);
    
    // Container for model-specific settings
    const advancedSettingsContainer = document.createElement('div');
    advancedSettingsContainer.id = `${platform.id}-advanced-settings-container`;
    advancedSettingsContainer.className = 'model-advanced-settings';
    advancedSection.appendChild(advancedSettingsContainer);
    
    // Render settings for selected model if available, or select the first model
    if (this.selectedModelId && platform.apiConfig?.models?.some(m => m.id === this.selectedModelId)) {
      this.renderModelAdvancedSettings(
        advancedSettingsContainer,
        platform,
        this.selectedModelId
      );
    } else if (platform.apiConfig?.models?.length > 0) {
      this.selectedModelId = platform.apiConfig.models[0].id;
      this.renderModelAdvancedSettings(
        advancedSettingsContainer,
        platform,
        this.selectedModelId
      );
    }
    
    container.appendChild(advancedSection);
  }
  
  /**
   * Render advanced settings for a specific model
   * @param {HTMLElement} container Container element
   * @param {Object} platform Platform details
   * @param {string} modelId Model ID
   */
  renderModelAdvancedSettings(container, platform, modelId) {
    // Clear container
    container.innerHTML = '';
    
    // Get settings for this model
    const settings = this.apiSettingsController.getAdvancedSettings(platform.id, modelId);
    
    // Get model-specific config from platform
    let modelConfig = null;
    if (platform.apiConfig?.models) {
      modelConfig = platform.apiConfig.models.find(m => m.id === modelId);
    }
    
    // Get default settings from model config
    const configDefaults = this.apiSettingsController.getModelDefaultSettings(platform.id, modelId);
    
    // Add pricing information section
    if (modelConfig && (modelConfig.inputTokenPrice !== undefined || 
                       modelConfig.outputTokenPrice !== undefined)) {
      const pricingSection = document.createElement('div');
      pricingSection.className = 'pricing-section';
      
      const pricingTitle = document.createElement('h5');
      pricingTitle.className = 'pricing-title';
      pricingTitle.textContent = 'Model Pricing';
      
      const pricingInfo = document.createElement('div');
      pricingInfo.className = 'pricing-info';
      
      if (modelConfig.inputTokenPrice !== undefined) {
        const inputPrice = document.createElement('div');
        inputPrice.className = 'price-item';
        const isInputFree = typeof modelConfig.inputTokenPrice === 'number' && Math.abs(modelConfig.inputTokenPrice) < 0.0001;
        const inputPriceDisplay = isInputFree ? "Free" : `$${this.formatPrice(modelConfig.inputTokenPrice)} per 1M tokens`;
        inputPrice.innerHTML = `<span class="price-label">Input tokens:</span> 
                               <span class="price-value">${inputPriceDisplay}</span>`;
        pricingInfo.appendChild(inputPrice);
      }
      
      if (modelConfig.outputTokenPrice !== undefined) {
        const outputPrice = document.createElement('div');
        outputPrice.className = 'price-item';
        const isOutputFree = typeof modelConfig.outputTokenPrice === 'number' && Math.abs(modelConfig.outputTokenPrice) < 0.0001;
        const outputPriceDisplay = isOutputFree ? "Free" : `$${this.formatPrice(modelConfig.outputTokenPrice)} per 1M tokens`;
        outputPrice.innerHTML = `<span class="price-label">Output tokens:</span> 
                                <span class="price-value">${outputPriceDisplay}</span>`;
        pricingInfo.appendChild(outputPrice);
      }
      
      pricingSection.appendChild(pricingTitle);
      pricingSection.appendChild(pricingInfo);
      pricingSection.style.marginBottom = '30px';
      container.appendChild(pricingSection);
    }
    
    // Max tokens setting
    const tokensGroup = this.createSettingField(
      platform.id,
      modelId,
      'max-tokens',
      this.apiSettingsController.getTokensLabel(platform.id, modelConfig),
      'number',
      settings.maxTokens || configDefaults.maxTokens || this.apiSettingsController.getDefaultMaxTokens(platform.id, modelConfig),
      'Maximum number of tokens to generate in the response.',
      { min: 50, max: 32000 }
    );
    container.appendChild(tokensGroup);
    
    // Context window setting
    const contextGroup = this.createSettingField(
      platform.id,
      modelId,
      'context-window',
      'Context Window:',
      'number',
      settings.contextWindow || configDefaults.contextWindow || this.apiSettingsController.getContextWindow(platform.id, modelConfig),
      'Maximum number of tokens the model can process as context.',
      { min: 1000, max: 1000000 }
    );
    container.appendChild(contextGroup);
    
    // Temperature setting (if supported by model)
    const supportsTemperature = modelConfig ? modelConfig.supportsTemperature !== false : true;
    if (supportsTemperature) {
      const temperatureGroup = this.createSettingField(
        platform.id,
        modelId,
        'temperature',
        'Temperature:',
        'number',
        settings.temperature !== undefined ? settings.temperature : (configDefaults.temperature || 0.7),
        'Controls randomness: lower values are more deterministic, higher values more creative.',
        { min: 0, max: 2, step: 0.1 }
      );
      container.appendChild(temperatureGroup);
    }
    
    // Top P setting (if supported by model)
    const supportsTopP = modelConfig ? modelConfig.supportsTopP !== false : true;
    if (supportsTopP) {
      const topPGroup = this.createSettingField(
        platform.id,
        modelId,
        'top-p',
        'Top P:',
        'number',
        settings.topP !== undefined ? settings.topP : (configDefaults.topP || 1.0),
        'Alternative to temperature, controls diversity via nucleus sampling.',
        { min: 0, max: 1, step: 0.01 }
      );
      container.appendChild(topPGroup);
    }
    
    // System prompt setting (assumed supported unless specified otherwise)
    const systemGroup = document.createElement('div');
    systemGroup.className = 'form-group';
    
    const systemLabel = document.createElement('label');
    systemLabel.htmlFor = `${platform.id}-${modelId}-system-prompt`;
    systemLabel.textContent = 'System Prompt:';
    
    const systemInput = document.createElement('textarea');
    systemInput.id = `${platform.id}-${modelId}-system-prompt`;
    systemInput.className = 'system-prompt-input';
    systemInput.placeholder = 'Enter a system prompt for API requests';
    systemInput.value = settings.systemPrompt || '';
    
    const systemHelp = document.createElement('p');
    systemHelp.className = 'help-text';
    systemHelp.textContent = 'Optional system prompt to provide context for API requests.';
    
    systemGroup.appendChild(systemLabel);
    systemGroup.appendChild(systemInput);
    systemGroup.appendChild(systemHelp);
    
    container.appendChild(systemGroup);
    
    // Advanced settings actions
    const advancedActions = document.createElement('div');
    advancedActions.className = 'form-actions';
    
    const saveAdvancedBtn = document.createElement('button');
    saveAdvancedBtn.className = 'btn save-btn';
    saveAdvancedBtn.textContent = 'Save Settings';
    saveAdvancedBtn.addEventListener('click', () => {
      this.handleSaveAdvancedSettings(platform.id, modelId);
    });
    
    advancedActions.appendChild(saveAdvancedBtn);
    container.appendChild(advancedActions);
  }
  
  /**
   * Format price value for display
   * @param {number|string} price Price value
   * @returns {string} Formatted price
   */
  formatPrice(price) {
    // Ensure price is displayed with appropriate decimal places
    return typeof price === 'number' ? price.toFixed(2) : price;
  }
  
  /**
   * Create a setting field
   * @param {string} platformId Platform ID
   * @param {string} modelId Model ID
   * @param {string} settingId Setting ID
   * @param {string} label Field label
   * @param {string} type Input type
   * @param {any} value Current value
   * @param {string} helpText Help text
   * @param {Object} attributes Additional input attributes
   * @returns {HTMLElement} Form group element
   */
  createSettingField(platformId, modelId, settingId, label, type, value, helpText, attributes = {}) {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const labelElement = document.createElement('label');
    labelElement.htmlFor = `${platformId}-${modelId}-${settingId}`;
    labelElement.textContent = label;
    
    const input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
    if (type !== 'textarea') {
      input.type = type;
    }
    input.id = `${platformId}-${modelId}-${settingId}`;
    input.className = type === 'textarea' ? 'system-prompt-input' : 'settings-input';
    input.value = value;
    
    // Apply any additional attributes for non-textarea inputs
    if (type !== 'textarea') {
      Object.entries(attributes).forEach(([attr, val]) => {
        input.setAttribute(attr, val);
      });
    }
    
    const help = document.createElement('p');
    help.className = 'help-text';
    help.textContent = helpText;
    
    group.appendChild(labelElement);
    group.appendChild(input);
    group.appendChild(help);
    
    return group;
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
  }
  
  /**
   * Handle platform selection
   * @param {string} platformId Platform ID
   */
  handlePlatformSelect(platformId) {
    if (this.selectedPlatformId === platformId) return;
    
    this.selectedPlatformId = platformId;
    // Set selectedModelId to the first model if available
    const platform = this.platforms.find(p => p.id === platformId);
    if (platform && platform.apiConfig?.models?.length > 0) {
      this.selectedModelId = platform.apiConfig.models[0].id;
    } else {
      this.selectedModelId = null;
    }
    this.render();
  }
  
  /**
   * Handle model selection for advanced settings
   * @param {string} platformId Platform ID
   * @param {string} modelId Model ID
   */
  handleModelSelect(platformId, modelId) {
    this.selectedModelId = modelId;
    
    // Get the advanced settings container
    const container = document.getElementById(`${platformId}-advanced-settings-container`);
    if (!container) return;
    
    // Get the platform object
    const platform = this.platforms.find(p => p.id === platformId);
    if (!platform) return;
    
    // Render settings for the selected model
    this.renderModelAdvancedSettings(container, platform, modelId);
  }
  
  /**
   * Handle save credentials button click
   * @param {string} platformId Platform ID
   */
  async handleSaveCredentials(platformId) {
    const apiKeyInput = document.getElementById(`${platformId}-api-key`);
    const statusMessage = document.getElementById(`${platformId}-status`);
    
    if (!apiKeyInput || !statusMessage) {
      this.notificationManager.error('Failed to find form elements');
      return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      statusMessage.textContent = 'API key cannot be empty';
      statusMessage.className = 'status-message error';
      return;
    }
    
    // Disable input during save
    apiKeyInput.disabled = true;
    statusMessage.textContent = 'Saving...';
    statusMessage.className = 'status-message';
    
    try {
      const success = await this.apiSettingsController.saveCredentials(platformId, apiKey);
      
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
      // Re-enable input
      apiKeyInput.disabled = false;
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
    const statusMessage = document.getElementById(`${platformId}-status`);
    
    if (!apiKeyInput || !statusMessage) {
      this.notificationManager.error('Failed to find form elements');
      return;
    }
    
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      statusMessage.textContent = 'API key cannot be empty';
      statusMessage.className = 'status-message error';
      return;
    }
    
    // Show testing status
    statusMessage.textContent = 'Testing API key...';
    statusMessage.className = 'status-message';
    
    // Disable input during test
    apiKeyInput.disabled = true;
    
    try {
      const result = await this.apiSettingsController.testApiKey(platformId, apiKey);
      
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
      // Re-enable input
      apiKeyInput.disabled = false;
    }
  }
  
  /**
   * Handle save advanced settings button click
   * @param {string} platformId Platform ID
   * @param {string} modelId Model ID
   */
  async handleSaveAdvancedSettings(platformId, modelId) {
    try {
      // Get input values
      const maxTokensInput = document.getElementById(`${platformId}-${modelId}-max-tokens`);
      const contextWindowInput = document.getElementById(`${platformId}-${modelId}-context-window`);
      const temperatureInput = document.getElementById(`${platformId}-${modelId}-temperature`);
      const topPInput = document.getElementById(`${platformId}-${modelId}-top-p`);
      const systemPromptInput = document.getElementById(`${platformId}-${modelId}-system-prompt`);
      
      if (!maxTokensInput) {
        this.notificationManager.error('Failed to find form elements');
        return;
      }
      
      // Create settings object
      const settings = {};
      
      // Add max tokens
      const maxTokens = parseInt(maxTokensInput.value, 10);
      if (isNaN(maxTokens) || maxTokens < 50 || maxTokens > 32000) {
        this.notificationManager.error('Max tokens must be a number between 50 and 32000');
        return;
      }
      settings.maxTokens = maxTokens;
      
      // Add context window
      if (contextWindowInput) {
        const contextWindow = parseInt(contextWindowInput.value, 10);
        if (isNaN(contextWindow) || contextWindow < 1000 || contextWindow > 1000000) {
          this.notificationManager.error('Context window must be a number between 1,000 and 1,000,000');
          return;
        }
        settings.contextWindow = contextWindow;
      }
      
      // Add temperature if input exists
      if (temperatureInput) {
        const temperature = parseFloat(temperatureInput.value);
        if (isNaN(temperature) || temperature < 0 || temperature > 2) {
          this.notificationManager.error('Temperature must be a number between 0 and 2');
          return;
        }
        settings.temperature = temperature;
      }
      
      // Add topP if input exists
      if (topPInput) {
        const topP = parseFloat(topPInput.value);
        if (isNaN(topP) || topP < 0 || topP > 1) {
          this.notificationManager.error('Top P must be a number between 0 and 1');
          return;
        }
        settings.topP = topP;
      }
      
      // Add systemPrompt if input exists
      if (systemPromptInput) {
        settings.systemPrompt = systemPromptInput.value.trim();
      }
      
      // Save settings
      const success = await this.apiSettingsController.saveAdvancedSettings(platformId, settings, modelId);
      
      if (success) {
        // Refresh the UI with updated settings
        const platform = this.platforms.find(p => p.id === platformId);
        const container = document.getElementById(`${platformId}-advanced-settings-container`);
        if (platform && container) {
          this.renderModelAdvancedSettings(container, platform, modelId);
        }
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
        
        // If this was a model-specific update, just re-render that part
        if (data.modelId && this.selectedModelId === data.modelId) {
          const platform = this.platforms.find(p => p.id === data.platformId);
          const container = document.getElementById(`${data.platformId}-advanced-settings-container`);
          
          if (platform && container) {
            this.renderModelAdvancedSettings(container, platform, data.modelId);
            return;
          }
        }
        
        // Otherwise, re-render everything
        this.render();
      });
    }
  }
}

export default ApiSettingsTab;
// src/popup/ui/ModelSelector.js

/**
 * Component for selecting API models
 */
export default class ModelSelector {
  /**
   * Create a model selector
   * @param {HTMLElement} container - Container element
   * @param {Function} onChange - Change handler
   * @param {Object} statusManager - Status manager for notifications
   */
  constructor(container, onChange, statusManager = null) {
    this.container = container;
    this.onChange = onChange;
    this.statusManager = statusManager;
    this.models = [];
    this.selectedModelId = null;
    this.platformId = null;
    this.isVisible = false;
  }

  /**
   * Initialize the model selector
   * @param {string} platformId - Platform ID
   * @param {Array} models - Available models
   * @param {string} selectedModelId - Selected model ID
   */
  initialize(platformId, models = [], selectedModelId = null) {
    this.platformId = platformId;
    this.models = models;
    this.selectedModelId = selectedModelId || (models.length > 0 ? models[0].id : null);
    
    // Render the component
    this.render();
  }

  /**
   * Show/hide the model selector
   * @param {boolean} visible - Visibility state
   */
  setVisible(visible) {
    this.isVisible = visible;
    
    if (this.container) {
      this.container.style.display = visible ? 'block' : 'none';
    }
  }

  /**
   * Render the model selector
   */
  render() {
    if (!this.container) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    if (this.models.length === 0) {
      // Show no models message
      const noModelsMessage = document.createElement('div');
      noModelsMessage.className = 'no-models-message';
      noModelsMessage.textContent = 'No models available for this platform';
      this.container.appendChild(noModelsMessage);
      return;
    }
    
    // Create form group
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group model-selector-group';
    
    // Create label
    const label = document.createElement('label');
    label.htmlFor = 'modelSelector';
    label.className = 'model-selector-label';
    label.textContent = 'API Model:';
    
    // Create select element
    const select = document.createElement('select');
    select.id = 'modelSelector';
    select.className = 'model-selector-select';
    
    // Add model options
    this.models.forEach(model => {
      const option = document.createElement('option');
      
      // Handle both object models and string models
      const modelId = typeof model === 'object' ? model.id : model;
      const isDefault = typeof model === 'object' && model.isDefault;
      
      option.value = modelId;
      option.textContent = modelId + (isDefault ? ' (default)' : '');
      option.selected = modelId === this.selectedModelId;
      
      select.appendChild(option);
    });
    
    // Add change event listener
    select.addEventListener('change', this.handleModelChange.bind(this));
    
    // Store reference for later access
    this.selectElement = select;
    
    // Assemble form group
    formGroup.appendChild(label);
    formGroup.appendChild(select);
    
    // Add to container
    this.container.appendChild(formGroup);
    
    // Set initial visibility
    this.setVisible(this.isVisible);
  }

  /**
   * Handle model selection change
   * @param {Event} event - Change event
   */
  handleModelChange(event) {
    const newModelId = event.target.value;
    
    // Update selected model
    this.selectedModelId = newModelId;
    
    // Call onChange handler
    if (this.onChange) {
      this.onChange(newModelId, this.platformId);
    }
    
    // Show notification if status manager available
    if (this.statusManager) {
      this.statusManager.updateStatus(`Model set to ${newModelId}`);
    }
  }

  /**
   * Update available models
   * @param {string} platformId - Platform ID
   * @param {Array} models - Available models
   * @param {string} selectedModelId - Selected model ID
   */
  updateModels(platformId, models, selectedModelId = null) {
    this.platformId = platformId;
    this.models = models;
    this.selectedModelId = selectedModelId || (models.length > 0 ? models[0].id : null);
    
    // Re-render with new models
    this.render();
  }

  /**
   * Get the currently selected model ID
   * @returns {string} Selected model ID
   */
  getSelectedModelId() {
    return this.selectedModelId;
  }
}
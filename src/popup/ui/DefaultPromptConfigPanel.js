// popup/ui/DefaultPromptConfigPanel.js
// Removed constants import as we'll use param_name from config

export default class DefaultPromptConfigPanel {
  constructor(defaultPromptPreferencesService, contentType, onChange, statusManager = null) {
    this.service = defaultPromptPreferencesService;
    this.contentType = contentType;
    this.onChange = onChange;
    this.statusManager = statusManager;
    this.container = null;
    this.preferences = {};
    this.parameterOptions = {};
  }

  /**
   * Initialize the configuration panel
   * @param {HTMLElement} container - The container element
   */
  async initialize(container) {
    this.container = container;
    
    try {
      // Load preferences and parameter options
      [this.preferences, this.parameterOptions] = await Promise.all([
        this.service.getPreferences(this.contentType),
        this.service.getParameterOptions(this.contentType)
      ]);
      
      await this.render();
    } catch (error) {
      console.error('Error initializing default prompt config panel:', error);
      this.showError(error.message);
    }
  }

  /**
   * Render the configuration panel
   */
  async render() {
    if (!this.container) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create panel
    const panel = document.createElement('div');
    panel.className = 'default-prompt-config-panel';
    
    // Create form
    const form = document.createElement('div');
    form.className = 'config-panel-form';
    
    // Add parameters
    for (const [paramKey, paramOptions] of Object.entries(this.parameterOptions)) {
      // Skip if no options or values
      if (!paramOptions || !paramOptions.values || Object.keys(paramOptions.values).length === 0) continue;
      
      // Create parameter group
      const paramGroup = this.createParameterControl(paramKey, paramOptions);
      form.appendChild(paramGroup);
    }
    
    panel.appendChild(form);
    
    // Add to container
    this.container.appendChild(panel);
  }

  /**
   * Create a parameter control based on parameter type
   * @param {string} paramKey - The parameter key
   * @param {Object} paramOptions - The parameter options
   * @returns {HTMLElement} - The parameter control element
   */
  createParameterControl(paramKey, paramOptions) {
    // Skip displaying commentAnalysis parameter for non-YouTube content types
    if (paramKey === 'commentAnalysis' && this.contentType !== 'youtube') {
      return document.createElement('div'); // Return empty div to skip this parameter
    }
    
    // Skip type-specific instructions as they're not user-configurable
    if (paramKey === 'typeSpecificInstructions') {
      return document.createElement('div');
    }
    
    const group = document.createElement('div');
    group.className = 'config-param-group';
    
    const label = document.createElement('label');
    label.className = 'config-param-label';
    // Use param_name from the config instead of PARAMETER_LABELS
    label.textContent = paramOptions.param_name || paramKey;
    
    // For boolean parameters (true/false), use a toggle switch
    const values = paramOptions.values;
    if (Object.keys(values).length === 2 && 
        Object.keys(values).includes('true') && 
        Object.keys(values).includes('false')) {
      
      const toggle = document.createElement('div');
      toggle.className = 'toggle-switch';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `param-${paramKey}`;
      checkbox.checked = this.preferences[paramKey] === true || this.preferences[paramKey] === 'true';
      
      checkbox.addEventListener('change', () => {
        this.handleParameterChange(paramKey, checkbox.checked.toString());
      });
      
      const slider = document.createElement('span');
      slider.className = 'slider';

      // Add explicit click handler for the slider
      slider.addEventListener('click', () => {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      });
      
      toggle.appendChild(checkbox);
      toggle.appendChild(slider);
      
      group.appendChild(label);
      group.appendChild(toggle);
    } 
    // For other parameters, use a select dropdown
    else {
      const select = document.createElement('select');
      select.className = 'config-param-select';
      select.id = `param-${paramKey}`;
      
      // Add options - now iterating through values object
      for (const [optionKey, optionValue] of Object.entries(values)) {
        const option = document.createElement('option');
        option.value = optionKey;
        
        // We'll create a readable option name from the option key
        // This could be enhanced to extract a better label from the optionValue if needed
        option.textContent = this.formatOptionKey(optionKey);
        
        // Set selected option
        if (this.preferences[paramKey] === optionKey) {
          option.selected = true;
        }
        
        select.appendChild(option);
      }
      
      // Add change event listener
      select.addEventListener('change', () => {
        this.handleParameterChange(paramKey, select.value);
      });
      
      group.appendChild(label);
      group.appendChild(select);
    }
    
    return group;
  }

  /**
   * Format option key to make it readable
   * @param {string} key - The option key
   * @returns {string} - Formatted option name
   */
  formatOptionKey(key) {
    // Simple formatting: capitalize first letter and replace camelCase with spaces
    return key
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
  }

  /**
   * Handle parameter change
   * @param {string} paramKey - The parameter key
   * @param {string} value - The new value
   */
  async handleParameterChange(paramKey, value) {
    try {
      // Convert string boolean values to actual booleans
      const processedValue = value === 'true' ? true : (value === 'false' ? false : value);
      
      // Get human-readable value for notification
      const readableValue = this.formatOptionKey(value);
      
      // Update preferences
      this.preferences[paramKey] = processedValue;
      
      // Save preferences
      await this.service.savePreferences(this.contentType, { [paramKey]: processedValue });
      
      // Show notification
      if (this.statusManager) {
        this.statusManager.notifyParameterChanged(this.contentType, paramKey, readableValue);
      }
      
      // Notify parent component
      if (this.onChange) {
        this.onChange(this.preferences);
      }
    } catch (error) {
      console.error('Error updating parameter:', error);
    }
  }

  /**
   * Show error message
   * @param {string} message - The error message
   */
  showError(message) {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="error-message">
        Error: ${message}
      </div>
    `;
  }
}
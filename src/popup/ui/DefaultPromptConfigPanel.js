// popup/ui/DefaultPromptConfigPanel.js
import { PARAMETER_LABELS, PARAMETER_OPTIONS_LABELS } from '../constants.js';

export default class DefaultPromptConfigPanel {
  constructor(defaultPromptPreferencesService, contentType, onChange) {
    this.service = defaultPromptPreferencesService;
    this.contentType = contentType;
    this.onChange = onChange;
    this.container = null;
    this.preferences = {};
    this.parameterOptions = {};
  }

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

  async render() {
    if (!this.container) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create panel
    const panel = document.createElement('div');
    panel.className = 'default-prompt-config-panel';
    
    // Add title
    const title = document.createElement('h3');
    title.className = 'config-panel-title';
    title.textContent = 'Customize Default Prompt';
    panel.appendChild(title);
    
    // Create form
    const form = document.createElement('div');
    form.className = 'config-panel-form';
    
    // Add parameters
    for (const [paramKey, paramOptions] of Object.entries(this.parameterOptions)) {
      // Skip if no options
      if (!paramOptions || Object.keys(paramOptions).length === 0) continue;
      
      // Create parameter group
      const paramGroup = this.createParameterControl(paramKey, paramOptions);
      form.appendChild(paramGroup);
    }
    
    panel.appendChild(form);
    
    // Add to container
    this.container.appendChild(panel);
  }

  createParameterControl(paramKey, paramOptions) {
    const group = document.createElement('div');
    group.className = 'config-param-group';
    
    const label = document.createElement('label');
    label.className = 'config-param-label';
    label.textContent = PARAMETER_LABELS[paramKey] || paramKey;
    
    // For boolean parameters (true/false), use a toggle switch
    if (Object.keys(paramOptions).length === 2 && 
        Object.keys(paramOptions).includes('true') && 
        Object.keys(paramOptions).includes('false')) {
      
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
      
      // Add options
      for (const [optionKey, optionValue] of Object.entries(paramOptions)) {
        const option = document.createElement('option');
        option.value = optionKey;
        option.textContent = PARAMETER_OPTIONS_LABELS[paramKey]?.[optionKey] || optionKey;
        
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

  async handleParameterChange(paramKey, value) {
    try {
      // Convert string boolean values to actual booleans
      const processedValue = value === 'true' ? true : (value === 'false' ? false : value);
      
      // Update preferences
      this.preferences[paramKey] = processedValue;
      
      // Save preferences
      await this.service.savePreferences(this.contentType, { [paramKey]: processedValue });
      
      // Notify parent component
      if (this.onChange) {
        this.onChange(this.preferences);
      }
    } catch (error) {
      console.error('Error updating parameter:', error);
    }
  }

  showError(message) {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="error-message">
        Error: ${message}
      </div>
    `;
  }
}
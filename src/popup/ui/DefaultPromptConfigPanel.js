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
    this.eventMap = new Map(); // Track event listeners by element ID
    
    console.log('[EventTracker] DefaultPromptConfigPanel instantiated', {
      contentType: this.contentType
    });
  }

  async initializeWithData(container, preloadedPreferences, preloadedParameters) {
    console.log('[EventTracker] initializeWithData called', {
      containerId: container?.id,
      containerExists: !!container,
      prefsLoaded: !!preloadedPreferences,
      paramsLoaded: !!preloadedParameters
    });
    
    this.container = container;
    
    try {
      // Use preloaded data instead of fetching
      this.preferences = preloadedPreferences;
      this.parameterOptions = preloadedParameters;
      
      await this.render();
      this.logAllElementsWithListeners();
    } catch (error) {
      console.error('Error initializing default prompt config panel:', error);
      this.showError(error.message);
    }
  }

  async initialize(container) {
    console.log('[EventTracker] initialize called', {
      containerId: container?.id,
      containerExists: !!container
    });
    
    this.container = container;
    
    try {
      // Load preferences and parameter options
      console.log('[EventTracker] Fetching preferences and parameters...');
      [this.preferences, this.parameterOptions] = await Promise.all([
        this.service.getPreferences(this.contentType),
        this.service.getParameterOptions(this.contentType)
      ]);
      console.log('[EventTracker] Data fetched successfully');
      
      await this.render();
      this.logAllElementsWithListeners();
    } catch (error) {
      console.error('Error initializing default prompt config panel:', error);
      this.showError(error.message);
    }
  }

  async render() {
    console.log('[EventTracker] render called', { 
      containerExists: !!this.container,
      containerId: this.container?.id 
    });
    
    if (!this.container) {
      console.warn('[EventTracker] No container to render into');
      return;
    }
    
    // Clear container and event tracking
    console.log('[EventTracker] Clearing container and tracked events');
    this.container.innerHTML = '';
    this.eventMap.clear();
    
    // Create panel
    const panel = document.createElement('div');
    panel.className = 'default-prompt-config-panel';
    panel.id = 'default-prompt-panel-' + Date.now(); // Unique ID for tracking
    console.log('[EventTracker] Created panel element', { id: panel.id });
    
    // Add title
    const title = document.createElement('h3');
    title.className = 'config-panel-title';
    title.textContent = 'Customize Default Prompt';
    panel.appendChild(title);
    
    // Create form
    const form = document.createElement('div');
    form.className = 'config-panel-form';
    form.id = 'config-form-' + Date.now();
    console.log('[EventTracker] Created form element', { id: form.id });
    
    // Add parameters
    console.log('[EventTracker] Creating parameter controls...');
    let controlCount = 0;
    for (const [paramKey, paramOptions] of Object.entries(this.parameterOptions)) {
      // Skip if no options
      if (!paramOptions || Object.keys(paramOptions).length === 0) {
        console.log('[EventTracker] Skipping empty param', { paramKey });
        continue;
      }
      
      // Create parameter group
      console.log('[EventTracker] Creating control for parameter', { paramKey });
      const paramGroup = this.createParameterControl(paramKey, paramOptions);
      form.appendChild(paramGroup);
      controlCount++;
    }
    console.log('[EventTracker] Added', controlCount, 'parameter controls');
    
    panel.appendChild(form);
    
    // Add panel to container with clean replacement
    console.log('[EventTracker] Appending panel to container');
    this.container.appendChild(panel);
    
    // Add debug click handler to entire container for event propagation testing
    this.container.addEventListener('click', this.debugContainerClick.bind(this));
    console.log('[EventTracker] Added debug click handler to container');
  }

  createParameterControl(paramKey, paramOptions) {
    const group = document.createElement('div');
    group.className = 'config-param-group';
    group.id = `param-group-${paramKey}-${Date.now()}`;
    
    const label = document.createElement('label');
    label.className = 'config-param-label';
    label.textContent = PARAMETER_LABELS[paramKey] || paramKey;
    
    console.log('[EventTracker] Creating parameter group', { 
      id: group.id, 
      paramKey,
      options: Object.keys(paramOptions)
    });
    
    // For boolean parameters (true/false), use a toggle switch
    if (Object.keys(paramOptions).length === 2 && 
        Object.keys(paramOptions).includes('true') && 
        Object.keys(paramOptions).includes('false')) {
      
      const toggle = document.createElement('div');
      toggle.className = 'toggle-switch';
      toggle.id = `toggle-${paramKey}-${Date.now()}`;
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `param-${paramKey}`;
      checkbox.checked = this.preferences[paramKey] === true || this.preferences[paramKey] === 'true';
      
      console.log('[EventTracker] Created toggle switch', {
        id: toggle.id,
        checkboxId: checkbox.id,
        initialState: checkbox.checked
      });
      
      const handleCheckboxChange = () => {
        console.log('[EventTracker] Checkbox changed', { 
          id: checkbox.id, 
          newState: checkbox.checked 
        });
        this.handleParameterChange(paramKey, checkbox.checked.toString());
      };
      
      // Store the handler reference
      this.eventMap.set(checkbox.id, handleCheckboxChange);
      
      checkbox.addEventListener('change', handleCheckboxChange);
      console.log('[EventTracker] Added change listener to checkbox', { id: checkbox.id });
      
      const slider = document.createElement('span');
      slider.className = 'slider';
      slider.id = `slider-${paramKey}-${Date.now()}`;

      const handleSliderClick = (event) => {
        console.log('[EventTracker] Slider clicked', { 
          id: slider.id, 
          target: event.target,
          currentTarget: event.currentTarget,
          checkboxId: checkbox.id,
          checkboxState: checkbox.checked
        });
        
        // Stop propagation to prevent double-firing
        event.stopPropagation();
        
        // Toggle checkbox
        checkbox.checked = !checkbox.checked;
        console.log('[EventTracker] Changed checkbox state via slider to', checkbox.checked);
        
        // Manually dispatch change event
        const changeEvent = new Event('change', { bubbles: true });
        checkbox.dispatchEvent(changeEvent);
        console.log('[EventTracker] Dispatched change event to checkbox');
      };
      
      // Store the handler reference
      this.eventMap.set(slider.id, handleSliderClick);
      
      slider.addEventListener('click', handleSliderClick);
      console.log('[EventTracker] Added click listener to slider', { id: slider.id });
      
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
      
      console.log('[EventTracker] Created select dropdown', { id: select.id });
      
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
      
      console.log('[EventTracker] Added', Object.keys(paramOptions).length, 'options to select', {
        id: select.id,
        selectedValue: select.value
      });
      
      const handleSelectChange = () => {
        console.log('[EventTracker] Select changed', { 
          id: select.id, 
          newValue: select.value 
        });
        this.handleParameterChange(paramKey, select.value);
      };
      
      // Store the handler reference
      this.eventMap.set(select.id, handleSelectChange);
      
      // Add change event listener
      select.addEventListener('change', handleSelectChange);
      console.log('[EventTracker] Added change listener to select', { id: select.id });
      
      group.appendChild(label);
      group.appendChild(select);
    }
    
    return group;
  }

  async handleParameterChange(paramKey, value) {
    console.log('[EventTracker] handleParameterChange called', {
      paramKey,
      value
    });
    
    try {
      // Convert string boolean values to actual booleans
      const processedValue = value === 'true' ? true : (value === 'false' ? false : value);
      
      // Update preferences
      this.preferences[paramKey] = processedValue;
      console.log('[EventTracker] Updated local preferences');
      
      // Save preferences
      console.log('[EventTracker] Saving preferences to storage...');
      await this.service.savePreferences(this.contentType, { [paramKey]: processedValue });
      console.log('[EventTracker] Preferences saved successfully');
      
      // Notify parent component
      if (this.onChange) {
        console.log('[EventTracker] Calling onChange callback');
        this.onChange(this.preferences);
      }
    } catch (error) {
      console.error('[EventTracker] Error updating parameter:', error);
    }
  }

  showError(message) {
    console.error('[EventTracker] Showing error', { message });
    
    if (!this.container) {
      console.warn('[EventTracker] No container to show error in');
      return;
    }
    
    this.container.innerHTML = `
      <div class="error-message">
        Error: ${message}
      </div>
    `;
  }
  
  // Debug helper methods
  
  debugContainerClick(event) {
    console.log('[EventTracker] Container click detected', {
      target: event.target.tagName,
      targetId: event.target.id,
      targetClass: event.target.className,
      path: this.getEventPath(event)
    });
  }
  
  getEventPath(event) {
    // Get event path for debugging
    const path = [];
    let currentElement = event.target;
    
    while (currentElement) {
      path.push({
        tag: currentElement.tagName,
        id: currentElement.id,
        class: currentElement.className
      });
      currentElement = currentElement.parentElement;
    }
    
    return path;
  }
  
  logAllElementsWithListeners() {
    console.log('[EventTracker] Elements with event listeners:', 
      Array.from(this.eventMap.keys()));
      
    // Check if elements exist in DOM
    this.eventMap.forEach((handler, id) => {
      const element = document.getElementById(id);
      console.log('[EventTracker] Element check:', {
        id,
        exists: !!element,
        tagName: element?.tagName,
        visible: element ? this.isElementVisible(element) : false,
        position: element ? this.getElementPosition(element) : null
      });
    });
  }
  
  isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           element.offsetWidth > 0 &&
           element.offsetHeight > 0;
  }
  
  getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height
    };
  }
}
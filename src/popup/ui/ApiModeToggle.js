// src/popup/ui/ApiModeToggle.js

/**
 * Toggle component for API Mode
 */
export default class ApiModeToggle {
  /**
   * Create an API mode toggle
   * @param {HTMLElement} container - Container element
   * @param {Function} onChange - Change handler
   * @param {Object} statusManager - Status manager for notifications
   */
  constructor(container, onChange, statusManager = null) {
    this.container = container;
    this.onChange = onChange;
    this.statusManager = statusManager;
    this.apiModeEnabled = false;
    this.platformId = null;
  }

  /**
   * Initialize the toggle component
   * @param {string} platformId - Current platform ID
   * @param {boolean} initialState - Initial toggle state
   */
  async initialize(platformId, initialState = false) {
    this.platformId = platformId;
    this.apiModeEnabled = initialState;
    
    // Render the toggle UI
    this.render();
    
    // Set initial state
    this.setEnabled(initialState);
  }

  /**
   * Render the toggle component
   */
  render() {
    if (!this.container) return;
    
    // Clear existing content
    this.container.innerHTML = '';
    
    // Create toggle container
    const toggleWrapper = document.createElement('div');
    toggleWrapper.className = 'api-mode-toggle-wrapper';
    
    // Create toggle label
    const label = document.createElement('label');
    label.className = 'api-mode-toggle-label';
    label.htmlFor = 'apiModeToggle';
    label.textContent = 'API Mode';
    
    // Create tooltip with info icon
    const tooltip = document.createElement('div');
    tooltip.className = 'api-mode-tooltip';
    tooltip.innerHTML = `
      <svg class="info-icon" viewBox="0 0 24 24" width="16" height="16">
        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
      </svg>
      <span class="tooltip-text">Process content directly via API instead of redirecting to web interface</span>
    `;
    
    label.appendChild(tooltip);
    
    // Create toggle switch
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'toggle-switch-container';
    
    // Create input checkbox
    this.toggleInput = document.createElement('input');
    this.toggleInput.type = 'checkbox';
    this.toggleInput.id = 'apiModeToggle';
    this.toggleInput.className = 'toggle-input';
    this.toggleInput.checked = this.apiModeEnabled;
    
    // Create toggle switch visual element
    const toggleSwitch = document.createElement('div');
    toggleSwitch.className = 'toggle-switch';

    // Add click event to switch toggle state
    toggleSwitch.addEventListener('click', () => {
      this.toggleInput.checked = !this.toggleInput.checked;
      this.toggleInput.dispatchEvent(new Event('change'));
    });
    
    // Add event listener
    this.toggleInput.addEventListener('change', this.handleToggle.bind(this));
    
    // Assemble toggle elements
    toggleContainer.appendChild(this.toggleInput);
    toggleContainer.appendChild(toggleSwitch);
    
    // Assemble all elements
    toggleWrapper.appendChild(label);
    toggleWrapper.appendChild(toggleContainer);
    
    // Add to container
    this.container.appendChild(toggleWrapper);
  }

  /**
   * Handle toggle change event
   * @param {Event} event - Change event
   */
  async handleToggle(event) {
    const isEnabled = event.target.checked;
    
    // Update internal state
    this.apiModeEnabled = isEnabled;
    
    // Update UI
    this.updateToggleState();
    
    // Call onChange handler
    if (this.onChange) {
      this.onChange(isEnabled, this.platformId);
    }
    
    // Show notification if status manager available
    if (this.statusManager) {
      const message = isEnabled 
        ? 'API Mode enabled - content will be processed directly' 
        : 'API Mode disabled - using web interface';
      
      this.statusManager.updateStatus(message);
    }
  }

  /**
   * Update toggle visual state
   */
  updateToggleState() {
    if (this.toggleInput) {
      this.toggleInput.checked = this.apiModeEnabled;
      
      // Update parent container class
      const wrapper = this.toggleInput.closest('.api-mode-toggle-wrapper');
      if (wrapper) {
        wrapper.classList.toggle('active', this.apiModeEnabled);
      }
    }
  }

  /**
   * Set toggle enabled state
   * @param {boolean} enabled - Enabled state
   */
  setEnabled(enabled) {
    this.apiModeEnabled = enabled;
    this.updateToggleState();
  }

  /**
   * Handle platform change
   * @param {string} platformId - New platform ID
   * @param {boolean} enabled - API mode enabled for this platform
   */
  async platformChanged(platformId, enabled) {
    this.platformId = platformId;
    this.apiModeEnabled = enabled;
    this.updateToggleState();
  }

  /**
   * Check if API mode is enabled
   * @returns {boolean} - Current enabled state
   */
  isEnabled() {
    return this.apiModeEnabled;
  }
}
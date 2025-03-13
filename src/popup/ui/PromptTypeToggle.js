// src/popup/ui/PromptTypeToggle.js
export default class PromptTypeToggle {
  constructor(element, onTypeChange, preferenceService = null, statusManager = null) {
    this.element = element;
    this.onTypeChange = onTypeChange;
    this.preferenceService = preferenceService;
    this.statusManager = statusManager;
    this.selectedType = 'default';
    this.contentType = null;
  }

  /**
   * Set the content type for this toggle
   * @param {string} contentType - The content type (general, reddit, youtube)
   */
  setContentType(contentType) {
    this.contentType = contentType;
  }

  /**
   * Initialize the toggle component
   */
  async initialize() {
    if (!this.element) return;
    
    // Load saved preference if available
    if (this.preferenceService && this.contentType) {
      try {
        this.selectedType = await this.preferenceService.getPromptTypePreference(this.contentType);
        
        // Set the correct radio button
        const radio = this.element.querySelector(`input[value="${this.selectedType}"]`);
        if (radio) {
          radio.checked = true;
        }
      } catch (error) {
        console.error('Error loading prompt type preference:', error);
      }
    }
    
    // Add event listeners
    const radioButtons = this.element.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        if (radio.checked) {
          const previousType = this.selectedType;
          this.selectedType = radio.value;
          
          // Update visual state for browsers that don't support :has
          this.updateVisualState();
          
          // Save preference if changed
          if (previousType !== this.selectedType && this.preferenceService && this.contentType) {
            try {
              await this.preferenceService.savePromptTypePreference(
                this.contentType, 
                this.selectedType === 'default'
              );
              
              // Show notification
              if (this.statusManager) {
                this.statusManager.notifyPromptTypeToggled(this.selectedType === 'default');
              }
            } catch (error) {
              console.error('Error saving prompt type preference:', error);
            }
          }
          
          // Call the callback
          if (this.onTypeChange) {
            this.onTypeChange(this.selectedType === 'default');
          }
        }
      });
    });
    
    // Initialize with proper state
    this.updateVisualState();
    
    // Call the callback with initial state
    if (this.onTypeChange) {
      this.onTypeChange(this.selectedType === 'default');
    }
  }
  
  /**
   * Update visual state of toggle options
   */
  updateVisualState() {
    const options = this.element.querySelectorAll('.toggle-option');
    options.forEach(option => {
      const radio = option.querySelector('input[type="radio"]');
      if (radio) {
        option.classList.toggle('selected', radio.checked);
      }
    });
  }
  
  /**
   * Set the toggle type
   * @param {boolean} isDefault - Whether to set to default (true) or custom (false)
   */
  async setType(isDefault) {
    const value = isDefault ? 'default' : 'custom';
    const radio = this.element.querySelector(`input[value="${value}"]`);
    
    if (radio && radio.value !== this.selectedType) {
      const previousType = this.selectedType;
      radio.checked = true;
      this.selectedType = value;
      this.updateVisualState();
      
      // Save preference if changed
      if (previousType !== this.selectedType && this.preferenceService && this.contentType) {
        try {
          await this.preferenceService.savePromptTypePreference(this.contentType, isDefault);
          
          // Show notification
          if (this.statusManager) {
            this.statusManager.notifyPromptTypeToggled(isDefault);
          }
        } catch (error) {
          console.error('Error saving prompt type preference:', error);
        }
      }
      
      // Call the callback
      if (this.onTypeChange) {
        this.onTypeChange(isDefault);
      }
    }
  }
}
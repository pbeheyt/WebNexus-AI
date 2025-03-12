// src/popup/ui/PromptTypeToggle.js
export default class PromptTypeToggle {
  constructor(element, onTypeChange) {
    this.element = element;
    this.onTypeChange = onTypeChange;
    this.selectedType = 'default';
  }

  initialize() {
    if (!this.element) return;
    
    const radioButtons = this.element.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (radio.checked) {
          this.selectedType = radio.value;
          
          // Update visual state for browsers that don't support :has
          this.updateVisualState();
          
          // Call the callback
          if (this.onTypeChange) {
            this.onTypeChange(this.selectedType === 'default');
          }
        }
      });
    });
    
    // Initialize with default state
    this.updateVisualState();
    if (this.onTypeChange) {
      this.onTypeChange(true);
    }
  }
  
  updateVisualState() {
    const options = this.element.querySelectorAll('.toggle-option');
    options.forEach(option => {
      const radio = option.querySelector('input[type="radio"]');
      if (radio) {
        option.classList.toggle('selected', radio.checked);
      }
    });
  }
  
  setType(isDefault) {
    const value = isDefault ? 'default' : 'custom';
    const radio = this.element.querySelector(`input[value="${value}"]`);
    if (radio && radio.value !== this.selectedType) {
      radio.checked = true;
      this.selectedType = value;
      this.updateVisualState();
      
      // Call the callback
      if (this.onTypeChange) {
        this.onTypeChange(isDefault);
      }
    }
  }
}
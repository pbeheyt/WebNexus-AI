// popup/ui/PromptSelector.js
export default class PromptSelector {
  constructor(element, onChange, onTypeChange) {
    this.element = element;
    this.onChange = onChange;
    this.onTypeChange = onTypeChange;
    this.selectedPromptId = null;
    
    // Set up event listener
    if (this.element) {
      this.element.addEventListener('change', (e) => {
        this.selectedPromptId = e.target.value;
        if (this.onChange) {
          this.onChange(this.selectedPromptId);
        }
        
        // Notify about prompt type change (default or custom)
        if (this.onTypeChange) {
          const isDefault = this.isSelectedPromptDefault();
          this.onTypeChange(isDefault);
        }
      });
    }
  }

  render(prompts, selectedPromptId) {
    if (!this.element || !prompts?.length) return;
    
    // Update selected ID
    this.selectedPromptId = selectedPromptId;
    
    // Clear existing options
    this.element.innerHTML = '';
    
    // Track default vs custom prompts for separator
    let hasDefault = false;
    let hasCustom = false;
    
    // Add options
    prompts.forEach(prompt => {
      if (prompt.isDefault) hasDefault = true;
      else hasCustom = true;
      
      const option = document.createElement('option');
      option.value = prompt.id;
      option.textContent = prompt.isDefault ? 
        `${prompt.name} (Default)` : prompt.name;
      
      this.element.appendChild(option);
    });
    
    // Add separator if we have both types
    if (hasDefault && hasCustom) {
      // Find position after default prompts
      const position = [...this.element.options].findIndex(opt => 
        !opt.text.includes('(Default)'));
      
      if (position > 0) {
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '─────────────────';
        this.element.insertBefore(separator, this.element.options[position]);
      }
    }
    
    // Set selected option
    if (selectedPromptId) {
      this.element.value = selectedPromptId;
      
      // Trigger type change event on initial render
      if (this.onTypeChange) {
        const isDefault = this.isSelectedPromptDefault();
        this.onTypeChange(isDefault);
      }
    }
  }

  isSelectedPromptDefault() {
    if (!this.element || !this.selectedPromptId) return false;
    
    const selectedOption = [...this.element.options].find(
      opt => opt.value === this.selectedPromptId
    );
    
    return selectedOption && selectedOption.text.includes('(Default)');
  }

  clear() {
    if (this.element) {
      this.element.innerHTML = '';
    }
  }
}
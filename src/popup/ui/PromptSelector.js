// popup/ui/PromptSelector.js
export default class PromptSelector {
  constructor(element, onChange) {
    this.element = element;
    this.onChange = onChange;
    
    // Set up event listener
    if (this.element) {
      this.element.addEventListener('change', (e) => {
        if (this.onChange) {
          this.onChange(e.target.value);
        }
      });
    }
  }

  render(prompts, selectedPromptId) {
    if (!this.element || !prompts?.length) return;
    
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
    }
  }

  clear() {
    if (this.element) {
      this.element.innerHTML = '';
    }
  }
}
// src/popup/ui/CustomPromptSelector.js
export default class CustomPromptSelector {
  constructor(element, promptService, onChange) {
    this.element = element;
    this.promptService = promptService;
    this.onChange = onChange;
    this.contentType = null;
    this.prompts = [];
    this.selectedPromptId = null;
  }

  async initialize(contentType) {
    if (!this.element) return;
    
    this.contentType = contentType;
    
    // Clear existing content
    this.element.innerHTML = '';
    
    try {
      // Get custom prompts for this content type
      const { prompts } = await this.promptService.loadCustomPrompts(contentType);
      this.prompts = prompts || [];
      
      if (this.prompts.length === 0) {
        this.showEmptyState();
        return;
      }
      
      // Create select element
      const select = document.createElement('select');
      select.className = 'custom-prompt-select';
      
      // Add options
      this.prompts.forEach(prompt => {
        const option = document.createElement('option');
        option.value = prompt.id;
        option.textContent = prompt.name;
        select.appendChild(option);
        
        // Select first one by default if none selected
        if (!this.selectedPromptId) {
          this.selectedPromptId = prompt.id;
        }
      });
      
      // Set selected option
      if (this.selectedPromptId) {
        select.value = this.selectedPromptId;
      }
      
      // Add change handler
      select.addEventListener('change', () => {
        this.selectedPromptId = select.value;
        if (this.onChange) {
          this.onChange(this.selectedPromptId);
        }
      });
      
      this.element.appendChild(select);
      
      // Call onChange with initial selection
      if (this.onChange && this.selectedPromptId) {
        this.onChange(this.selectedPromptId);
      }
    } catch (error) {
      console.error('Error loading custom prompts:', error);
      this.showError(error.message);
    }
  }

  showEmptyState() {
    this.element.innerHTML = `
      <div class="empty-custom-prompts">
        <p>No custom prompts available. Create one in settings.</p>
      </div>
    `;
  }
  
  showError(message) {
    this.element.innerHTML = `
      <div class="empty-custom-prompts error">
        <p>Error: ${message}</p>
      </div>
    `;
  }
  
  setSelectedPromptId(promptId) {
    this.selectedPromptId = promptId;
    
    // Update select element if it exists
    const select = this.element.querySelector('.custom-prompt-select');
    if (select) {
      select.value = promptId;
    }
  }
}
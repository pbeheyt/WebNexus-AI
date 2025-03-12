// src/popup/ui/CustomPromptSelector.js
export default class CustomPromptSelector {
  constructor(element, promptService, onChange) {
    this.element = element;
    this.promptService = promptService;
    this.onChange = onChange;
    this.contentType = null;
    this.prompts = [];
    this.selectedPromptId = null;
    
    // Track component lifecycle
    this.initialized = false;
    this.selectElement = null;
    this.handleSelectChange = null;
  }

  async initializeWithData(contentType, preloadedPrompts, preferredPromptId) {
    if (!this.element) return;
    
    // Clean up previous state
    this.cleanup();
    
    // Set new content type
    this.contentType = contentType;
    
    try {
      // Use preloaded data
      this.prompts = preloadedPrompts || [];
      
      // Default to preferred prompt if available
      if (preferredPromptId && !this.selectedPromptId) {
        this.selectedPromptId = preferredPromptId;
      }
      
      // Handle empty prompts case
      if (this.prompts.length === 0) {
        this.renderEmptyState();
        return;
      }
      
      // Select first prompt if none selected
      if (!this.selectedPromptId && this.prompts.length > 0) {
        this.selectedPromptId = this.prompts[0].id;
      }
      
      // Render the dropdown
      this.renderPromptSelector();
      
      // Call onChange with initial selection
      if (this.onChange && this.selectedPromptId) {
        this.onChange(this.selectedPromptId);
      }
      
      // Mark as initialized
      this.initialized = true;
      
    } catch (error) {
      console.error('Error loading custom prompts:', error);
      this.renderError(error.message);
    }
  }

  async initialize(contentType) {
    if (!this.element) return;
    
    // If already initialized with same content type, just update selected value if needed
    if (this.contentType === contentType && this.initialized && this.selectElement) {
      if (this.selectedPromptId && this.selectElement.value !== this.selectedPromptId) {
        this.selectElement.value = this.selectedPromptId;
      }
      return;
    }
    
    // Clean up previous state
    this.cleanup();
    
    // Set new content type
    this.contentType = contentType;
    
    try {
      // Get custom prompts for this content type
      const { prompts, preferredPromptId } = await this.promptService.loadCustomPrompts(contentType);
      this.prompts = prompts || [];
      
      // Default to preferred prompt if available
      if (preferredPromptId && !this.selectedPromptId) {
        this.selectedPromptId = preferredPromptId;
      }
      
      // Handle empty prompts case
      if (this.prompts.length === 0) {
        this.renderEmptyState();
        return;
      }
      
      // Select first prompt if none selected
      if (!this.selectedPromptId && this.prompts.length > 0) {
        this.selectedPromptId = this.prompts[0].id;
      }
      
      // Render the dropdown
      this.renderPromptSelector();
      
      // Call onChange with initial selection
      if (this.onChange && this.selectedPromptId) {
        this.onChange(this.selectedPromptId);
      }
      
      // Mark as initialized
      this.initialized = true;
      
    } catch (error) {
      console.error('Error loading custom prompts:', error);
      this.renderError(error.message);
    }
  }

  renderPromptSelector() {
    // Ensure the element is empty before rendering
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    // Create select element
    this.selectElement = document.createElement('select');
    this.selectElement.className = 'custom-prompt-select';
    
    // Add options
    this.prompts.forEach(prompt => {
      const option = document.createElement('option');
      option.value = prompt.id;
      option.textContent = prompt.name;
      option.selected = prompt.id === this.selectedPromptId;
      this.selectElement.appendChild(option);
    });
    
    // Create and store reference to the handler
    this.handleSelectChange = () => {
      this.selectedPromptId = this.selectElement.value;
      if (this.onChange) {
        this.onChange(this.selectedPromptId);
      }
    };
    
    // Add event listener with the referenced handler
    this.selectElement.addEventListener('change', this.handleSelectChange);
    
    // Append to container
    this.element.appendChild(this.selectElement);
  }

  renderEmptyState() {
    // Ensure the element is empty
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-custom-prompts';
    emptyState.innerHTML = '<p>No custom prompts available. Create one in settings.</p>';
    this.element.appendChild(emptyState);
  }
  
  renderError(message) {
    // Ensure the element is empty
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    const errorElement = document.createElement('div');
    errorElement.className = 'empty-custom-prompts error';
    errorElement.innerHTML = `<p>Error: ${message}</p>`;
    this.element.appendChild(errorElement);
  }
  
  cleanup() {
    // Remove event listeners to prevent memory leaks
    if (this.selectElement && this.handleSelectChange) {
      this.selectElement.removeEventListener('change', this.handleSelectChange);
      this.handleSelectChange = null;
    }
    
    // Clear DOM content
    while (this.element && this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    
    this.selectElement = null;
    this.initialized = false;
  }
  
  setSelectedPromptId(promptId) {
    this.selectedPromptId = promptId;
    
    // Update select element if it exists and is different
    if (this.selectElement && this.selectElement.value !== promptId) {
      this.selectElement.value = promptId;
      
      // Programmatically trigger change handler
      if (this.onChange) {
        this.onChange(promptId);
      }
    }
  }
  
  // Destroy component (call when navigating away)
  destroy() {
    this.cleanup();
    this.element = null;
    this.promptService = null;
    this.onChange = null;
    this.prompts = null;
    this.contentType = null;
    this.selectedPromptId = null;
  }
}
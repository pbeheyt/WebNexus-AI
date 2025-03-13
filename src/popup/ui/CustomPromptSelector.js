// src/popup/ui/CustomPromptSelector.js
export default class CustomPromptSelector {
  constructor(element, promptService, onChange, preferenceService = null, statusManager = null) {
    this.element = element;
    this.promptService = promptService;
    this.onChange = onChange;
    this.preferenceService = preferenceService;
    this.statusManager = statusManager;
    this.contentType = null;
    this.prompts = [];
    this.selectedPromptId = null;
    
    // Track component lifecycle
    this.initialized = false;
    this.selectElement = null;
    this.handleSelectChange = null;
  }

  /**
   * Initialize the custom prompt selector
   * @param {string} contentType - The content type (general, reddit, youtube)
   */
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
      
      // Try to load previously selected prompt ID
      if (this.preferenceService) {
        try {
          const savedPromptId = await this.preferenceService.getSelectedPromptId(contentType, false);
          if (savedPromptId && this.prompts.some(p => p.id === savedPromptId)) {
            this.selectedPromptId = savedPromptId;
          }
        } catch (error) {
          console.error('Error loading saved prompt ID:', error);
        }
      }
      
      // Default to preferred prompt if no selection yet
      if (!this.selectedPromptId && preferredPromptId) {
        this.selectedPromptId = preferredPromptId;
      }
      
      // Handle empty prompts case
      if (this.prompts.length === 0) {
        this.renderEmptyState();
        return;
      }
      
      // Select first prompt if still no selection
      if (!this.selectedPromptId && this.prompts.length > 0) {
        this.selectedPromptId = this.prompts[0].id;
      }
      
      // Render the dropdown
      this.renderPromptSelector();
      
      // Call onChange with initial selection
      if (this.onChange && this.selectedPromptId) {
        this.onChange(this.selectedPromptId);
      }
      
      // Save initial selection
      if (this.preferenceService && this.selectedPromptId) {
        try {
          await this.preferenceService.saveSelectedPromptId(
            this.contentType, 
            false, 
            this.selectedPromptId
          );
        } catch (error) {
          console.error('Error saving initial prompt selection:', error);
        }
      }
      
      // Mark as initialized
      this.initialized = true;
      
    } catch (error) {
      console.error('Error loading custom prompts:', error);
      this.renderError(error.message);
    }
  }

  /**
   * Render the prompt selector dropdown
   */
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
    this.handleSelectChange = async () => {
      const previousId = this.selectedPromptId;
      this.selectedPromptId = this.selectElement.value;
      
      // Find prompt name for notification
      const selectedPrompt = this.prompts.find(p => p.id === this.selectedPromptId);
      
      // Save selection if changed
      if (previousId !== this.selectedPromptId && this.preferenceService && this.contentType) {
        try {
          await this.preferenceService.saveSelectedPromptId(
            this.contentType, 
            false, 
            this.selectedPromptId
          );
          
          // Show notification
          if (this.statusManager && selectedPrompt) {
            this.statusManager.notifyCustomPromptChanged(selectedPrompt.name);
          }
        } catch (error) {
          console.error('Error saving prompt selection:', error);
        }
      }
      
      // Call onChange
      if (this.onChange) {
        this.onChange(this.selectedPromptId);
      }
    };
    
    // Add event listener with the referenced handler
    this.selectElement.addEventListener('change', this.handleSelectChange);
    
    // Append to container
    this.element.appendChild(this.selectElement);
  }

  /**
   * Render empty state message
   */
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
  
  /**
   * Render error message
   * @param {string} message - The error message
   */
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
  
  /**
   * Clean up component resources
   */
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
  
  /**
   * Set the selected prompt ID
   * @param {string} promptId - The prompt ID to select
   */
  async setSelectedPromptId(promptId) {
    const previousId = this.selectedPromptId;
    this.selectedPromptId = promptId;
    
    // Update select element if it exists and is different
    if (this.selectElement && this.selectElement.value !== promptId) {
      this.selectElement.value = promptId;
      
      // Find prompt name for notification
      const selectedPrompt = this.prompts.find(p => p.id === promptId);
      
      // Save selection if changed
      if (previousId !== promptId && this.preferenceService && this.contentType) {
        try {
          await this.preferenceService.saveSelectedPromptId(this.contentType, false, promptId);
          
          // Show notification
          if (this.statusManager && selectedPrompt) {
            this.statusManager.notifyCustomPromptChanged(selectedPrompt.name);
          }
        } catch (error) {
          console.error('Error saving prompt selection:', error);
        }
      }
      
      // Programmatically trigger change handler
      if (this.onChange) {
        this.onChange(promptId);
      }
    }
  }
  
  /**
   * Destroy component (call when navigating away)
   */
  destroy() {
    this.cleanup();
    this.element = null;
    this.promptService = null;
    this.onChange = null;
    this.prompts = null;
    this.contentType = null;
    this.selectedPromptId = null;
    this.preferenceService = null;
    this.statusManager = null;
  }
}
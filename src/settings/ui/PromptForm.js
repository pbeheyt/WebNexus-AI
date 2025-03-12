/**
 * Form component for creating and editing prompts
 * Manages the prompt creation/editing form within each tab with proper isolation
 */
export default class PromptForm {
  constructor(promptController, eventBus, notificationManager) {
    this.promptController = promptController;
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
    this.contentType = null;
    this.container = null;
    this.formElement = null;
    this.isEditing = false;
    this.currentPromptId = null;
    this.currentPrompt = null;
    this.isDestroyed = false;
    
    // Bind methods to preserve context
    this.handleSubmit = this.handleSubmit.bind(this);
    this.reset = this.reset.bind(this);
    this.handleTabChange = this.handleTabChange.bind(this);
    
    // Subscribe to events
    this.unsubscribeEdit = this.eventBus.subscribe('prompt:edit', this.handleEditEvent.bind(this));
    this.unsubscribeTabChange = this.eventBus.subscribe('tab:changed', this.handleTabChange);
  }

  /**
   * Handle prompt edit events
   * @param {Object} data - Event data containing id and prompt
   */
  handleEditEvent(data) {
    const { id, prompt } = data;
    // Only process edit events for the current content type
    if (prompt && prompt.type === this.contentType) {
      this.startEditing(id, prompt);
    }
  }

  /**
   * Handle tab change events to ensure proper form state
   * @param {string} activeContentType - The newly activated content type
   */
  handleTabChange(activeContentType) {
    if (this.contentType === activeContentType) {
      // Our tab became active, ensure form references are correct
      this.ensureFormReferences();
    }
  }

  /**
   * Ensure form references are up-to-date after DOM changes
   */
  ensureFormReferences() {
    if (!this.container || this.isDestroyed) return;
    
    // Re-query for the form element to ensure we have the latest reference
    const formSection = this.container.querySelector('.add-prompt-section');
    if (formSection) {
      this.formElement = formSection.querySelector('.add-prompt-form');
    }
  }

  /**
   * Initialize the form component
   * @param {HTMLElement} container - Container element for the form
   * @param {string} contentType - The content type this form manages (general, reddit, youtube)
   */
  initialize(container, contentType) {
    if (!container || this.isDestroyed) return;
    
    this.container = container;
    this.contentType = contentType;
    this.render();
    
    // Log initialization
    console.log(`[PromptForm] Initialized for content type: ${contentType}`);
  }

  /**
   * Render the form component
   */
  render() {
    if (!this.container || !this.contentType || this.isDestroyed) return;
    
    // Create form section
    const formSection = document.createElement('div');
    formSection.className = 'add-prompt-section';
    
    const heading = document.createElement('h3');
    heading.className = 'type-heading';
    heading.textContent = this.isEditing ? 'Edit Prompt' : 'Add New Prompt';
    
    const form = document.createElement('form');
    form.className = 'add-prompt-form';
    form.dataset.contentType = this.contentType; // Add data attribute for debugging
    if (this.isEditing) {
      form.classList.add('editing');
    }
    
    // Generate unique IDs based on content type
    const nameId = `prompt-name-${this.contentType}`;
    const contentId = `prompt-content-${this.contentType}`;
    
    // Name input
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    
    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = nameId;
    nameLabel.textContent = 'Prompt Name';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = nameId;
    nameInput.className = 'prompt-name-input';
    nameInput.placeholder = 'Give your prompt a descriptive name';
    nameInput.required = true;
    
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    
    // Content textarea
    const contentGroup = document.createElement('div');
    contentGroup.className = 'form-group';
    
    const contentLabel = document.createElement('label');
    contentLabel.htmlFor = contentId;
    contentLabel.textContent = 'Prompt Content';
    
    const contentInput = document.createElement('textarea');
    contentInput.id = contentId;
    contentInput.className = 'prompt-content-input';
    contentInput.placeholder = 'Enter your prompt content here...';
    contentInput.required = true;
    contentInput.rows = 10;
    
    contentGroup.appendChild(contentLabel);
    contentGroup.appendChild(contentInput);
    
    // Buttons
    const formActions = document.createElement('div');
    formActions.className = 'form-actions';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary cancel-btn';
    cancelBtn.textContent = 'Cancel';
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn save-btn';
    saveBtn.textContent = this.isEditing ? 'Update Prompt' : 'Save Prompt';
    
    formActions.appendChild(cancelBtn);
    formActions.appendChild(saveBtn);
    
    // Assemble form
    form.appendChild(nameGroup);
    form.appendChild(contentGroup);
    form.appendChild(formActions);
    
    // Add event listeners with explicit binding
    form.addEventListener('submit', this.handleSubmit);
    cancelBtn.addEventListener('click', this.reset);
    
    // Assemble section
    formSection.appendChild(heading);
    formSection.appendChild(form);
    
    // Replace existing form if it exists
    const existingForm = this.container.querySelector('.add-prompt-section');
    if (existingForm) {
      this.container.replaceChild(formSection, existingForm);
    } else {
      this.container.appendChild(formSection);
    }
    
    // Store reference to form
    this.formElement = form;
    
    // Fill form if editing
    if (this.isEditing && this.currentPrompt) {
      nameInput.value = this.currentPrompt.name || '';
      contentInput.value = this.currentPrompt.content || '';
    }
  }

  /**
   * Handle form submission
   * @param {Event} event - Submit event
   */
  async handleSubmit(event) {
    event.preventDefault();
    
    if (!this.formElement || this.isDestroyed) {
      console.error('[PromptForm] Form submission failed: No form element available');
      this.notificationManager.error('Form submission error. Please try again.');
      return;
    }
    
    // Use the proper tab-specific selector with content type
    const nameInput = this.formElement.querySelector(`#prompt-name-${this.contentType}`);
    const contentInput = this.formElement.querySelector(`#prompt-content-${this.contentType}`);
    
    if (!nameInput || !contentInput) {
      console.error('[PromptForm] Form inputs not found', { 
        contentType: this.contentType, 
        nameSelector: `#prompt-name-${this.contentType}`, 
        contentSelector: `#prompt-content-${this.contentType}`,
        formHTML: this.formElement.outerHTML.slice(0, 100) + '...' // Log truncated form HTML for debugging
      });
      this.notificationManager.error('Error accessing form fields');
      return;
    }
    
    const name = nameInput.value ? nameInput.value.trim() : '';
    const content = contentInput.value ? contentInput.value.trim() : '';
    
    // Add comprehensive logging for debugging
    console.log(`[PromptForm:${this.contentType}] Form submission:`, { 
      name, 
      content, 
      nameLength: name.length, 
      contentLength: content.length,
      isEditing: this.isEditing,
      currentPromptId: this.currentPromptId
    });
    
    if (!name || !content) {
      console.warn(`[PromptForm:${this.contentType}] Validation failed:`, { 
        hasName: !!name, 
        nameLength: name.length,
        hasContent: !!content, 
        contentLength: content.length 
      });
      this.notificationManager.show('Please fill in all required fields');
      return;
    }
    
    try {
      if (this.isEditing && this.currentPromptId) {
        // Update existing prompt
        console.log(`[PromptForm:${this.contentType}] Updating prompt ${this.currentPromptId}`);
        await this.promptController.updatePrompt(this.currentPromptId, {
          name,
          content,
          type: this.contentType
        });
        
        this.notificationManager.success('Prompt updated successfully');
      } else {
        // Create new prompt
        console.log(`[PromptForm:${this.contentType}] Creating new prompt`);
        await this.promptController.createPrompt(name, content, this.contentType);
        
        this.notificationManager.success('Prompt saved successfully');
      }
      
      // Reset form
      this.reset();
    } catch (error) {
      console.error(`[PromptForm:${this.contentType}] Error saving prompt:`, error);
      this.notificationManager.error(`Error saving prompt: ${error.message}`);
    }
  }

  /**
   * Start editing a prompt
   * @param {string} promptId - ID of the prompt to edit
   * @param {Object} prompt - The prompt data
   */
  startEditing(promptId, prompt) {
    if (this.isDestroyed) return;
    
    console.log(`[PromptForm:${this.contentType}] Start editing prompt:`, { promptId, prompt });
    
    this.isEditing = true;
    this.currentPromptId = promptId;
    this.currentPrompt = prompt;
    this.render();
    
    // Scroll to form with delay to ensure rendering completes
    setTimeout(() => {
      if (this.formElement && !this.isDestroyed) {
        this.formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }

  /**
   * Reset the form state
   */
  reset() {
    if (this.isDestroyed) return;
    
    console.log(`[PromptForm:${this.contentType}] Resetting form`);
    
    this.isEditing = false;
    this.currentPromptId = null;
    this.currentPrompt = null;
    
    if (this.formElement) {
      this.formElement.reset();
    }
    
    this.render();
  }

  /**
   * Change the content type managed by this form
   * @param {string} contentType - New content type
   */
  setContentType(contentType) {
    if (this.isDestroyed || this.contentType === contentType) return;
    
    console.log(`[PromptForm] Switching content type from ${this.contentType} to ${contentType}`);
    
    this.contentType = contentType;
    this.reset();
    this.render();
  }

  /**
   * Clean up resources when component is no longer needed
   */
  destroy() {
    console.log(`[PromptForm:${this.contentType}] Destroying component`);
    
    // Mark as destroyed
    this.isDestroyed = true;
    
    // Unsubscribe from events
    if (this.unsubscribeEdit) this.unsubscribeEdit();
    if (this.unsubscribeTabChange) this.unsubscribeTabChange();
    
    // Remove event listeners from DOM elements
    if (this.formElement) {
      this.formElement.removeEventListener('submit', this.handleSubmit);
      const cancelBtn = this.formElement.querySelector('.cancel-btn');
      if (cancelBtn) {
        cancelBtn.removeEventListener('click', this.reset);
      }
    }
    
    // Clear references
    this.formElement = null;
    this.container = null;
    this.currentPrompt = null;
  }
}
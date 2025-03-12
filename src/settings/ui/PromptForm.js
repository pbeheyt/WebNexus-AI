// Form for creating and editing prompts
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
    
    // Subscribe to edit event
    this.eventBus.subscribe('prompt:edit', ({ id, prompt }) => {
      this.startEditing(id, prompt);
    });
  }

  initialize(container, contentType) {
    this.container = container;
    this.contentType = contentType;
    this.render();
  }

  render() {
    if (!this.container) return;
    
    // Create form section
    const formSection = document.createElement('div');
    formSection.className = 'add-prompt-section';
    
    const heading = document.createElement('h3');
    heading.className = 'type-heading';
    heading.textContent = this.isEditing ? 'Edit Prompt' : 'Add New Prompt';
    
    const form = document.createElement('form');
    form.className = 'add-prompt-form';
    if (this.isEditing) {
      form.classList.add('editing');
    }
    
    // Name input
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    
    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = 'prompt-name';
    nameLabel.textContent = 'Prompt Name';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'prompt-name';
    nameInput.className = 'prompt-name-input';
    nameInput.placeholder = 'Give your prompt a descriptive name';
    nameInput.required = true;
    
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    
    // Content textarea
    const contentGroup = document.createElement('div');
    contentGroup.className = 'form-group';
    
    const contentLabel = document.createElement('label');
    contentLabel.htmlFor = 'prompt-content';
    contentLabel.textContent = 'Prompt Content';
    
    const contentInput = document.createElement('textarea');
    contentInput.id = 'prompt-content';
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
    
    // Add event listeners
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleSubmit();
    });
    
    cancelBtn.addEventListener('click', () => {
      this.reset();
    });
    
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
      nameInput.value = this.currentPrompt.name;
      contentInput.value = this.currentPrompt.content;
    }
  }

  async handleSubmit() {
    if (!this.formElement) return;
    
    const nameInput = this.formElement.querySelector('#prompt-name');
    const contentInput = this.formElement.querySelector('#prompt-content');
    
    const name = nameInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!name || !content) {
      this.notificationManager.show('Please fill in all required fields');
      return;
    }
    
    try {
      if (this.isEditing && this.currentPromptId) {
        // Update existing prompt
        await this.promptController.updatePrompt(this.currentPromptId, {
          name,
          content,
          type: this.contentType
        });
        
        this.notificationManager.success('Prompt updated successfully');
      } else {
        // Create new prompt
        await this.promptController.createPrompt(name, content, this.contentType);
        
        this.notificationManager.success('Prompt saved successfully');
      }
      
      // Reset form
      this.reset();
    } catch (error) {
      console.error('Error saving prompt:', error);
      this.notificationManager.error(`Error saving prompt: ${error.message}`);
    }
  }

  startEditing(promptId, prompt) {
    this.isEditing = true;
    this.currentPromptId = promptId;
    this.currentPrompt = prompt;
    this.render();
    
    // Scroll to form
    if (this.formElement) {
      this.formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  reset() {
    this.isEditing = false;
    this.currentPromptId = null;
    this.currentPrompt = null;
    
    if (this.formElement) {
      this.formElement.reset();
    }
    
    this.render();
  }

  setContentType(contentType) {
    this.contentType = contentType;
    this.reset();
    this.render();
  }
}
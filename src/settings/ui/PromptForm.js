// src/settings/ui/PromptForm.js
import { CONTENT_TYPES, CONTENT_TYPE_LABELS } from '../utils/constants.js';
import { SHARED_TYPE } from '../../shared/constants.js';

export default class PromptForm {
  constructor(promptController, eventBus, notificationManager) {
    this.promptController = promptController;
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
    this.container = null;
    this.isEditing = false;
    this.currentPromptId = null;
    this.currentPrompt = null;
    this.contentType = null;
    
    // Bind methods
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
    
    // Subscribe to events
    this.eventBus.subscribe('prompt:create', this.handleCreateEvent.bind(this));
    this.eventBus.subscribe('prompt:edit', this.handleEditEvent.bind(this));
  }

  initialize() {
    this.container = document.getElementById('detail-panel');
  }

  handleCreateEvent() {
    this.isEditing = false;
    this.currentPromptId = null;
    this.currentPrompt = null;
    this.contentType = null;
    this.render();
  }

  handleEditEvent(data) {
    this.isEditing = true;
    this.currentPromptId = data.id;
    this.currentPrompt = data.prompt;
    this.contentType = data.contentType;
    this.render();
  }

  render() {
    if (!this.container) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create form
    const form = document.createElement('form');
    form.className = 'add-prompt-form';
    form.addEventListener('submit', this.handleSubmit);
    
    const heading = document.createElement('h3');
    heading.className = 'type-heading';
    heading.textContent = this.isEditing ? 'Edit Prompt' : 'Create New Prompt';
    
    // Content type selection
    const typeGroup = document.createElement('div');
    typeGroup.className = 'form-group';
    
    const typeLabel = document.createElement('label');
    typeLabel.htmlFor = 'prompt-type';
    typeLabel.textContent = 'Content Type:';
    
    const typeSelect = document.createElement('select');
    typeSelect.id = 'prompt-type';
    
    // Add SHARED_TYPE to the selectable types
    const allTypes = {
      ...CONTENT_TYPE_LABELS,
      [SHARED_TYPE]: 'Shared Prompts'
    };
    
    Object.entries(allTypes).forEach(([type, label]) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = label;
      if (this.contentType === type) {
        option.selected = true;
      }
      typeSelect.appendChild(option);
    });
    
    // Set default if not editing
    if (!this.isEditing && !this.contentType) {
      typeSelect.value = CONTENT_TYPES.GENERAL;
      this.contentType = CONTENT_TYPES.GENERAL;
    }
    
    typeSelect.addEventListener('change', (e) => {
      this.contentType = e.target.value;
    });
    
    typeGroup.appendChild(typeLabel);
    typeGroup.appendChild(typeSelect);
    
    // Name input
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    
    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = 'prompt-name';
    nameLabel.textContent = 'Prompt Name:';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'prompt-name';
    nameInput.className = 'prompt-name-input';
    nameInput.placeholder = 'Give your prompt a descriptive name';
    nameInput.required = true;
    
    if (this.isEditing && this.currentPrompt) {
      nameInput.value = this.currentPrompt.name || '';
    }
    
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    
    // Content textarea
    const contentGroup = document.createElement('div');
    contentGroup.className = 'form-group';
    
    const contentLabel = document.createElement('label');
    contentLabel.htmlFor = 'prompt-content';
    contentLabel.textContent = 'Prompt Content:';
    
    const contentInput = document.createElement('textarea');
    contentInput.id = 'prompt-content';
    contentInput.className = 'prompt-content-input';
    contentInput.placeholder = 'Enter your prompt content here...';
    contentInput.required = true;
    contentInput.rows = 10;
    
    if (this.isEditing && this.currentPrompt) {
      contentInput.value = this.currentPrompt.content || '';
    }
    
    contentGroup.appendChild(contentLabel);
    contentGroup.appendChild(contentInput);
    
    // Form actions
    const actionGroup = document.createElement('div');
    actionGroup.className = 'form-actions';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', this.handleCancel);
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn';
    saveBtn.textContent = this.isEditing ? 'Update Prompt' : 'Create Prompt';
    
    actionGroup.appendChild(cancelBtn);
    actionGroup.appendChild(saveBtn);
    
    // Assemble form
    form.appendChild(heading);
    form.appendChild(typeGroup);
    form.appendChild(nameGroup);
    form.appendChild(contentGroup);
    form.appendChild(actionGroup);
    
    // Add to container
    this.container.appendChild(form);
  }

  async handleSubmit(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById('prompt-name');
    const contentInput = document.getElementById('prompt-content');
    const typeSelect = document.getElementById('prompt-type');
    
    if (!nameInput || !contentInput || !typeSelect) {
      this.notificationManager.error('Form inputs not found');
      return;
    }
    
    const name = nameInput.value.trim();
    const content = contentInput.value.trim();
    const contentType = typeSelect.value;
    
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
          type: contentType
        });
        
        this.notificationManager.success('Prompt updated successfully');
      } else {
        // Create new prompt
        await this.promptController.createPrompt(name, content, contentType);
        
        this.notificationManager.success('Prompt created successfully');
      }
      
      // Reset form by showing empty state
      this.showEmptyState();
    } catch (error) {
      console.error('Error saving prompt:', error);
      this.notificationManager.error(`Error saving prompt: ${error.message}`);
    }
  }

  handleCancel() {
    this.showEmptyState();
  }

  showEmptyState() {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="empty-state">
        <p>Select a prompt from the list or create a new one</p>
      </div>
    `;
    
    // Reset state
    this.isEditing = false;
    this.currentPromptId = null;
    this.currentPrompt = null;
    this.contentType = null;
  }
}
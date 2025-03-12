// Displays and manages the list of prompts
export default class PromptList {
  constructor(promptController, eventBus) {
    this.promptController = promptController;
    this.eventBus = eventBus;
    this.contentType = null;
    this.container = null;
    
    // Subscribe to events
    this.eventBus.subscribe('prompt:saved', () => this.render());
    this.eventBus.subscribe('prompt:deleted', () => this.render());
    this.eventBus.subscribe('prompt:preferred', () => this.render());
  }

  initialize(container, contentType) {
    this.container = container;
    this.contentType = contentType;
    this.render();
  }

  async render() {
    if (!this.container || !this.contentType) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    const heading = document.createElement('h3');
    heading.className = 'type-heading';
    heading.textContent = 'Prompts';
    this.container.appendChild(heading);
    
    try {
      // Get prompts for this type
      const { prompts, preferredPromptId } = await this.promptController.getPromptsByType(this.contentType);
      
      // Display message if no prompts
      if (prompts.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
          <p>No prompts available for ${this.contentType}. Add your first prompt below.</p>
        `;
        this.container.appendChild(emptyState);
      } else {
        // Create prompt elements
        prompts.forEach(({ id, prompt, isDefault, isPreferred }) => {
          const promptElement = this.createPromptElement(id, prompt, isDefault, isPreferred);
          this.container.appendChild(promptElement);
        });
      }
    } catch (error) {
      console.error('Error rendering prompt list:', error);
      
      const errorElement = document.createElement('div');
      errorElement.className = 'error-state';
      errorElement.textContent = `Error loading prompts: ${error.message}`;
      this.container.appendChild(errorElement);
    }
  }

  createPromptElement(id, prompt, isDefault, isPreferred) {
    const promptElement = document.createElement('div');
    promptElement.className = 'prompt-item';
    promptElement.dataset.id = id;
    
    if (isPreferred) {
      promptElement.classList.add('preferred-prompt');
    }
    
    promptElement.innerHTML = `
      <div class="prompt-header">
        <h3 class="prompt-title">
          ${prompt.name}
          <span class="badge ${isDefault ? 'badge-default' : 'badge-custom'}">
            ${isDefault ? 'Default' : 'Custom'}
          </span>
          ${isPreferred ? '<span class="badge badge-preferred">Preferred</span>' : ''}
        </h3>
        <div class="prompt-actions">
          ${isPreferred ? '' : '<button class="action-btn set-preferred-btn" title="Set as Preferred">⭐ Set Preferred</button>'}
          ${isDefault ? `` : `
            <button class="action-btn edit-btn" title="Edit">✏️ Edit</button>
            <button class="action-btn delete-btn" title="Delete">🗑️ Delete</button>
          `}
        </div>
      </div>
      <div class="prompt-content">${prompt.content.replace(/\n/g, '<br>')}</div>
    `;
    
    // Add event listeners
    const actionsDiv = promptElement.querySelector('.prompt-actions');
    
    // Add "Set as Preferred" functionality
    const setPreferredBtn = actionsDiv.querySelector('.set-preferred-btn');
    if (setPreferredBtn) {
      setPreferredBtn.addEventListener('click', () => {
        this.promptController.setPreferredPrompt(id, this.contentType);
      });
    }
    
    if (!isDefault) {
      // For custom prompts, we have edit and delete
      const editBtn = actionsDiv.querySelector('.edit-btn');
      const deleteBtn = actionsDiv.querySelector('.delete-btn');
      
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          this.eventBus.publish('prompt:edit', { id, prompt });
        });
      }
      
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (confirm(`Are you sure you want to delete the prompt "${prompt.name}"?`)) {
            this.promptController.deletePrompt(id, this.contentType);
          }
        });
      }
    }
    
    return promptElement;
  }

  setContentType(contentType) {
    this.contentType = contentType;
    this.render();
  }
}
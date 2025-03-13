// src/settings/ui/PromptList.js
import { CONTENT_TYPES, CONTENT_TYPE_LABELS } from '../utils/constants.js';

export default class PromptList {
  constructor(promptController, eventBus) {
    this.promptController = promptController;
    this.eventBus = eventBus;
    this.container = null;
    this.filterElement = null;
    this.selectedPromptId = null;
    this.filterValue = 'all';
    
    // Subscribe to events
    this.eventBus.subscribe('prompt:saved', () => this.render());
    this.eventBus.subscribe('prompt:deleted', () => this.render());
    this.eventBus.subscribe('prompt:preferred', () => this.render());
  }

  initialize() {
    this.container = document.getElementById('prompt-list');
    this.filterElement = document.getElementById('content-type-filter');
    
    if (this.filterElement) {
      this.filterElement.addEventListener('change', (e) => {
        this.filterValue = e.target.value;
        this.render();
      });
    }
    
    // Initialize new prompt button
    const newPromptBtn = document.getElementById('newPromptBtn');
    if (newPromptBtn) {
      newPromptBtn.addEventListener('click', () => {
        this.eventBus.publish('prompt:create');
      });
    }
    
    this.render();
  }

  async render() {
    if (!this.container) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    try {
      // Get all content types
      const allPrompts = await Promise.all(
        Object.values(CONTENT_TYPES).map(type => 
          this.promptController.getPromptsByType(type)
        )
      );
      
      // Combine and filter prompts
      let prompts = [];
      Object.values(CONTENT_TYPES).forEach((type, index) => {
        allPrompts[index].prompts.forEach(promptData => {
          // Only include custom prompts (filter out default prompts)
          if (!promptData.isDefault) {
            prompts.push({
              ...promptData,
              contentType: type,
              contentTypeLabel: CONTENT_TYPE_LABELS[type]
            });
          }
        });
      });
      
      // Apply filter
      if (this.filterValue !== 'all') {
        prompts = prompts.filter(item => item.contentType === this.filterValue);
      }
      
      // Sort prompts by update time (most recent first)
      prompts.sort((a, b) => {
        return new Date(b.prompt.updatedAt || 0) - new Date(a.prompt.updatedAt || 0);
      });
      
      // Display message if no prompts
      if (prompts.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
          <p>No prompts available${this.filterValue !== 'all' ? ` for ${CONTENT_TYPE_LABELS[this.filterValue]}` : ''}. Create a new prompt to get started.</p>
        `;
        this.container.appendChild(emptyState);
      } else {
        // Create prompt elements
        prompts.forEach(promptData => {
          const promptElement = this.createPromptListItem(promptData);
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

  createPromptListItem(promptData) {
    const { id, prompt, contentType, contentTypeLabel } = promptData;
    
    const promptElement = document.createElement('div');
    promptElement.className = 'prompt-item';
    promptElement.dataset.id = id;
    promptElement.dataset.type = contentType;
    
    if (id === this.selectedPromptId) {
      promptElement.classList.add('selected');
    }
    
    promptElement.innerHTML = `
      <div class="prompt-header">
        <h3 class="prompt-title">
          ${prompt.name}
        </h3>
      </div>
      <small>${contentTypeLabel}</small>
    `;
    
    // Add click event to select
    promptElement.addEventListener('click', () => {
      this.selectPrompt(id, prompt, contentType);
    });
    
    return promptElement;
  }

  selectPrompt(id, prompt, contentType) {
    // Deselect previous
    const previousSelected = this.container.querySelector('.prompt-item.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }
    
    // Select new
    const newSelected = this.container.querySelector(`.prompt-item[data-id="${id}"]`);
    if (newSelected) {
      newSelected.classList.add('selected');
    }
    
    // Update selected ID
    this.selectedPromptId = id;
    
    // Publish event
    this.eventBus.publish('prompt:selected', {
      id, 
      prompt, 
      contentType, 
      isDefault: false,
      isPreferred: false // Remove preferred status concept
    });
  }
}
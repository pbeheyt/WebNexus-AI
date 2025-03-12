// src/settings/ui/PromptDetail.js 
export default class PromptDetail {
  constructor(promptController, eventBus, notificationManager) {
    this.promptController = promptController;
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
    this.container = null;
    
    // Subscribe to events
    this.eventBus.subscribe('prompt:selected', this.handlePromptSelected.bind(this));
  }

  initialize() {
    this.container = document.getElementById('detail-panel');
  }

  handlePromptSelected(data) {
    this.render(data);
  }

  render(data) {
    if (!this.container || !data) return;
    
    const { id, prompt, contentType, isDefault, isPreferred } = data;
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create detail view
    const detailView = document.createElement('div');
    detailView.className = 'prompt-detail';
    
    const header = document.createElement('div');
    header.className = 'prompt-detail-header';
    
    const title = document.createElement('h3');
    title.className = 'prompt-detail-title';
    title.textContent = prompt.name;
    
    const badges = document.createElement('div');
    badges.innerHTML = `
      <span class="badge ${isDefault ? 'badge-default' : 'badge-custom'}">
        ${isDefault ? 'Default' : 'Custom'}
      </span>
      ${isPreferred ? '<span class="badge badge-preferred">Preferred</span>' : ''}
    `;
    
    header.appendChild(title);
    header.appendChild(badges);
    
    const meta = document.createElement('div');
    meta.className = 'prompt-detail-meta';
    
    const typeInfo = document.createElement('div');
    typeInfo.innerHTML = `<strong>Type:</strong> ${prompt.type}`;
    
    // Removed the dateInfo element that was showing last updated date
    
    meta.appendChild(typeInfo);
    // Removed appending dateInfo to meta
    
    const content = document.createElement('div');
    content.className = 'prompt-detail-content';
    content.textContent = prompt.content;
    
    const actions = document.createElement('div');
    actions.className = 'prompt-detail-actions';
    
    // Only show "Set as Preferred" if not already preferred
    if (!isPreferred) {
      const preferredBtn = document.createElement('button');
      preferredBtn.className = 'btn btn-secondary';
      preferredBtn.textContent = 'Set as Preferred';
      preferredBtn.addEventListener('click', () => this.handleSetPreferred(id, contentType));
      actions.appendChild(preferredBtn);
    }
    
    // Only show edit/delete for custom prompts
    if (!isDefault) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this.handleEdit(data));
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => this.handleDelete(id, prompt.name, contentType));
      
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
    }
    
    // Assemble detail view
    detailView.appendChild(header);
    detailView.appendChild(meta);
    detailView.appendChild(content);
    detailView.appendChild(actions);
    
    // Add to container
    this.container.appendChild(detailView);
  }

  async handleSetPreferred(id, contentType) {
    try {
      await this.promptController.setPreferredPrompt(id, contentType);
      this.notificationManager.success('Prompt set as preferred');
    } catch (error) {
      console.error('Error setting preferred prompt:', error);
      this.notificationManager.error(`Error: ${error.message}`);
    }
  }

  handleEdit(data) {
    this.eventBus.publish('prompt:edit', data);
  }

  async handleDelete(id, name, contentType) {
    if (confirm(`Are you sure you want to delete the prompt "${name}"?`)) {
      try {
        await this.promptController.deletePrompt(id, contentType);
        this.notificationManager.success('Prompt deleted successfully');
        
        // Show empty state
        this.container.innerHTML = `
          <div class="empty-state">
            <p>Select a prompt from the list or create a new one</p>
          </div>
        `;
      } catch (error) {
        console.error('Error deleting prompt:', error);
        this.notificationManager.error(`Error: ${error.message}`);
      }
    }
  }
}
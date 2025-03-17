// src/settings/ui/TemplateCustomizationTab.js
import ParameterEditor from './ParameterEditor.js';

export default class TemplateCustomizationTab {
  constructor(templateService, configManager, eventBus, notificationManager) {
    this.templateService = templateService;
    this.configManager = configManager;
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
    this.container = null;
    this.sharedParamsContainer = null;
    this.contentTypeParamsContainers = {};
    this.contentTypes = [
      { id: 'general', label: 'Web Content Parameters' },
      { id: 'reddit', label: 'Reddit Parameters' },
      { id: 'youtube', label: 'YouTube Parameters' },
      { id: 'pdf', label: 'PDF Document Parameters' },
      { id: 'selected_text', label: 'Selected Text Parameters' }
    ];
    
    // Bind event handlers
    this.handleParameterUpdated = this.handleParameterUpdated.bind(this);
    this.handleParameterAdded = this.handleParameterAdded.bind(this);
    this.handleParameterDeleted = this.handleParameterDeleted.bind(this);
    this.handleParameterValueAdded = this.handleParameterValueAdded.bind(this);
    this.handleParameterValueDeleted = this.handleParameterValueDeleted.bind(this);
    this.handleParameterReordered = this.handleParameterReordered.bind(this);
    this.handleParameterValueReordered = this.handleParameterValueReordered.bind(this);
    
    // Subscribe to events
    this.eventBus.subscribe('parameter:updated', this.handleParameterUpdated);
    this.eventBus.subscribe('parameter:added', this.handleParameterAdded);
    this.eventBus.subscribe('parameter:deleted', this.handleParameterDeleted);
    this.eventBus.subscribe('parameter:value:added', this.handleParameterValueAdded);
    this.eventBus.subscribe('parameter:value:deleted', this.handleParameterValueDeleted);
    this.eventBus.subscribe('parameter:reordered', this.handleParameterReordered);
    this.eventBus.subscribe('parameter:value:reordered', this.handleParameterValueReordered);
  }
  
  initialize(container) {
    this.container = container;
    this.render();
  }
  
  async render() {
    if (!this.container) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create tab structure
    const tabStructure = document.createElement('div');
    tabStructure.className = 'template-customization-container';
    
    // Add page header
    const header = document.createElement('div');
    header.className = 'customize-header';
    header.innerHTML = `
      <h2 class="type-heading">Customize Prompt Templates</h2>
      <p class="section-description">
        Customize the default prompt templates used by the extension. These templates are used when creating summaries.
      </p>
      <div class="template-actions">
        <button class="btn reset-templates-btn" id="resetTemplatesBtn">Reset to Default</button>
      </div>
    `;
    tabStructure.appendChild(header);
    
    // Add shared parameters section
    const sharedSection = this.createSection('Shared Parameters', 'shared');
    this.sharedParamsContainer = sharedSection.querySelector('.parameter-list');
    tabStructure.appendChild(sharedSection);
    
    // Add content-type specific sections
    this.contentTypes.forEach(type => {
      const section = this.createSection(type.label, type.id);
      this.contentTypeParamsContainers[type.id] = section.querySelector('.parameter-list');
      tabStructure.appendChild(section);
    });
    
    this.container.appendChild(tabStructure);
    
    // Set up reset button
    const resetBtn = document.getElementById('resetTemplatesBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', this.handleResetTemplates.bind(this));
    }
    
    // Load parameters
    await this.loadParameters();
  }
  
  createSection(title, id) {
    const section = document.createElement('div');
    section.className = 'template-section';
    section.dataset.section = id;
    
    const header = document.createElement('div');
    header.className = 'template-section-header';
    header.innerHTML = `
      <h3>${title}</h3>
      <div class="section-actions">
        <button class="btn add-parameter-btn" data-section="${id}">+ Add Parameter</button>
      </div>
    `;
    
    const parameterList = document.createElement('div');
    parameterList.className = 'parameter-list';
    parameterList.dataset.section = id;
    
    section.appendChild(header);
    section.appendChild(parameterList);
    
    // Add event listener for add parameter button
    const addBtn = header.querySelector('.add-parameter-btn');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        const section = e.target.dataset.section;
        this.showAddParameterDialog(section);
      });
    }
    
    return section;
  }
  
  async loadParameters() {
    try {
      // Load shared parameters
      const sharedParams = await this.templateService.getParameters('shared');
      this.renderParameterList(sharedParams, this.sharedParamsContainer, 'shared');
      
      // Load content-type specific parameters
      for (const contentType of this.contentTypes) {
        const params = await this.templateService.getParameters(contentType.id);
        this.renderParameterList(params, this.contentTypeParamsContainers[contentType.id], 'content', contentType.id);
      }
    } catch (error) {
      console.error('Error loading parameters:', error);
      this.notificationManager.error(`Error loading parameters: ${error.message}`);
    }
  }
  
  renderParameterList(params, container, paramType, contentType = null) {
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    if (params.length === 0) {
      // Show empty state
      container.innerHTML = `
        <div class="empty-parameters">
          <p>No parameters found. Click "Add Parameter" to create one.</p>
        </div>
      `;
      return;
    }
    
    // Create parameter editor for each parameter
    params.forEach(param => {
      const editor = new ParameterEditor(
        this.templateService,
        this.eventBus,
        this.notificationManager
      );
      
      const editorElement = editor.render(param, paramType, contentType);
      container.appendChild(editorElement);
    });
  }
  
  showAddParameterDialog(section) {
    // Create modal dialog
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add New Parameter</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="parameter-name">Parameter Name:</label>
            <input type="text" id="parameter-name" placeholder="Enter parameter name">
          </div>
          <div class="form-group">
            <label for="parameter-default-key">Default Value Key:</label>
            <input type="text" id="parameter-default-key" placeholder="e.g., default, basic">
          </div>
          <div class="form-group">
            <label for="parameter-default-value">Default Value:</label>
            <textarea id="parameter-default-value" placeholder="Enter the default value content"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn cancel-btn">Cancel</button>
          <button class="btn add-btn">Add Parameter</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up event listeners
    const closeBtn = modal.querySelector('.close-modal');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const addBtn = modal.querySelector('.add-btn');
    
    const closeModal = () => {
      document.body.removeChild(modal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    addBtn.addEventListener('click', async () => {
      const name = modal.querySelector('#parameter-name').value.trim();
      const valueKey = modal.querySelector('#parameter-default-key').value.trim();
      const value = modal.querySelector('#parameter-default-value').value.trim();
      
      if (!name || !valueKey || !value) {
        this.notificationManager.show('All fields are required', 'error');
        return;
      }
      
      try {
        // Create new parameter
        const paramData = {
          param_name: name,
          values: { [valueKey]: value }
        };
        
        // Add parameter to appropriate section
        const contentType = section === 'shared' ? null : section;
        await this.templateService.addParameter(section === 'shared' ? 'shared' : contentType, paramData);
        
        this.notificationManager.success('Parameter added successfully');
        
        // Reload parameters
        await this.loadParameters();
        
        // Close modal
        closeModal();
      } catch (error) {
        console.error('Error adding parameter:', error);
        this.notificationManager.error(`Error adding parameter: ${error.message}`);
      }
    });
  }
  
  async handleResetTemplates() {
    if (confirm('Are you sure you want to reset all template customizations? This cannot be undone.')) {
      try {
        await this.configManager.resetConfig();
        this.notificationManager.success('Templates reset to default');
        await this.loadParameters();
      } catch (error) {
        console.error('Error resetting templates:', error);
        this.notificationManager.error(`Error resetting templates: ${error.message}`);
      }
    }
  }
  
  // Event handlers
  handleParameterUpdated() {
    this.loadParameters();
  }
  
  handleParameterAdded() {
    this.loadParameters();
  }
  
  handleParameterDeleted() {
    this.loadParameters();
  }
  
  handleParameterValueAdded() {
    this.loadParameters();
  }
  
  handleParameterValueDeleted() {
    this.loadParameters();
  }
  
  handleParameterReordered() {
    this.loadParameters();
  }
  
  handleParameterValueReordered() {
    this.loadParameters();
  }
}
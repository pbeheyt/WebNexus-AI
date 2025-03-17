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
    
    // Track expanded parameters
    this.expandedParameters = new Set();
    
    // Bind event handlers
    this.handleParameterUpdated = this.handleParameterUpdated.bind(this);
    this.handleParameterAdded = this.handleParameterAdded.bind(this);
    this.handleParameterDeleted = this.handleParameterDeleted.bind(this);
    this.handleParameterValueAdded = this.handleParameterValueAdded.bind(this);
    this.handleParameterValueDeleted = this.handleParameterValueDeleted.bind(this);
    this.handleParameterReordered = this.handleParameterReordered.bind(this);
    this.handleParameterValueReordered = this.handleParameterValueReordered.bind(this);
    this.handleParameterTypeChanged = this.handleParameterTypeChanged.bind(this);
    
    // Subscribe to events
    this.eventBus.subscribe('parameter:updated', this.handleParameterUpdated);
    this.eventBus.subscribe('parameter:added', this.handleParameterAdded);
    this.eventBus.subscribe('parameter:deleted', this.handleParameterDeleted);
    this.eventBus.subscribe('parameter:value:added', this.handleParameterValueAdded);
    this.eventBus.subscribe('parameter:value:deleted', this.handleParameterValueDeleted);
    this.eventBus.subscribe('parameter:reordered', this.handleParameterReordered);
    this.eventBus.subscribe('parameter:value:reordered', this.handleParameterValueReordered);
    this.eventBus.subscribe('parameter:type:changed', this.handleParameterTypeChanged);
    
    // Custom event listener for expansion toggling
    this.eventBus.subscribe('parameter:toggle:expansion', this.handleParameterExpansionToggle.bind(this));
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
    
    // Create a title wrapper for the collapsible functionality
    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'section-title-wrapper';
    
    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = title;
    
    const collapseIndicator = document.createElement('span');
    collapseIndicator.className = 'section-collapse-indicator';
    collapseIndicator.textContent = '▼';
    
    titleWrapper.appendChild(sectionTitle);
    titleWrapper.appendChild(collapseIndicator);
    
    const actions = document.createElement('div');
    actions.className = 'section-actions';
    
    const addBtn = document.createElement('button');
    addBtn.className = 'btn add-parameter-btn';
    addBtn.textContent = '+ Add Parameter';
    addBtn.dataset.section = id;
    addBtn.addEventListener('click', (e) => {
      const section = e.target.dataset.section;
      this.showAddParameterDialog(section);
    });
    
    actions.appendChild(addBtn);
    
    header.appendChild(titleWrapper);
    header.appendChild(actions);
    
    const parameterList = document.createElement('div');
    parameterList.className = 'parameter-list';
    parameterList.dataset.section = id;
    
    section.appendChild(header);
    section.appendChild(parameterList);
    
    // Make the section collapsible
    titleWrapper.addEventListener('click', () => {
      parameterList.classList.toggle('collapsed');
      collapseIndicator.textContent = parameterList.classList.contains('collapsed') ? '▶' : '▼';
    });
    
    return section;
  }
  
  async loadParameters() {
    try {
      // Save expanded state before reload
      this.saveExpandedState();
      
      // Load shared parameters
      const sharedParams = await this.templateService.getParameters('shared');
      this.renderParameterList(sharedParams, this.sharedParamsContainer, 'shared');
      
      // Load content-type specific parameters
      for (const contentType of this.contentTypes) {
        const params = await this.templateService.getParameters(contentType.id);
        this.renderParameterList(params, this.contentTypeParamsContainers[contentType.id], 'content', contentType.id);
      }
      
      // Restore expanded state after reload
      this.restoreExpandedState();
    } catch (error) {
      console.error('Error loading parameters:', error);
      this.notificationManager.error(`Error loading parameters: ${error.message}`);
    }
  }
  
  saveExpandedState() {
    // Clear previous expanded state
    this.expandedParameters.clear();
    
    // Collect IDs of currently expanded parameters
    const expandedEditors = document.querySelectorAll('.parameter-editor');
    expandedEditors.forEach(editor => {
      const toggleBtn = editor.querySelector('.toggle-details-btn');
      if (toggleBtn && toggleBtn.dataset.expanded === 'true') {
        this.expandedParameters.add(editor.dataset.id);
      }
    });
  }
  
  restoreExpandedState() {
    // Find all parameter editors and restore their expanded state
    const editors = document.querySelectorAll('.parameter-editor');
    editors.forEach(editor => {
      const parameterId = editor.dataset.id;
      if (this.expandedParameters.has(parameterId)) {
        const toggleBtn = editor.querySelector('.toggle-details-btn');
        if (toggleBtn) {
          // Simulate a click on the toggle button to expand
          this.expandParameter(editor, toggleBtn);
        }
      }
    });
  }
  
  expandParameter(editor, toggleBtn) {
    // Update toggle button state
    toggleBtn.dataset.expanded = 'true';
    toggleBtn.innerHTML = '▼';
    toggleBtn.title = 'Hide Details';
    
    // Show sections
    const typeSelector = editor.querySelector('.parameter-type-selector');
    const valuesSection = editor.querySelector('.parameter-values');
    const actionsSection = editor.querySelector('.parameter-actions');
    
    if (typeSelector) {
      typeSelector.style.display = 'block';
    }

    if (valuesSection) {
      valuesSection.style.display = 'block';
    }
    
    if (actionsSection) {
      actionsSection.style.display = 'flex';
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
            <label for="parameter-type">Parameter Type:</label>
            <select id="parameter-type">
              <option value="list">List (Multiple Options)</option>
              <option value="checkbox">Checkbox (True/False)</option>
              <option value="single">Single Value (Always Present)</option>
            </select>
            <p class="help-text">Choose the type of parameter you want to create. Type cannot be changed after creation.</p>
          </div>
          
          <!-- List Parameter Fields -->
          <div id="list-param-fields">
            <div class="form-group">
              <label for="list-default-key">Default Option Key:</label>
              <input type="text" id="list-default-key" placeholder="e.g., default, normal">
            </div>
            <div class="form-group">
              <label for="list-default-value">Default Option Value:</label>
              <textarea id="list-default-value" placeholder="Enter the default option content"></textarea>
            </div>
          </div>
          
          <!-- Checkbox Parameter Fields -->
          <div id="checkbox-param-fields" style="display: none;">
            <div class="form-group">
              <label for="checkbox-true-value">When Checked (True):</label>
              <textarea id="checkbox-true-value" placeholder="Enter content when option is checked"></textarea>
            </div>
            <div class="form-group">
              <label for="checkbox-false-value">When Unchecked (False):</label>
              <textarea id="checkbox-false-value" placeholder="Enter content when option is unchecked (usually empty)"></textarea>
            </div>
          </div>
          
          <!-- Single Value Parameter Fields -->
          <div id="single-param-fields" style="display: none;">
            <div class="form-group">
              <label for="single-value">Parameter Value:</label>
              <textarea id="single-value" placeholder="Enter the parameter value (always included in prompt)"></textarea>
            </div>
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
    
    // Toggle field visibility based on selected type
    const typeSelect = modal.querySelector('#parameter-type');
    const listFields = modal.querySelector('#list-param-fields');
    const checkboxFields = modal.querySelector('#checkbox-param-fields');
    const singleFields = modal.querySelector('#single-param-fields');
    
    typeSelect.addEventListener('change', () => {
      const paramType = typeSelect.value;
      
      listFields.style.display = paramType === 'list' ? 'block' : 'none';
      checkboxFields.style.display = paramType === 'checkbox' ? 'block' : 'none';
      singleFields.style.display = paramType === 'single' ? 'block' : 'none';
    });
    
    const closeModal = () => {
      document.body.removeChild(modal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    addBtn.addEventListener('click', async () => {
      const name = modal.querySelector('#parameter-name').value.trim();
      const type = typeSelect.value;
      
      if (!name) {
        this.notificationManager.error('Parameter name is required');
        return;
      }
      
      try {
        // Create parameter data based on type
        const paramData = {
          param_name: name,
          type: type
        };
        
        // Add type-specific data
        switch (type) {
          case 'list':
            const listKey = modal.querySelector('#list-default-key').value.trim();
            const listValue = modal.querySelector('#list-default-value').value.trim();
            
            if (!listKey || !listValue) {
              this.notificationManager.error('Default option key and value are required for list parameters');
              return;
            }
            
            paramData.values = { [listKey]: listValue };
            break;
            
          case 'checkbox':
            const trueValue = modal.querySelector('#checkbox-true-value').value.trim();
            const falseValue = modal.querySelector('#checkbox-false-value').value.trim();
            
            if (!trueValue) {
              this.notificationManager.error('True value is required for checkbox parameters');
              return;
            }
            
            paramData.values = {
              true: trueValue,
              false: falseValue
            };
            break;
            
          case 'single':
            const singleValue = modal.querySelector('#single-value').value.trim();
            
            if (!singleValue) {
              this.notificationManager.error('Value is required for single value parameters');
              return;
            }
            
            paramData.value = singleValue;
            break;
        }
        
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
        
        // Clear expanded state as we're resetting everything
        this.expandedParameters.clear();
        
        await this.loadParameters();
      } catch (error) {
        console.error('Error resetting templates:', error);
        this.notificationManager.error(`Error resetting templates: ${error.message}`);
      }
    }
  }
  
  // New handler for parameter expansion toggle events
  handleParameterExpansionToggle({ parameterId, isExpanded }) {
    if (isExpanded) {
      this.expandedParameters.add(parameterId);
    } else {
      this.expandedParameters.delete(parameterId);
    }
  }
  
  // New handler for parameter type change
  handleParameterTypeChanged() {
    this.loadParameters();
  }
  
  // Event handlers for parameters - preserve expanded state
  handleParameterUpdated() {
    this.loadParameters();
  }
  
  handleParameterAdded() {
    this.loadParameters();
  }
  
  handleParameterDeleted({ parameterId }) {
    // Remove from expanded set if it exists
    this.expandedParameters.delete(parameterId);
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
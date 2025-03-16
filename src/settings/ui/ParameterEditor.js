// src/settings/ui/ParameterEditor.js

export default class ParameterEditor {
  constructor(templateService, eventBus, notificationManager) {
    this.templateService = templateService;
    this.eventBus = eventBus;
    this.notificationManager = notificationManager;
  }
  
  render(parameter, paramType, contentType = null) {
    const editor = document.createElement('div');
    editor.className = 'parameter-editor';
    editor.dataset.id = parameter.id;
    editor.dataset.type = paramType;
    if (contentType) {
      editor.dataset.contentType = contentType;
    }
    
    // Parameter header (name editor and actions)
    const header = this.createNameEditor(parameter, paramType, contentType);
    
    // Values editor
    const valuesSection = this.createValuesEditor(parameter, paramType, contentType);
    
    // Add buttons for parameter actions
    const actions = document.createElement('div');
    actions.className = 'parameter-actions';
    
    const addValueBtn = document.createElement('button');
    addValueBtn.className = 'btn btn-sm add-value-btn';
    addValueBtn.innerHTML = '+ Add Value Option';
    addValueBtn.addEventListener('click', () => {
      this.showAddValueDialog(parameter, paramType, contentType);
    });
    
    const moveUpBtn = document.createElement('button');
    moveUpBtn.className = 'btn btn-sm move-up-btn';
    moveUpBtn.innerHTML = '↑ Move Up';
    moveUpBtn.addEventListener('click', () => {
      this.handleReorder(parameter, paramType, parameter.order - 1, contentType);
    });
    
    const moveDownBtn = document.createElement('button');
    moveDownBtn.className = 'btn btn-sm move-down-btn';
    moveDownBtn.innerHTML = '↓ Move Down';
    moveDownBtn.addEventListener('click', () => {
      this.handleReorder(parameter, paramType, parameter.order + 1, contentType);
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-sm btn-danger delete-param-btn';
    deleteBtn.innerHTML = 'Delete Parameter';
    deleteBtn.addEventListener('click', () => {
      this.handleDeleteParameter(parameter, paramType, contentType);
    });
    
    actions.appendChild(addValueBtn);
    actions.appendChild(moveUpBtn);
    actions.appendChild(moveDownBtn);
    actions.appendChild(deleteBtn);
    
    // Assemble editor
    editor.appendChild(header);
    editor.appendChild(valuesSection);
    editor.appendChild(actions);
    
    return editor;
  }
  
  createNameEditor(parameter, paramType, contentType) {
    const header = document.createElement('div');
    header.className = 'parameter-header';
    
    const nameWrapper = document.createElement('div');
    nameWrapper.className = 'parameter-name-wrapper';
    
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Parameter Name:';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'parameter-name-input';
    nameInput.value = parameter.param_name;
    nameInput.dataset.id = parameter.id;
    nameInput.dataset.type = paramType;
    if (contentType) {
      nameInput.dataset.contentType = contentType;
    }
    
    // Handle name change
    nameInput.addEventListener('blur', () => {
      const newName = nameInput.value.trim();
      if (newName && newName !== parameter.param_name) {
        this.handleNameChange(parameter, paramType, newName, contentType);
      } else {
        nameInput.value = parameter.param_name;
      }
    });
    
    // Also submit on Enter key
    nameInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        nameInput.blur();
      }
    });
    
    nameWrapper.appendChild(nameLabel);
    nameWrapper.appendChild(nameInput);
    
    // Custom parameter badge
    if (parameter.isCustom) {
      const badge = document.createElement('span');
      badge.className = 'custom-badge';
      badge.textContent = 'Custom';
      nameWrapper.appendChild(badge);
    }
    
    header.appendChild(nameWrapper);
    
    return header;
  }
  
  createValuesEditor(parameter, paramType, contentType) {
    const valuesSection = document.createElement('div');
    valuesSection.className = 'parameter-values';
    
    const valuesLabel = document.createElement('label');
    valuesLabel.className = 'values-label';
    valuesLabel.textContent = 'Value Options:';
    valuesSection.appendChild(valuesLabel);
    
    // Create editor for each value
    const valuesList = document.createElement('div');
    valuesList.className = 'values-list';
    
    Object.entries(parameter.values).forEach(([key, value]) => {
      const valueEditor = this.createValueEditor(parameter, paramType, key, value, contentType);
      valuesList.appendChild(valueEditor);
    });
    
    valuesSection.appendChild(valuesList);
    
    return valuesSection;
  }
  
  createValueEditor(parameter, paramType, key, value, contentType) {
    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'value-editor';
    valueWrapper.dataset.key = key;
    
    const keyLabel = document.createElement('div');
    keyLabel.className = 'value-key-label';
    keyLabel.textContent = key;
    
    const valueTextarea = document.createElement('textarea');
    valueTextarea.className = 'value-textarea';
    valueTextarea.value = value;
    valueTextarea.dataset.id = parameter.id;
    valueTextarea.dataset.key = key;
    valueTextarea.dataset.type = paramType;
    if (contentType) {
      valueTextarea.dataset.contentType = contentType;
    }
    
    // Handle value change
    valueTextarea.addEventListener('blur', () => {
      const newValue = valueTextarea.value;
      if (newValue !== value) {
        this.handleValueChange(parameter, paramType, key, newValue, contentType);
      }
    });
    
    const actions = document.createElement('div');
    actions.className = 'value-actions';
    
    // Only show delete button if there are multiple values
    if (Object.keys(parameter.values).length > 1) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-danger delete-value-btn';
      deleteBtn.innerHTML = 'Delete';
      deleteBtn.addEventListener('click', () => {
        this.handleDeleteValue(parameter, paramType, key, contentType);
      });
      actions.appendChild(deleteBtn);
    }
    
    valueWrapper.appendChild(keyLabel);
    valueWrapper.appendChild(valueTextarea);
    valueWrapper.appendChild(actions);
    
    return valueWrapper;
  }
  
  showAddValueDialog(parameter, paramType, contentType) {
    // Create modal dialog
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add Value Option</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="value-key">Value Key:</label>
            <input type="text" id="value-key" placeholder="e.g., detailed, technical">
            <p class="help-text">This is the internal identifier for the value option.</p>
          </div>
          <div class="form-group">
            <label for="value-content">Value Content:</label>
            <textarea id="value-content" placeholder="Enter the value content"></textarea>
            <p class="help-text">This is the actual template content that will be used in prompts.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn cancel-btn">Cancel</button>
          <button class="btn add-btn">Add Value</button>
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
      const valueKey = modal.querySelector('#value-key').value.trim();
      const valueContent = modal.querySelector('#value-content').value.trim();
      
      if (!valueKey || !valueContent) {
        this.notificationManager.show('Both fields are required', 'error');
        return;
      }
      
      try {
        await this.templateService.addParameterValue(
          contentType || 'shared',
          parameter.id,
          valueKey,
          valueContent
        );
        
        this.notificationManager.success('Value added successfully');
        
        // Publish event
        this.eventBus.publish('parameter:value:added', {
          paramType,
          contentType,
          parameterId: parameter.id,
          valueKey,
          value: valueContent
        });
        
        // Close modal
        closeModal();
      } catch (error) {
        console.error('Error adding value:', error);
        this.notificationManager.error(`Error adding value: ${error.message}`);
      }
    });
  }
  
  async handleNameChange(parameter, paramType, newName, contentType) {
    try {
      await this.templateService.updateParameterName(
        contentType || 'shared', 
        parameter.id, 
        newName
      );
      
      this.notificationManager.success('Parameter name updated');
      
      // Publish event
      this.eventBus.publish('parameter:updated', {
        paramType,
        contentType,
        parameterId: parameter.id,
        change: 'name',
        newValue: newName
      });
    } catch (error) {
      console.error('Error updating parameter name:', error);
      this.notificationManager.error(`Error updating name: ${error.message}`);
    }
  }
  
  async handleValueChange(parameter, paramType, valueKey, newValue, contentType) {
    try {
      await this.templateService.updateParameterValue(
        contentType || 'shared',
        parameter.id,
        valueKey,
        newValue
      );
      
      this.notificationManager.success('Value updated successfully');
      
      // Publish event
      this.eventBus.publish('parameter:updated', {
        paramType,
        contentType,
        parameterId: parameter.id,
        change: 'value',
        valueKey,
        newValue
      });
    } catch (error) {
      console.error('Error updating value:', error);
      this.notificationManager.error(`Error updating value: ${error.message}`);
    }
  }
  
  async handleDeleteValue(parameter, paramType, valueKey, contentType) {
    if (confirm(`Are you sure you want to delete the value "${valueKey}"?`)) {
      try {
        await this.templateService.removeParameterValue(
          contentType || 'shared',
          parameter.id,
          valueKey
        );
        
        this.notificationManager.success('Value deleted successfully');
        
        // Publish event
        this.eventBus.publish('parameter:value:deleted', {
          paramType,
          contentType,
          parameterId: parameter.id,
          valueKey
        });
      } catch (error) {
        console.error('Error deleting value:', error);
        this.notificationManager.error(`Error deleting value: ${error.message}`);
      }
    }
  }
  
  async handleReorder(parameter, paramType, newOrder, contentType) {
    try {
      await this.templateService.reorderParameter(
        contentType || 'shared',
        parameter.id,
        newOrder
      );
      
      this.notificationManager.success('Parameter reordered successfully');
      
      // Publish event
      this.eventBus.publish('parameter:reordered', {
        paramType,
        contentType,
        parameterId: parameter.id,
        newOrder
      });
    } catch (error) {
      console.error('Error reordering parameter:', error);
      this.notificationManager.error(`Error reordering parameter: ${error.message}`);
    }
  }
  
  async handleDeleteParameter(parameter, paramType, contentType) {
    if (confirm(`Are you sure you want to delete the parameter "${parameter.param_name}"?`)) {
      try {
        await this.templateService.deleteParameter(
          contentType || 'shared',
          parameter.id
        );
        
        this.notificationManager.success('Parameter deleted successfully');
        
        // Publish event
        this.eventBus.publish('parameter:deleted', {
          paramType,
          contentType,
          parameterId: parameter.id
        });
      } catch (error) {
        console.error('Error deleting parameter:', error);
        this.notificationManager.error(`Error deleting parameter: ${error.message}`);
      }
    }
  }
}
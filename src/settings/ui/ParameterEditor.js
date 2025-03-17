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
    editor.dataset.paramType = parameter.type || 'list';
    if (contentType) {
      editor.dataset.contentType = contentType;
    }

    // Parameter header (name editor, type badge, and actions)
    const header = this.createNameEditor(parameter, paramType, contentType);

    // Essential actions (always visible)
    const essentialActions = document.createElement('div');
    essentialActions.className = 'essential-parameter-actions';
    
    const moveUpBtn = document.createElement('button');
    moveUpBtn.className = 'btn btn-sm move-up-btn';
    moveUpBtn.innerHTML = '↑';
    moveUpBtn.title = 'Move Up';
    moveUpBtn.addEventListener('click', () => {
      this.handleReorder(parameter, paramType, parameter.order - 1, contentType);
    });

    const moveDownBtn = document.createElement('button');
    moveDownBtn.className = 'btn btn-sm move-down-btn';
    moveDownBtn.innerHTML = '↓';
    moveDownBtn.title = 'Move Down';
    moveDownBtn.addEventListener('click', () => {
      this.handleReorder(parameter, paramType, parameter.order + 1, contentType);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-sm btn-danger delete-param-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Delete Parameter';
    deleteBtn.addEventListener('click', () => {
      this.handleDeleteParameter(parameter, paramType, contentType);
    });

    essentialActions.appendChild(moveUpBtn);
    essentialActions.appendChild(moveDownBtn);
    essentialActions.appendChild(deleteBtn);

    // Create a header wrapper to hold the name and essential actions
    const headerWrapper = document.createElement('div');
    headerWrapper.className = 'parameter-header-wrapper';
    headerWrapper.style.display = 'flex';
    headerWrapper.style.justifyContent = 'space-between';
    headerWrapper.style.alignItems = 'center';
    headerWrapper.appendChild(header);
    headerWrapper.appendChild(essentialActions);

    // Values editor based on parameter type
    const valuesSection = this.createValuesEditor(parameter, paramType, contentType);
    
    // This section will be hidden by default
    valuesSection.style.display = 'none';

    // Add buttons for parameter actions
    const actions = document.createElement('div');
    actions.className = 'parameter-actions';
    actions.style.display = 'none';

    // Only show add value button for list type
    if (parameter.type === 'list') {
      const addValueBtn = document.createElement('button');
      addValueBtn.className = 'btn btn-sm add-value-btn';
      addValueBtn.innerHTML = '+ Add Value Option';
      addValueBtn.addEventListener('click', () => {
        this.showAddValueDialog(parameter, paramType, contentType);
      });
      actions.appendChild(addValueBtn);
    }

    // Assemble editor
    editor.appendChild(headerWrapper);
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
  
    // Create update button (initially hidden)
    const nameUpdateBtn = document.createElement('button');
    nameUpdateBtn.className = 'btn btn-sm parameter-update-btn';
    nameUpdateBtn.textContent = 'Update';
    nameUpdateBtn.style.marginLeft = '8px';
    nameUpdateBtn.style.display = 'none'; // Hide initially
    nameUpdateBtn.addEventListener('click', () => {
      const newName = nameInput.value.trim();
      if (newName && newName !== parameter.param_name) {
        this.handleNameChange(parameter, paramType, newName, contentType);
        // Provide visual feedback
        nameUpdateBtn.textContent = 'Updated ✓';
        setTimeout(() => { nameUpdateBtn.textContent = 'Update'; }, 1500);
      }
    });
  
    // Enter key to submit
    nameInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        nameUpdateBtn.click();
      }
    });
  
    nameWrapper.appendChild(nameLabel);
    nameWrapper.appendChild(nameInput);
    nameWrapper.appendChild(nameUpdateBtn);
  
    // Add parameter type badge (always visible)
    const typeBadge = document.createElement('span');
    typeBadge.className = 'type-badge';
    typeBadge.textContent = parameter.type || 'list';
    nameWrapper.appendChild(typeBadge);
  
    header.appendChild(nameWrapper);
  
    // Toggle button for expanding/collapsing details
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-details-btn';
    toggleBtn.innerHTML = '▶';
    toggleBtn.title = 'Show Details';
    toggleBtn.dataset.expanded = 'false';
    toggleBtn.style.marginLeft = '10px';
    toggleBtn.style.marginRight = '20px'; // Increased right padding
    
    toggleBtn.addEventListener('click', () => {
      const isExpanded = toggleBtn.dataset.expanded === 'true';
      const newState = !isExpanded;
      toggleBtn.dataset.expanded = newState.toString();
      toggleBtn.innerHTML = newState ? '▼' : '▶';
      toggleBtn.title = newState ? 'Hide Details' : 'Show Details';
  
      // Find the parent editor and toggle sections visibility
      const editor = toggleBtn.closest('.parameter-editor');
      const parameterId = editor.dataset.id;
      const valuesSection = editor.querySelector('.parameter-values');
      const actionsSection = editor.querySelector('.parameter-actions');
      
      // Show/hide update button based on expanded state
      const updateBtn = editor.querySelector('.parameter-update-btn');
      if (updateBtn) {
        updateBtn.style.display = newState ? 'inline-block' : 'none';
      }
  
      if (valuesSection) {
        valuesSection.style.display = newState ? 'block' : 'none';
      }
  
      if (actionsSection) {
        actionsSection.style.display = newState ? 'flex' : 'none';
      }
      
      // Notify about expansion state change
      this.eventBus.publish('parameter:toggle:expansion', {
        parameterId,
        isExpanded: newState
      });
    });
  
    nameWrapper.appendChild(toggleBtn);
    return header;
  }

  createValuesEditor(parameter, paramType, contentType) {
    const valuesSection = document.createElement('div');
    valuesSection.className = 'parameter-values';

    // Create different editor based on parameter type
    const parameterType = parameter.type || 'list';
    
    switch (parameterType) {
      case 'list':
        return this.createListValuesEditor(parameter, paramType, contentType);
      case 'checkbox':
        return this.createCheckboxValuesEditor(parameter, paramType, contentType);
      case 'single':
        return this.createSingleValueEditor(parameter, paramType, contentType);
      default:
        // Default to list editor
        return this.createListValuesEditor(parameter, paramType, contentType);
    }
  }

  createListValuesEditor(parameter, paramType, contentType) {
    const valuesSection = document.createElement('div');
    valuesSection.className = 'parameter-values list-parameter';

    const valuesLabel = document.createElement('label');
    valuesLabel.className = 'values-label';
    valuesLabel.textContent = 'List Options:';
    valuesSection.appendChild(valuesLabel);

    // Create editor for each value
    const valuesList = document.createElement('div');
    valuesList.className = 'values-list';

    // Get values as array to maintain order for display
    const valuesArray = Object.entries(parameter.values || {}).map(([key, value], index) => ({
      key,
      value,
      index
    }));

    valuesArray.forEach((entry, index) => {
      const valueEditor = this.createListValueEditor(parameter, paramType, entry.key, entry.value, contentType, index, valuesArray.length);
      valuesList.appendChild(valueEditor);
    });

    valuesSection.appendChild(valuesList);

    return valuesSection;
  }

  createCheckboxValuesEditor(parameter, paramType, contentType) {
    const valuesSection = document.createElement('div');
    valuesSection.className = 'parameter-values checkbox-parameter';

    const valuesLabel = document.createElement('label');
    valuesLabel.className = 'values-label';
    valuesLabel.textContent = 'Checkbox Options:';
    valuesSection.appendChild(valuesLabel);

    // Create true value editor
    const trueValueEditor = document.createElement('div');
    trueValueEditor.className = 'checkbox-value-editor';

    const trueLabel = document.createElement('label');
    trueLabel.textContent = 'When Checked (True):';
    trueValueEditor.appendChild(trueLabel);

    const trueTextarea = document.createElement('textarea');
    trueTextarea.className = 'value-textarea';
    trueTextarea.value = parameter.values?.true || '';
    trueTextarea.dataset.id = parameter.id;
    trueTextarea.dataset.key = 'true';
    trueTextarea.dataset.type = paramType;
    if (contentType) {
      trueTextarea.dataset.contentType = contentType;
    }

    // Add update button instead of blur event
    const trueUpdateBtn = document.createElement('button');
    trueUpdateBtn.className = 'btn btn-sm';
    trueUpdateBtn.textContent = 'Update';
    trueUpdateBtn.style.marginTop = '8px';
    trueUpdateBtn.addEventListener('click', () => {
      const newValue = trueTextarea.value;
      if (newValue !== (parameter.values?.true || '')) {
        this.handleValueChange(parameter, paramType, 'true', newValue, contentType);
        // Provide visual feedback
        trueUpdateBtn.textContent = 'Updated ✓';
        setTimeout(() => { trueUpdateBtn.textContent = 'Update'; }, 1500);
      }
    });

    trueValueEditor.appendChild(trueTextarea);
    trueValueEditor.appendChild(trueUpdateBtn);
    valuesSection.appendChild(trueValueEditor);

    // Create false value editor
    const falseValueEditor = document.createElement('div');
    falseValueEditor.className = 'checkbox-value-editor';

    const falseLabel = document.createElement('label');
    falseLabel.textContent = 'When Unchecked (False):';
    falseValueEditor.appendChild(falseLabel);

    const falseTextarea = document.createElement('textarea');
    falseTextarea.className = 'value-textarea';
    falseTextarea.value = parameter.values?.false || '';
    falseTextarea.dataset.id = parameter.id;
    falseTextarea.dataset.key = 'false';
    falseTextarea.dataset.type = paramType;
    if (contentType) {
      falseTextarea.dataset.contentType = contentType;
    }

    // Add update button instead of blur event
    const falseUpdateBtn = document.createElement('button');
    falseUpdateBtn.className = 'btn btn-sm';
    falseUpdateBtn.textContent = 'Update';
    falseUpdateBtn.style.marginTop = '8px';
    falseUpdateBtn.addEventListener('click', () => {
      const newValue = falseTextarea.value;
      if (newValue !== (parameter.values?.false || '')) {
        this.handleValueChange(parameter, paramType, 'false', newValue, contentType);
        // Provide visual feedback
        falseUpdateBtn.textContent = 'Updated ✓';
        setTimeout(() => { falseUpdateBtn.textContent = 'Update'; }, 1500);
      }
    });

    falseValueEditor.appendChild(falseTextarea);
    falseValueEditor.appendChild(falseUpdateBtn);
    valuesSection.appendChild(falseValueEditor);

    return valuesSection;
  }

  createSingleValueEditor(parameter, paramType, contentType) {
    const valuesSection = document.createElement('div');
    valuesSection.className = 'parameter-values single-parameter';

    const valueLabel = document.createElement('label');
    valueLabel.className = 'value-label';
    valueLabel.textContent = 'Parameter Value:';
    valuesSection.appendChild(valueLabel);

    const valueTextarea = document.createElement('textarea');
    valueTextarea.className = 'value-textarea';
    valueTextarea.value = parameter.value || '';
    valueTextarea.dataset.id = parameter.id;
    valueTextarea.dataset.type = paramType;
    if (contentType) {
      valueTextarea.dataset.contentType = contentType;
    }

    // Add update button instead of blur event
    const updateBtn = document.createElement('button');
    updateBtn.className = 'btn btn-sm';
    updateBtn.textContent = 'Update';
    updateBtn.style.marginTop = '8px';
    updateBtn.addEventListener('click', () => {
      const newValue = valueTextarea.value;
      if (newValue !== (parameter.value || '')) {
        this.handleSingleValueChange(parameter, paramType, newValue, contentType);
        // Provide visual feedback
        updateBtn.textContent = 'Updated ✓';
        setTimeout(() => { updateBtn.textContent = 'Update'; }, 1500);
      }
    });

    valuesSection.appendChild(valueTextarea);
    valuesSection.appendChild(updateBtn);

    return valuesSection;
  }

  createListValueEditor(parameter, paramType, key, value, contentType, index, totalValues) {
    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'value-editor';
    valueWrapper.dataset.key = key;
  
    // Create value header with move buttons
    const valueHeader = document.createElement('div');
    valueHeader.className = 'value-header';
  
    const keyLabel = document.createElement('div');
    keyLabel.className = 'value-key-label';
    keyLabel.textContent = key;
    valueHeader.appendChild(keyLabel);
  
    // Action buttons for value reordering
    const valueActions = document.createElement('div');
    valueActions.className = 'value-reorder-actions';
  
    // Only show up button if not first
    if (index > 0) {
      const moveUpBtn = document.createElement('button');
      moveUpBtn.type = 'button';
      moveUpBtn.className = 'btn btn-sm move-up-btn';
      moveUpBtn.innerHTML = '↑';
      moveUpBtn.title = 'Move Up';
      moveUpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleValueReorder(parameter, paramType, key, index - 1, contentType);
      });
      valueActions.appendChild(moveUpBtn);
    }
  
    // Only show down button if not last
    if (index < totalValues - 1) {
      const moveDownBtn = document.createElement('button');
      moveDownBtn.type = 'button';
      moveDownBtn.className = 'btn btn-sm move-down-btn';
      moveDownBtn.innerHTML = '↓';
      moveDownBtn.title = 'Move Down';
      moveDownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleValueReorder(parameter, paramType, key, index + 1, contentType);
      });
      valueActions.appendChild(moveDownBtn);
    }
  
    valueHeader.appendChild(valueActions);
    valueWrapper.appendChild(valueHeader);
  
    const valueTextarea = document.createElement('textarea');
    valueTextarea.className = 'value-textarea';
    valueTextarea.value = value;
    valueTextarea.dataset.id = parameter.id;
    valueTextarea.dataset.key = key;
    valueTextarea.dataset.type = paramType;
    if (contentType) {
      valueTextarea.dataset.contentType = contentType;
    }
  
    valueWrapper.appendChild(valueTextarea);
  
    // Add value actions (including update and delete)
    const actions = document.createElement('div');
    actions.className = 'value-actions';
  
    // Add update button
    const updateBtn = document.createElement('button');
    updateBtn.className = 'btn btn-sm';
    updateBtn.textContent = 'Update';
    updateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newValue = valueTextarea.value;
      if (newValue !== value) {
        this.handleValueChange(parameter, paramType, key, newValue, contentType);
        // Provide visual feedback
        updateBtn.textContent = 'Updated ✓';
        setTimeout(() => { updateBtn.textContent = 'Update'; }, 1500);
      }
    });
    actions.appendChild(updateBtn);
  
    // Only show delete button if there are multiple values
    if (Object.keys(parameter.values || {}).length > 1) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-danger delete-value-btn';
      deleteBtn.style.marginLeft = '8px';
      deleteBtn.innerHTML = 'Delete';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDeleteValue(parameter, paramType, key, contentType);
      });
      actions.appendChild(deleteBtn);
    }
  
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
        this.notificationManager.error('Both fields are required');
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

  async handleSingleValueChange(parameter, paramType, newValue, contentType) {
    try {
      await this.templateService.updateSingleValue(
        contentType || 'shared',
        parameter.id,
        newValue
      );

      this.notificationManager.success('Value updated successfully');

      // Publish event
      this.eventBus.publish('parameter:updated', {
        paramType,
        contentType,
        parameterId: parameter.id,
        change: 'single-value',
        newValue
      });
    } catch (error) {
      console.error('Error updating single value:', error);
      this.notificationManager.error(`Error updating value: ${error.message}`);
    }
  }

  async handleDeleteValue(parameter, paramType, key, contentType) {
    if (confirm(`Are you sure you want to delete the value "${key}"?`)) {
      try {
        await this.templateService.deleteParameterValue(
          contentType || 'shared',
          parameter.id,
          key
        );

        this.notificationManager.success('Value deleted successfully');

        // Publish event
        this.eventBus.publish('parameter:value:deleted', {
          paramType,
          contentType,
          parameterId: parameter.id,
          valueKey: key
        });
      } catch (error) {
        console.error('Error deleting value:', error);
        this.notificationManager.error(`Error deleting value: ${error.message}`);
      }
    }
  }

  async handleValueReorder(parameter, paramType, valueKey, newPosition, contentType) {
    try {
      await this.templateService.reorderParameterValue(
        contentType || 'shared',
        parameter.id,
        valueKey,
        newPosition
      );

      this.notificationManager.success('Value reordered successfully');

      // Publish event
      this.eventBus.publish('parameter:value:reordered', {
        paramType,
        contentType,
        parameterId: parameter.id,
        valueKey,
        newPosition
      });
    } catch (error) {
      console.error('Error reordering value:', error);
      this.notificationManager.error(`Error reordering value: ${error.message}`);
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
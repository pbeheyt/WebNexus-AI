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

    // Values editor
    const valuesSection = this.createValuesEditor(parameter, paramType, contentType);
    
    // This section will be hidden by default
    valuesSection.style.display = 'none';

    // Add buttons for parameter actions (these will be hidden by default)
    const actions = document.createElement('div');
    actions.className = 'parameter-actions';
    actions.style.display = 'none';

    const addValueBtn = document.createElement('button');
    addValueBtn.className = 'btn btn-sm add-value-btn';
    addValueBtn.innerHTML = '+ Add Value Option';
    addValueBtn.addEventListener('click', () => {
      this.showAddValueDialog(parameter, paramType, contentType);
    });

    actions.appendChild(addValueBtn);

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

    // Add toggle button for details - more discrete and initially collapsed
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-sm toggle-details-btn';
    toggleBtn.innerHTML = '▶';
    toggleBtn.title = 'Show Details';
    toggleBtn.style.fontSize = '10px';
    toggleBtn.style.padding = '2px 6px';
    toggleBtn.style.marginLeft = '6px';
    toggleBtn.style.opacity = '0.7';
    toggleBtn.dataset.expanded = 'false';
    toggleBtn.addEventListener('click', () => {
      const isExpanded = toggleBtn.dataset.expanded === 'true';
      const newState = !isExpanded;
      toggleBtn.dataset.expanded = newState.toString();
      toggleBtn.innerHTML = newState ? '▼' : '▶';
      toggleBtn.title = newState ? 'Hide Details' : 'Show Details';

      // Find the parent editor and toggle sections visibility
      const editor = toggleBtn.closest('.parameter-editor');
      const valuesSection = editor.querySelector('.parameter-values');
      const actionsSection = editor.querySelector('.parameter-actions');

      if (valuesSection) {
        valuesSection.style.display = newState ? 'block' : 'none';
      }

      if (actionsSection) {
        actionsSection.style.display = newState ? 'flex' : 'none';
      }
    });

    nameWrapper.appendChild(toggleBtn);
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

    // Get values as array to maintain order for display
    const valuesArray = Object.entries(parameter.values).map(([key, value], index) => ({
      key,
      value,
      index
    }));

    valuesArray.forEach((entry, index) => {
      const valueEditor = this.createValueEditor(parameter, paramType, entry.key, entry.value, contentType, index, valuesArray.length);
      valuesList.appendChild(valueEditor);
    });

    valuesSection.appendChild(valuesList);

    return valuesSection;
  }

  createValueEditor(parameter, paramType, key, value, contentType, index, totalValues) {
    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'value-editor';
    valueWrapper.dataset.key = key;

    // Create value header with move buttons
    const valueHeader = document.createElement('div');
    valueHeader.className = 'value-header';
    valueHeader.style.display = 'flex';
    valueHeader.style.justifyContent = 'space-between';
    valueHeader.style.alignItems = 'center';
    valueHeader.style.marginBottom = '5px';

    const keyLabel = document.createElement('div');
    keyLabel.className = 'value-key-label';
    keyLabel.textContent = key;
    valueHeader.appendChild(keyLabel);

    // Action buttons for value reordering
    const valueActions = document.createElement('div');
    valueActions.className = 'value-reorder-actions';
    valueActions.style.display = 'flex';
    valueActions.style.gap = '4px';

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

    // Handle value change
    valueTextarea.addEventListener('blur', () => {
      const newValue = valueTextarea.value;
      if (newValue !== value) {
        this.handleValueChange(parameter, paramType, key, newValue, contentType);
      }
    });

    valueWrapper.appendChild(valueTextarea);

    // Add value actions (like delete)
    const actions = document.createElement('div');
    actions.className = 'value-actions';

    // Only show delete button if there are multiple values
    if (Object.keys(parameter.values).length > 1) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-danger delete-value-btn';
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
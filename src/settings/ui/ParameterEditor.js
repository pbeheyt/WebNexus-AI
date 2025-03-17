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
    editor.dataset.paramType = parameter.type || 'list'; // Add parameter type as data attribute
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

    // Parameter type switcher
    const typeSelector = this.createTypeSelector(parameter, paramType, contentType);

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
    editor.appendChild(typeSelector);
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

    // Add parameter type badge
    const typeBadge = document.createElement('span');
    typeBadge.className = 'type-badge';
    typeBadge.textContent = parameter.type || 'list';
    nameWrapper.appendChild(typeBadge);

    header.appendChild(nameWrapper);

    // Toggle button for expanding/collapsing details
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
      const parameterId = editor.dataset.id;
      const typeSelector = editor.querySelector('.parameter-type-selector');
      const valuesSection = editor.querySelector('.parameter-values');
      const actionsSection = editor.querySelector('.parameter-actions');

      if (typeSelector) {
        typeSelector.style.display = newState ? 'block' : 'none';
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

  createTypeSelector(parameter, paramType, contentType) {
    const typeSelectorSection = document.createElement('div');
    typeSelectorSection.className = 'parameter-type-selector';
    typeSelectorSection.style.display = 'none';  // Hidden by default

    const typeSelectorLabel = document.createElement('label');
    typeSelectorLabel.textContent = 'Parameter Type:';
    typeSelectorSection.appendChild(typeSelectorLabel);

    const typeSelectorWrapper = document.createElement('div');
    typeSelectorWrapper.className = 'parameter-type-selector-wrapper';

    // Create a radio button group for parameter types
    const types = [
      { value: 'list', label: 'List (Multiple Options)' },
      { value: 'checkbox', label: 'Checkbox (True/False)' },
      { value: 'single', label: 'Single Value (Always Present)' }
    ];

    types.forEach(type => {
      const typeOption = document.createElement('div');
      typeOption.className = 'type-option';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `param-type-${parameter.id}`;
      radio.id = `param-type-${parameter.id}-${type.value}`;
      radio.value = type.value;
      radio.checked = (parameter.type || 'list') === type.value;

      const radioLabel = document.createElement('label');
      radioLabel.htmlFor = `param-type-${parameter.id}-${type.value}`;
      radioLabel.textContent = type.label;

      typeOption.appendChild(radio);
      typeOption.appendChild(radioLabel);
      typeSelectorWrapper.appendChild(typeOption);

      // Add event listener for type change
      radio.addEventListener('change', () => {
        if (radio.checked) {
          this.handleTypeChange(parameter, paramType, type.value, contentType);
        }
      });
    });

    typeSelectorSection.appendChild(typeSelectorWrapper);
    return typeSelectorSection;
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

    // Handle value change
    trueTextarea.addEventListener('blur', () => {
      const newValue = trueTextarea.value;
      if (newValue !== (parameter.values?.true || '')) {
        this.handleValueChange(parameter, paramType, 'true', newValue, contentType);
      }
    });

    trueValueEditor.appendChild(trueTextarea);
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

    // Handle value change
    falseTextarea.addEventListener('blur', () => {
      const newValue = falseTextarea.value;
      if (newValue !== (parameter.values?.false || '')) {
        this.handleValueChange(parameter, paramType, 'false', newValue, contentType);
      }
    });

    falseValueEditor.appendChild(falseTextarea);
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

    // Handle value change
    valueTextarea.addEventListener('blur', () => {
      const newValue = valueTextarea.value;
      if (newValue !== (parameter.value || '')) {
        this.handleSingleValueChange(parameter, paramType, newValue, contentType);
      }
    });

    valuesSection.appendChild(valueTextarea);

    return valuesSection;
  }

  createListValueEditor(parameter, paramType, key, value, contentType, index, totalValues) {
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
    if (Object.keys(parameter.values || {}).length > 1) {
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

  async handleTypeChange(parameter, paramType, newType, contentType) {
    try {
      // Prepare default values based on current parameter values if possible
      const defaultValues = {};
      
      switch (newType) {
        case 'list':
          // Convert existing values if possible
          if (parameter.type === 'checkbox' && parameter.values?.true) {
            defaultValues.values = {
              'enabled': parameter.values.true,
              'disabled': parameter.values.false || ''
            };
          } else if (parameter.type === 'single' && parameter.value) {
            defaultValues.values = {
              'default': parameter.value
            };
          }
          break;
          
        case 'checkbox':
          // Convert existing values if possible
          if (parameter.type === 'list' && Object.keys(parameter.values || {}).length > 0) {
            const firstKey = Object.keys(parameter.values)[0];
            defaultValues.values = {
              true: parameter.values[firstKey] || '',
              false: ''
            };
          } else if (parameter.type === 'single' && parameter.value) {
            defaultValues.values = {
              true: parameter.value,
              false: ''
            };
          }
          break;
          
        case 'single':
          // Convert existing values if possible
          if (parameter.type === 'list' && Object.keys(parameter.values || {}).length > 0) {
            const firstKey = Object.keys(parameter.values)[0];
            defaultValues.value = parameter.values[firstKey] || '';
          } else if (parameter.type === 'checkbox' && parameter.values?.true) {
            defaultValues.value = parameter.values.true;
          }
          break;
      }
      
      // Change parameter type
      await this.templateService.changeParameterType(
        contentType || 'shared',
        parameter.id,
        newType,
        defaultValues
      );

      this.notificationManager.success(`Parameter type changed to ${newType}`);

      // Publish event
      this.eventBus.publish('parameter:type:changed', {
        paramType,
        contentType,
        parameterId: parameter.id,
        newType
      });
    } catch (error) {
      console.error('Error changing parameter type:', error);
      this.notificationManager.error(`Error changing type: ${error.message}`);
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
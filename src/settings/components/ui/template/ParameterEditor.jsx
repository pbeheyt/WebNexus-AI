import React, { useState, useEffect } from 'react';
import Button from '../../common/Button';
import { useNotification } from '../../../contexts/NotificationContext';
import ValueEditor from './ValueEditor';

const ParameterEditor = ({
  parameter,
  isFirst,
  isLast,
  onReorder,
  onDelete,
  onUpdate
}) => {
  const { success, error } = useNotification();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [parameterName, setParameterName] = useState(parameter.param_name);
  const [showAddValueModal, setShowAddValueModal] = useState(false);
  const [newValueData, setNewValueData] = useState({ key: '', value: '' });
  const [valueErrors, setValueErrors] = useState({});
  
  // Move these hooks from renderSingleValue to the component top level
  const [singleValue, setSingleValue] = useState(parameter.value || '');
  const [hasChanges, setHasChanges] = useState(false);
  
  // Update singleValue when parameter.value changes
  useEffect(() => {
    setSingleValue(parameter.value || '');
    setHasChanges(false);
  }, [parameter.value]);
  
  // Handle parameter name change
  const handleNameChange = async () => {
    if (parameterName.trim() === parameter.param_name) {
      setIsEditingName(false);
      return;
    }
    
    if (!parameterName.trim()) {
      error('Instruction name cannot be empty');
      setParameterName(parameter.param_name);
      setIsEditingName(false);
      return;
    }
    
    try {
      const result = await onUpdate({ param_name: parameterName });
      if (result) {
        success('Instruction name updated');
      }
    } catch (err) {
      error('Failed to update instruction name');
      setParameterName(parameter.param_name);
    } finally {
      setIsEditingName(false);
    }
  };
  
  // Handle parameter value update
  const handleValueChange = async (valueKey, newValue) => {
    try {
      let updates;
      
      if (parameter.type === 'list' || parameter.type === 'checkbox') {
        // For list and checkbox types, update the values object
        updates = {
          values: {
            ...(parameter.values || {}),
            [valueKey]: newValue
          }
        };
      } else if (parameter.type === 'single') {
        // For single type, update the value directly
        updates = { value: newValue };
      }
      
      if (updates) {
        const result = await onUpdate(updates);
        if (result) {
          success('Value updated successfully');
        }
      }
    } catch (err) {
      error('Failed to update value');
    }
  };
  
  // Handle value deletion
  const handleDeleteValue = async (valueKey) => {
    if (!window.confirm(`Are you sure you want to delete the value "${valueKey}"?`)) {
      return;
    }
    
    try {
      if (parameter.type === 'list' || parameter.type === 'checkbox') {
        // Make a copy of values and remove the key
        const updatedValues = { ...parameter.values };
        delete updatedValues[valueKey];
        
        // Only allow deletion if there's at least one value left
        if (Object.keys(updatedValues).length === 0) {
          error('Cannot delete the last value. Instruction must have at least one value.');
          return;
        }
        
        const result = await onUpdate({ values: updatedValues });
        if (result) {
          success('Value deleted successfully');
        }
      }
    } catch (err) {
      error('Failed to delete value');
    }
  };
  
  // Open add value modal
  const handleOpenAddValueModal = () => {
    setNewValueData({ key: '', value: '' });
    setValueErrors({});
    setShowAddValueModal(true);
  };
  
  // Validate new value data
  const validateNewValue = () => {
    const errors = {};
    if (!newValueData.key.trim()) {
      errors.key = 'Option key is required';
    }
    if (!newValueData.value.trim()) {
      errors.value = 'Option value is required';
    }
    
    // Check if key already exists
    if (parameter.type === 'list' && 
        parameter.values && 
        parameter.values[newValueData.key] !== undefined) {
      errors.key = `Key "${newValueData.key}" already exists`;
    }
    
    setValueErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle adding a new value
  const handleAddValue = async () => {
    if (!validateNewValue()) {
      return;
    }
    
    try {
      // Create updated values object
      const updatedValues = {
        ...(parameter.values || {}),
        [newValueData.key]: newValueData.value
      };
      
      const result = await onUpdate({ values: updatedValues });
      if (result) {
        success('Value added successfully');
        setShowAddValueModal(false);
      }
    } catch (err) {
      error('Failed to add value');
    }
  };
  
  // Handle single value change
  const handleSingleValueChange = (e) => {
    setSingleValue(e.target.value);
    setHasChanges(e.target.value !== parameter.value);
  };
  
  // Update single value
  const updateSingleValue = () => {
    handleValueChange('value', singleValue);
    setHasChanges(false);
  };
  
  // Render the add value modal
  const renderAddValueModal = () => {
    if (!showAddValueModal) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-theme-primary rounded-lg w-[500px] max-w-[90%]">
          <div className="p-4 border-b border-theme flex items-center justify-between">
            <h3 className="text-lg font-medium">Add Value Option</h3>
            <button 
              className="text-2xl text-theme-secondary hover:text-theme-primary"
              onClick={() => setShowAddValueModal(false)}
            >
              &times;
            </button>
          </div>
          
          <div className="p-4">
            <div className="mb-4">
              <label className="block mb-1 text-sm font-medium text-theme-secondary">
                Option Key:
              </label>
              <input
                type="text"
                className={`w-full px-3 py-2 border ${valueErrors.key ? 'border-error' : 'border-theme'} rounded-md bg-theme-surface`}
                placeholder="e.g., detailed, technical"
                value={newValueData.key}
                onChange={(e) => {
                  setNewValueData(prev => ({ ...prev, key: e.target.value }));
                  if (valueErrors.key) setValueErrors(prev => ({ ...prev, key: null }));
                }}
              />
              {valueErrors.key && (
                <p className="text-error text-xs mt-1">{valueErrors.key}</p>
              )}
              <p className="text-xs text-theme-secondary mt-1">
                This is the internal identifier for the value option.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block mb-1 text-sm font-medium text-theme-secondary">
                Option Value:
              </label>
              <textarea
                className={`w-full px-3 py-2 border ${valueErrors.value ? 'border-error' : 'border-theme'} rounded-md bg-theme-surface min-h-[100px]`}
                placeholder="Enter the value content"
                value={newValueData.value}
                onChange={(e) => {
                  setNewValueData(prev => ({ ...prev, value: e.target.value }));
                  if (valueErrors.value) setValueErrors(prev => ({ ...prev, value: null }));
                }}
              />
              {valueErrors.value && (
                <p className="text-error text-xs mt-1">{valueErrors.value}</p>
              )}
              <p className="text-xs text-theme-secondary mt-1">
                This is the actual template content that will be used in prompts.
              </p>
            </div>
            
            <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-theme">
              <Button
                variant="secondary"
                onClick={() => setShowAddValueModal(false)}
              >
                Cancel
              </Button>
              
              <Button onClick={handleAddValue}>
                Add Value
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render values based on parameter type
  const renderValues = () => {
    switch (parameter.type) {
      case 'list':
        return renderListValues();
      case 'checkbox':
        return renderCheckboxValues();
      case 'single':
        return renderSingleValue();
      default:
        return null;
    }
  };
  
  // Render list-type values
  const renderListValues = () => {
    return (
      <div className="values-section mt-4">
        <h4 className="text-sm font-medium mb-2">List Options:</h4>
        
        <div className="values-list space-y-3">
          {parameter.values && Object.entries(parameter.values).map(([key, value], index) => (
            <ValueEditor
              key={key}
              valueKey={key}
              value={value}
              onValueChange={(newValue) => handleValueChange(key, newValue)}
              onDeleteValue={() => handleDeleteValue(key)}
              showDeleteButton={Object.keys(parameter.values).length > 1}
            />
          ))}
        </div>
        
        <Button
          size="sm"
          className="mt-4"
          onClick={handleOpenAddValueModal}
        >
          + Add Value Option
        </Button>
      </div>
    );
  };
  
  // Render checkbox-type values
  const renderCheckboxValues = () => {
    return (
      <div className="values-section mt-4">
        <h4 className="text-sm font-medium mb-2">Checkbox Options:</h4>
        
        <div className="checkbox-values space-y-3">
          <ValueEditor
            valueKey="true"
            value={parameter.values?.true || ''}
            onValueChange={(newValue) => handleValueChange('true', newValue)}
            onDeleteValue={null}
            showDeleteButton={false}
          />
          
          <ValueEditor
            valueKey="false"
            value={parameter.values?.false || ''}
            onValueChange={(newValue) => handleValueChange('false', newValue)}
            onDeleteValue={null}
            showDeleteButton={false}
          />
        </div>
      </div>
    );
  };
  
  // Render single-type value - FIXED: No longer declares state variables
  const renderSingleValue = () => {
    return (
      <div className="values-section mt-4">
        <h4 className="text-sm font-medium mb-2">Instruction Value:</h4>
        
        <textarea
          className="w-full px-3 py-2 border border-theme rounded-md bg-theme-surface text-theme-primary min-h-[100px]"
          value={singleValue}
          onChange={handleSingleValueChange}
        />
        
        <Button
          size="sm"
          variant={hasChanges ? "primary" : "inactive"}
          className="mt-2"
          onClick={updateSingleValue}
          disabled={!hasChanges}
        >
          Update
        </Button>
      </div>
    );
  };
  
  return (
    <div className="parameter-editor bg-theme-surface rounded-lg p-4 mb-4 border border-theme border-l-4 border-l-primary">
      <div className="parameter-header flex justify-between items-center">
        <div className="parameter-name-wrapper flex items-center">
          {isEditingName ? (
            <input
              type="text"
              className="parameter-name-input px-2 py-1 border border-theme rounded-md bg-theme-primary"
              value={parameterName}
              onChange={(e) => setParameterName(e.target.value)}
              onBlur={handleNameChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameChange();
                if (e.key === 'Escape') {
                  setParameterName(parameter.param_name);
                  setIsEditingName(false);
                }
              }}
              autoFocus
            />
          ) : (
            <div
              className="parameter-name font-medium cursor-pointer"
              onClick={() => setIsEditingName(true)}
            >
              {parameter.param_name}
            </div>
          )}
          
          <span className="type-badge ml-2 px-2 py-0.5 rounded text-xs font-medium uppercase bg-theme-hover text-theme-secondary">
            {parameter.type}
          </span>
          
          <button
            className="toggle-details-btn ml-3 text-xs text-theme-secondary opacity-80 hover:text-primary hover:opacity-100"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          
          <div className="flex-grow"></div>
        </div>
        
        <div className="essential-parameter-actions flex gap-2">
          {!isFirst && (
            <button
              className="btn btn-sm move-up-btn bg-theme-surface text-theme-primary border border-theme hover:bg-theme-hover px-1.5 py-0.5 rounded"
              onClick={() => onReorder(parameter.order - 1)}
              title="Move Up"
            >
              ↑
            </button>
          )}
          
          {!isLast && (
            <button
              className="btn btn-sm move-down-btn bg-theme-surface text-theme-primary border border-theme hover:bg-theme-hover px-1.5 py-0.5 rounded"
              onClick={() => onReorder(parameter.order + 1)}
              title="Move Down"
            >
              ↓
            </button>
          )}
          
          <button
            className="btn btn-sm btn-danger bg-error text-white hover:bg-red-600 px-1.5 py-0.5 rounded"
            onClick={onDelete}
            title="Delete Instruction"
          >
            ×
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <>
          {renderValues()}
          
          <div className="parameter-actions flex justify-end mt-4">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsExpanded(false)}
            >
              Close
            </Button>
          </div>
        </>
      )}
      
      {/* Add Value Modal */}
      {renderAddValueModal()}
    </div>
  );
};

export default ParameterEditor;
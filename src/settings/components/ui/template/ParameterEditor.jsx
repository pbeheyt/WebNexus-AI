import React, { useState } from 'react';
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
  
  // Handle parameter name change
  const handleNameChange = async () => {
    if (parameterName.trim() === parameter.param_name) {
      setIsEditingName(false);
      return;
    }
    
    if (!parameterName.trim()) {
      error('Parameter name cannot be empty');
      setParameterName(parameter.param_name);
      setIsEditingName(false);
      return;
    }
    
    try {
      const result = await onUpdate({ param_name: parameterName });
      if (result) {
        success('Parameter name updated');
      }
    } catch (err) {
      error('Failed to update parameter name');
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
          error('Cannot delete the last value. Parameter must have at least one value.');
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
  
  // Handle adding a new value
  const handleAddValue = async (valueKey, valueContent) => {
    try {
      if (!valueKey.trim() || !valueContent.trim()) {
        error('Value key and content are required');
        return;
      }
      
      if (parameter.type === 'list') {
        // Make sure the key doesn't already exist
        if (parameter.values && parameter.values[valueKey]) {
          error(`Value key "${valueKey}" already exists`);
          return;
        }
        
        const updatedValues = {
          ...(parameter.values || {}),
          [valueKey]: valueContent
        };
        
        const result = await onUpdate({ values: updatedValues });
        if (result) {
          success('Value added successfully');
        }
      }
    } catch (err) {
      error('Failed to add value');
    }
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
          onClick={() => {
            const key = prompt('Enter a key for the new value:');
            if (key) {
              handleAddValue(key, '');
            }
          }}
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
        
        <div className="checkbox-values space-y-4">
          <div className="checkbox-value">
            <h5 className="text-sm mb-1">When Checked (True):</h5>
            <textarea
              className="w-full px-3 py-2 border border-theme rounded-md bg-theme-surface text-theme-primary"
              value={parameter.values?.true || ''}
              onChange={(e) => handleValueChange('true', e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="checkbox-value">
            <h5 className="text-sm mb-1">When Unchecked (False):</h5>
            <textarea
              className="w-full px-3 py-2 border border-theme rounded-md bg-theme-surface text-theme-primary"
              value={parameter.values?.false || ''}
              onChange={(e) => handleValueChange('false', e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>
    );
  };
  
  // Render single-type value
  const renderSingleValue = () => {
    return (
      <div className="values-section mt-4">
        <h4 className="text-sm font-medium mb-2">Parameter Value:</h4>
        
        <textarea
          className="w-full px-3 py-2 border border-theme rounded-md bg-theme-surface text-theme-primary"
          value={parameter.value || ''}
          onChange={(e) => handleValueChange('value', e.target.value)}
          rows={4}
        />
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
        
        <div className="essential-parameter-actions flex gap-1">
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
            title="Delete Parameter"
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
    </div>
  );
};

export default ParameterEditor;
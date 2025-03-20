import React, { useState } from 'react';
import Button from '../../common/Button';

const AddParameterModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'list',
    listKey: '',
    listValue: '',
    trueValue: '',
    falseValue: '',
    singleValue: ''
  });
  
  // Add validation state
  const [validationErrors, setValidationErrors] = useState({});
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error for this field when it changes
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  const validate = () => {
    const errors = {};
    
    // Validate name
    if (!formData.name.trim()) {
      errors.name = 'Instruction name is required';
    }
    
    // Validate type-specific fields
    switch (formData.type) {
      case 'list':
        if (!formData.listKey.trim()) {
          errors.listKey = 'Option key is required';
        }
        if (!formData.listValue.trim()) {
          errors.listValue = 'Option value is required';
        }
        break;
      
      case 'checkbox':
        if (!formData.trueValue.trim()) {
          errors.trueValue = 'True value is required';
        }
        break;
      
      case 'single':
        if (!formData.singleValue.trim()) {
          errors.singleValue = 'Value is required';
        }
        break;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    // Create type-specific data
    let typeSpecificData = {};
    
    switch (formData.type) {
      case 'list':
        typeSpecificData = {
          values: {
            [formData.listKey]: formData.listValue
          }
        };
        break;
      
      case 'checkbox':
        typeSpecificData = {
          values: {
            true: formData.trueValue,
            false: formData.falseValue
          }
        };
        break;
      
      case 'single':
        typeSpecificData = {
          value: formData.singleValue
        };
        break;
    }
    
    onSubmit({
      name: formData.name,
      type: formData.type,
      typeSpecificData
    });
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-theme-primary rounded-lg w-[600px] max-w-[90%] max-h-[90vh] overflow-auto">
        <div className="p-4 border-b border-theme flex items-center justify-between">
          <h3 className="text-lg font-medium">Add New Instruction</h3>
          <button 
            className="text-2xl text-theme-secondary hover:text-theme-primary"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium text-theme-secondary">
              Instruction Name:
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-3 py-2 border ${validationErrors.name ? 'border-error' : 'border-theme'} rounded-md bg-theme-surface`}
              placeholder="Enter instruction name"
            />
            {validationErrors.name && (
              <p className="text-error text-xs mt-1">{validationErrors.name}</p>
            )}
          </div>
          
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium text-theme-secondary">
              Instruction Type:
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme rounded-md bg-theme-surface"
            >
              <option value="list">List (Multiple Options)</option>
              <option value="checkbox">Checkbox (True/False)</option>
              <option value="single">Single Value (Always Present)</option>
            </select>
            <p className="text-xs text-theme-secondary mt-1">
              Choose the type of instruction you want to create. Type cannot be changed after creation.
            </p>
          </div>
          
          {/* List Parameter Fields */}
          {formData.type === 'list' && (
            <div className="mb-4 p-3 border border-theme rounded-md bg-theme-surface">
              <h4 className="text-sm font-medium mb-2">List Instruction Options</h4>
              
              <div className="mb-3">
                <label className="block mb-1 text-xs font-medium text-theme-secondary">
                  Default Option Key:
                </label>
                <input
                  type="text"
                  name="listKey"
                  value={formData.listKey}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border ${validationErrors.listKey ? 'border-error' : 'border-theme'} rounded-md bg-theme-primary`}
                  placeholder="e.g., default, normal"
                />
                {validationErrors.listKey && (
                  <p className="text-error text-xs mt-1">{validationErrors.listKey}</p>
                )}
              </div>
              
              <div>
                <label className="block mb-1 text-xs font-medium text-theme-secondary">
                  Default Option Value:
                </label>
                <textarea
                  name="listValue"
                  value={formData.listValue}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border ${validationErrors.listValue ? 'border-error' : 'border-theme'} rounded-md bg-theme-primary min-h-[80px]`}
                  placeholder="Enter the default option content"
                />
                {validationErrors.listValue && (
                  <p className="text-error text-xs mt-1">{validationErrors.listValue}</p>
                )}
              </div>
            </div>
          )}
          
          {/* Checkbox Parameter Fields */}
          {formData.type === 'checkbox' && (
            <div className="mb-4 p-3 border border-theme rounded-md bg-theme-surface">
              <h4 className="text-sm font-medium mb-2">Checkbox Instruction Options</h4>
              
              <div className="mb-3">
                <label className="block mb-1 text-xs font-medium text-theme-secondary">
                  When Checked (True):
                </label>
                <textarea
                  name="trueValue"
                  value={formData.trueValue}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border ${validationErrors.trueValue ? 'border-error' : 'border-theme'} rounded-md bg-theme-primary min-h-[80px]`}
                  placeholder="Enter content when option is checked"
                />
                {validationErrors.trueValue && (
                  <p className="text-error text-xs mt-1">{validationErrors.trueValue}</p>
                )}
              </div>
              
              <div>
                <label className="block mb-1 text-xs font-medium text-theme-secondary">
                  When Unchecked (False):
                </label>
                <textarea
                  name="falseValue"
                  value={formData.falseValue}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-theme rounded-md bg-theme-primary min-h-[80px]"
                  placeholder="Enter content when option is unchecked (usually empty)"
                />
              </div>
            </div>
          )}
          
          {/* Single Value Parameter Fields */}
          {formData.type === 'single' && (
            <div className="mb-4 p-3 border border-theme rounded-md bg-theme-surface">
              <h4 className="text-sm font-medium mb-2">Single Value Instruction</h4>
              
              <div>
                <label className="block mb-1 text-xs font-medium text-theme-secondary">
                  Instruction Value:
                </label>
                <textarea
                  name="singleValue"
                  value={formData.singleValue}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border ${validationErrors.singleValue ? 'border-error' : 'border-theme'} rounded-md bg-theme-primary min-h-[80px]`}
                  placeholder="Enter the instruction value (always included in prompt)"
                />
                {validationErrors.singleValue && (
                  <p className="text-error text-xs mt-1">{validationErrors.singleValue}</p>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-theme">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            
            <Button type="submit">
              Add Instruction
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddParameterModal;
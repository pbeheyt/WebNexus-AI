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
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Parameter name is required');
      return;
    }
    
    // Create type-specific data
    let typeSpecificData = {};
    
    switch (formData.type) {
      case 'list':
        if (!formData.listKey.trim() || !formData.listValue.trim()) {
          alert('Default option key and value are required for list parameters');
          return;
        }
        
        typeSpecificData = {
          values: {
            [formData.listKey]: formData.listValue
          }
        };
        break;
      
      case 'checkbox':
        if (!formData.trueValue.trim()) {
          alert('True value is required for checkbox parameters');
          return;
        }
        
        typeSpecificData = {
          values: {
            true: formData.trueValue,
            false: formData.falseValue
          }
        };
        break;
      
      case 'single':
        if (!formData.singleValue.trim()) {
          alert('Value is required for single value parameters');
          return;
        }
        
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
          <h3 className="text-lg font-medium">Add New Parameter</h3>
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
              Parameter Name:
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme rounded-md bg-theme-surface"
              placeholder="Enter parameter name"
            />
          </div>
          
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium text-theme-secondary">
              Parameter Type:
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
              Choose the type of parameter you want to create. Type cannot be changed after creation.
            </p>
          </div>
          
          {/* List Parameter Fields */}
          {formData.type === 'list' && (
            <div className="mb-4 p-3 border border-theme rounded-md bg-theme-surface">
              <h4 className="text-sm font-medium mb-2">List Parameter Options</h4>
              
              <div className="mb-3">
                <label className="block mb-1 text-xs font-medium text-theme-secondary">
                  Default Option Key:
                </label>
                <input
                  type="text"
                  name="listKey"
                  value={formData.listKey}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-theme rounded-md bg-theme-primary"
                  placeholder="e.g., default, normal"
                />
              </div>
              
              <div>
                <label className="block mb-1 text-xs font-medium text-theme-secondary">
                  Default Option Value:
                </label>
                <textarea
                  name="listValue"
                  value={formData.listValue}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-theme rounded-md bg-theme-primary min-h-[80px]"
                  placeholder="Enter the default option content"
                />
              </div>
            </div>
          )}
          
          {/* Checkbox Parameter Fields */}
          {formData.type === 'checkbox' && (
            <div className="mb-4 p-3 border border-theme rounded-md bg-theme-surface">
              <h4 className="text-sm font-medium mb-2">Checkbox Parameter Options</h4>
              
              <div className="mb-3">
                <label className="block mb-1 text-xs font-medium text-theme-secondary">
                  When Checked (True):
                </label>
                <textarea
                  name="trueValue"
                  value={formData.trueValue}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-theme rounded-md bg-theme-primary min-h-[80px]"
                  placeholder="Enter content when option is checked"
                />
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
              <h4 className="text-sm font-medium mb-2">Single Value Parameter</h4>
              
              <div>
                <label className="block mb-1 text-xs font-medium text-theme-secondary">
                  Parameter Value:
                </label>
                <textarea
                  name="singleValue"
                  value={formData.singleValue}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-theme rounded-md bg-theme-primary min-h-[80px]"
                  placeholder="Enter the parameter value (always included in prompt)"
                />
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
              Add Parameter
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddParameterModal;
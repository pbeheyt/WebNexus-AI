// src/settings/components/ui/SettingsForm.jsx
import React, { useState, useEffect } from 'react';
import { useNotification, Button } from '../../../components';

const SettingsForm = ({ 
  settings, 
  updateSettings, 
  fields 
}) => {
  const { success } = useNotification();
  const [formValues, setFormValues] = useState(settings);
  const [inputValues, setInputValues] = useState({});  // Store raw input values
  const [savingField, setSavingField] = useState(null);
  const [changedFields, setChangedFields] = useState({});
  
  // Initialize input values from settings
  useEffect(() => {
    const initialInputs = {};
    Object.keys(settings).forEach(key => {
      initialInputs[key] = settings[key]?.toString() || '';
    });
    setInputValues(initialInputs);
  }, [settings]);
  
  const handleInputChange = (key, value) => {
    // Store the raw input value for display
    setInputValues(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Parse the value to the correct type
    let typedValue = value;
    
    if (typeof settings[key] === 'number') {
      // For numeric fields, handle empty strings and parse appropriately
      if (value === '' || value === '-' || value === '.') {
        // Don't convert empty string, just dash, or just decimal point
        // This allows for better typing experience
        typedValue = value;
      } else {
        // Convert to number for proper comparison
        typedValue = parseFloat(value);
        if (isNaN(typedValue)) typedValue = 0;
      }
    }
    
    // Update the form values
    setFormValues(prev => ({
      ...prev,
      [key]: typedValue
    }));
    
    // Check if the field has changed - use string comparison for numeric fields
    // to account for formatting differences
    const hasChanged = typeof settings[key] === 'number' 
      ? parseFloat(value) !== settings[key] 
      : value !== settings[key];
    
    // If we have a numeric input where the user hasn't finished typing
    // (empty, just a minus sign, or just a decimal), consider it changed
    // when it's different from the original
    const isIncompleteNumeric = 
      typeof settings[key] === 'number' &&
      (value === '' || value === '-' || value === '.' || 
       value.endsWith('.') || value.startsWith('.'));
      
    setChangedFields(prev => ({
      ...prev,
      [key]: hasChanged || isIncompleteNumeric
    }));
  };
  
  const handleUpdate = async (key) => {
    if (!changedFields[key]) return;
    
    setSavingField(key);
    
    const field = fields.find(f => f.key === key);
    let value = formValues[key];
    
    // Handle incomplete numeric values before saving
    if (typeof settings[key] === 'number') {
      // If the value is empty or just a sign or decimal point, use 0 or min value
      if (value === '' || value === '-' || value === '.') {
        value = field.min !== undefined ? field.min : 0;
      } else {
        // Convert to number and validate
        value = parseFloat(value);
        if (isNaN(value)) value = field.min !== undefined ? field.min : 0;
      }
      
      // Apply min/max constraints
      if (field.min !== undefined && value < field.min) value = field.min;
      if (field.max !== undefined && value > field.max) value = field.max;
    }
    
    // Update settings
    const result = await updateSettings({ [key]: value });
    
    if (result) {
      // Update input value to reflect the validated/constrained value
      setInputValues(prev => ({
        ...prev,
        [key]: value.toString()
      }));
      
      success(`Updated ${field.label.replace(':', '')}`);
      setChangedFields(prev => ({
        ...prev,
        [key]: false
      }));
    }
    
    setSavingField(null);
  };
  
  // For numeric fields with a decimal part, set an appropriate step
  const getStepValue = (field) => {
    if (field.step !== undefined) return field.step;
    
    // Default to 1 for integer fields, 0.1 for decimal fields
    return settings[field.key] % 1 === 0 ? 1 : 0.1;
  };
  
  return (
    <div className="settings-form space-y-4">
      {fields.map((field) => (
        <div key={field.key} className="form-group flex items-center flex-wrap">
          <label 
            htmlFor={`setting-${field.key}`}
            className="mr-4 min-w-[150px] text-sm font-medium text-theme-secondary"
          >
            {field.label}
          </label>
          
          {field.type === 'number' && (
            <input
              id={`setting-${field.key}`}
              type="number"
              className="w-32 px-3 py-2 bg-theme-surface text-theme-primary border border-theme rounded-md"
              value={inputValues[field.key] || ''}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              min={field.min}
              max={field.max}
              step={getStepValue(field)}
              onKeyDown={(e) => {
                // Allow special keys like backspace, delete, arrows
                if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                  return;
                }
                
                // Prevent multiple periods in numeric input
                if (e.key === '.' && e.target.value.includes('.')) {
                  e.preventDefault();
                }
                
                // Prevent non-numeric input (except allowed special characters)
                if (!/^[0-9.-]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault();
                }
              }}
              onBlur={(e) => {
                // When focus leaves the field and value is incomplete, format it
                const value = e.target.value;
                if ((value === '' || value === '-' || value === '.') && typeof settings[field.key] === 'number') {
                  const defaultValue = field.min !== undefined ? field.min : 0;
                  setInputValues(prev => ({
                    ...prev,
                    [field.key]: defaultValue.toString()
                  }));
                  setFormValues(prev => ({
                    ...prev,
                    [field.key]: defaultValue
                  }));
                }
              }}
            />
          )}
          
          <Button
            variant={changedFields[field.key] ? "primary" : "inactive"}
            size="sm"
            className="ml-3"
            onClick={() => handleUpdate(field.key)}
            disabled={!changedFields[field.key] || savingField === field.key}
          >
            {savingField === field.key ? 'Updating...' : 'Update'}
          </Button>
          
          {field.helpText && (
            <p className="help-text text-xs text-theme-secondary mt-1 basis-full ml-[165px]">
              {field.helpText}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default SettingsForm;
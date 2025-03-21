// src/settings/components/ui/SettingsForm.jsx
import React, { useState } from 'react';
import { useNotification, Button } from '../../../components';

const SettingsForm = ({ 
  settings, 
  updateSettings, 
  fields 
}) => {
  const { success } = useNotification();
  const [formValues, setFormValues] = useState(settings);
  const [savingField, setSavingField] = useState(null);
  const [changedFields, setChangedFields] = useState({});
  
  const handleInputChange = (key, value) => {
    // Handle numeric inputs
    if (typeof settings[key] === 'number') {
      value = parseFloat(value);
      if (isNaN(value)) value = 0;
    }
    
    setFormValues(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Track which fields have changes
    setChangedFields(prev => ({
      ...prev,
      [key]: value !== settings[key]
    }));
  };
  
  const handleUpdate = async (key) => {
    if (!changedFields[key]) return;
    
    setSavingField(key);
    
    const field = fields.find(f => f.key === key);
    let value = formValues[key];
    
    // Validate if min/max are specified
    if (field.type === 'number') {
      if (field.min !== undefined && value < field.min) value = field.min;
      if (field.max !== undefined && value > field.max) value = field.max;
    }
    
    // Update settings
    const result = await updateSettings({ [key]: value });
    
    if (result) {
      success(`Updated ${field.label.replace(':', '')}`);
      setChangedFields(prev => ({
        ...prev,
        [key]: false
      }));
    }
    
    setSavingField(null);
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
              value={formValues[field.key] || ''}
              onChange={(e) => handleInputChange(field.key, e.target.value)}
              min={field.min}
              max={field.max}
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
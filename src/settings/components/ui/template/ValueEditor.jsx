import React, { useState } from 'react';
import Button from '../../common/Button';

const ValueEditor = ({
  valueKey,
  value,
  onValueChange,
  onDeleteValue,
  showDeleteButton = true
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [hasChanges, setHasChanges] = useState(false);
  
  const handleChange = (e) => {
    setLocalValue(e.target.value);
    setHasChanges(e.target.value !== value);
  };
  
  const handleSave = () => {
    onValueChange(localValue);
    setHasChanges(false);
  };
  
  return (
    <div className="value-editor p-3 bg-theme-primary rounded-md border border-theme">
      <div className="value-header flex justify-between items-center mb-2">
        <div className="value-key-label px-2 py-1 bg-theme-surface rounded text-xs font-medium border border-theme">
          {valueKey}
        </div>
      </div>
      
      <textarea
        className="value-textarea w-full min-h-[80px] px-3 py-2 border border-theme rounded-md bg-theme-primary text-theme-primary font-mono text-sm resize-vertical"
        value={localValue}
        onChange={handleChange}
      />
      
      <div className="value-actions flex justify-end items-center gap-2 mt-2">
        {hasChanges && (
          <Button
            size="sm"
            onClick={handleSave}
          >
            Update
          </Button>
        )}
        
        {showDeleteButton && (
          <Button
            size="sm"
            variant="danger"
            onClick={onDeleteValue}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
};

export default ValueEditor;
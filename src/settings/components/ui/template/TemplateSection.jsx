// src/settings/components/ui/template/TemplateSection.jsx
import React from 'react';
import { Button, Accordion } from '../../../../components';
import ParameterEditor from './ParameterEditor';

const TemplateSection = ({
  title,
  expanded,
  onToggle,
  onAddParameter,
  parameters,
  onReorderParameter,
  onDeleteParameter,
  onUpdateParameter
}) => {
  // Sort parameters by order
  const sortedParameters = [...parameters].sort((a, b) => a.order - b.order);
  
  return (
    <Accordion
      title={title}
      defaultExpanded={expanded}
      onToggle={onToggle}
      className="mb-5"
    >
      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={onAddParameter}
        >
          + Add Instruction
        </Button>
      </div>
      
      <div className="parameter-list">
        {sortedParameters.length === 0 ? (
          <div className="empty-parameters p-4 text-center text-theme-secondary bg-theme-hover rounded-md">
            <p>No instructions found. Click "Add Instruction" to create one.</p>
          </div>
        ) : (
          sortedParameters.map((param, index) => (
            <ParameterEditor
              key={param.id}
              parameter={param}
              isFirst={index === 0}
              isLast={index === sortedParameters.length - 1}
              onReorder={(newOrder) => onReorderParameter(param.id, newOrder)}
              onDelete={() => onDeleteParameter(param.id)}
              onUpdate={(updates) => onUpdateParameter(param.id, updates)}
            />
          ))
        )}
      </div>
    </Accordion>
  );
};

export default TemplateSection;
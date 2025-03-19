import React from 'react';
import Button from '../../common/Button';
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
    <div className="template-section mb-5 bg-theme-surface rounded-lg overflow-hidden border border-theme">
      <div className="template-section-header px-4 py-3 bg-theme-surface border-b border-theme flex justify-between items-center">
        <div 
          className="section-title-wrapper flex items-center cursor-pointer"
          onClick={onToggle}
        >
          <h3 className="text-base font-medium">{title}</h3>
          <span className="section-collapse-indicator ml-2 text-theme-secondary">
            {expanded ? '▼' : '▶'}
          </span>
        </div>
        
        <Button
          size="sm"
          onClick={onAddParameter}
        >
          + Add Parameter
        </Button>
      </div>
      
      <div className={`parameter-list p-4 ${expanded ? '' : 'hidden'}`}>
        {sortedParameters.length === 0 ? (
          <div className="empty-parameters p-4 text-center text-theme-secondary bg-theme-hover rounded-md">
            <p>No parameters found. Click "Add Parameter" to create one.</p>
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
    </div>
  );
};

export default TemplateSection;
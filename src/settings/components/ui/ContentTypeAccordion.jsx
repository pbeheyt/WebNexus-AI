import React from 'react';

const ContentTypeAccordion = ({ 
  title, 
  children, 
  expanded = false, 
  onToggle 
}) => {
  return (
    <div className="content-type-group mb-4 border border-theme rounded-lg overflow-hidden bg-theme-surface">
      <div 
        className="content-type-header p-3 font-medium cursor-pointer flex justify-between items-center hover:bg-theme-hover transition-colors"
        onClick={onToggle}
      >
        <span>{title}</span>
        <span>{expanded ? '▼' : '▶'}</span>
      </div>
      
      <div className={`content-type-content p-4 border-t border-theme ${expanded ? '' : 'hidden'}`}>
        {children}
      </div>
    </div>
  );
};

export default ContentTypeAccordion;
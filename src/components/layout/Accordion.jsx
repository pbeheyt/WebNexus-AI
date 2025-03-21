// src/components/layout/Accordion.jsx
import React, { useState } from 'react';

/**
 * Expandable accordion component for collapsible content.
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Accordion title
 * @param {React.ReactNode} props.children - Accordion content
 * @param {boolean} [props.defaultExpanded=false] - Whether initially expanded
 * @param {Function} [props.onToggle] - Toggle callback
 * @param {string} [props.className=''] - Additional CSS classes
 */
export function Accordion({ 
  title, 
  children, 
  defaultExpanded = false,
  onToggle,
  className = '' 
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  const handleToggle = () => {
    const newState = !expanded;
    setExpanded(newState);
    if (onToggle) onToggle(newState);
  };
  
  return (
    <div className={`border border-theme rounded-lg overflow-hidden bg-theme-surface ${className}`}>
      <div 
        className="accordion-header p-3 font-medium cursor-pointer flex justify-between items-center hover:bg-theme-hover transition-colors"
        onClick={handleToggle}
      >
        <span>{title}</span>
        <span>{expanded ? '▼' : '▶'}</span>
      </div>
      
      <div className={`accordion-content p-4 border-t border-theme transition-all duration-300 ${expanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        {children}
      </div>
    </div>
  );
}

export default Accordion;
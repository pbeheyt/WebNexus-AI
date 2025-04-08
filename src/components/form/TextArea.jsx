// src/components/form/TextArea.jsx
import React, { forwardRef, useEffect, useRef } from 'react';

/**
 * Enhanced textarea component with auto-resize capability.
 */
export const TextArea = forwardRef(({
  value,
  onChange,
  placeholder,
  maxLength,
  className = '',
  autoResize = true,
  minHeight = 80,
  maxHeight = 300,
  ...props
}, ref) => {
  const textareaRef = useRef(null);
  const combinedRef = (element) => {
    textareaRef.current = element;
    if (typeof ref === 'function') ref(element);
    else if (ref) ref.current = element;
  };
  
  // Auto-resize functionality
  useEffect(() => {
    if (autoResize && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(
        minHeight, 
        Math.min(textareaRef.current.scrollHeight, maxHeight)
      )}px`;
    }
  }, [value, autoResize, minHeight, maxHeight]);
  
  return (
    <textarea
      ref={combinedRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`w-full min-h-[${minHeight}px] p-3 bg-transparent border-none outline-none text-theme-primary text-sm resize-vertical ${className}`}
      style={{ minHeight: `${minHeight}px` }}
      {...props}
    />
  );
});

TextArea.displayName = 'TextArea';

export default TextArea;

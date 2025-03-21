import { forwardRef, useEffect, useRef } from 'react';

export const TextArea = forwardRef(({
  value,
  onChange,
  placeholder,
  maxLength,
  className = '',
  autoResize = true,
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
        80, 
        Math.min(textareaRef.current.scrollHeight, 300)
      )}px`;
    }
  }, [value, autoResize]);
  
  return (
    <textarea
      ref={combinedRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`w-full min-h-[100px] p-3 bg-transparent border-none outline-none text-text-primary text-sm resize-vertical ${className}`}
      {...props}
    />
  );
});

TextArea.displayName = 'TextArea';
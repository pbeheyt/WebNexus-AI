import { useEffect, useState } from 'react';

export function Toast({ 
  message, 
  type = 'info', 
  duration = 3000, 
  onClose,
  visible = false 
}) {
  const [isVisible, setIsVisible] = useState(visible);
  
  useEffect(() => {
    setIsVisible(visible);
    
    if (visible && duration) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);
  
  const typeClasses = {
    info: 'border-l-primary',
    success: 'border-l-success',
    warning: 'border-l-warning',
    error: 'border-l-error',
  };
  
  return (
    <div 
      className={`fixed bottom-4 left-4 right-4 p-3 bg-background-surface border-l-4 ${typeClasses[type]} rounded shadow-medium transform transition-all duration-300 pointer-events-auto ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}
    >
      {message}
    </div>
  );
}
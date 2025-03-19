// src/components/ui/Toast.jsx
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
      className={`fixed bottom-4 left-4 right-4 p-3 bg-background-surface border-l-4 ${typeClasses[type]} rounded shadow-medium transform transition-all duration-300 z-50 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}
    >
      <div className="flex justify-between items-center">
        <div>{message}</div>
        <button 
          onClick={() => {
            setIsVisible(false);
            if (onClose) onClose();
          }}
          className="ml-2 text-text-secondary hover:text-text-primary"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
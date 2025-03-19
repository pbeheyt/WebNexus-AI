import React, { useEffect, useState } from 'react';
import { useNotification } from '../../contexts/NotificationContext';

const NotificationToast = () => {
  const { notification, clearNotification } = useNotification();
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (notification) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [notification]);
  
  if (!notification) return null;
  
  const typeClasses = {
    info: 'border-l-primary',
    success: 'border-l-success',
    warning: 'border-l-warning',
    error: 'border-l-error',
  };
  
  return (
    <div 
      className={`fixed top-5 right-5 p-4 bg-theme-surface border-l-4 ${typeClasses[notification.type]} rounded shadow-theme-medium transform transition-all duration-300 z-50 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-[-20px] opacity-0 pointer-events-none'
      }`}
      id="notification"
    >
      <div className="flex justify-between items-center">
        <div>{notification.message}</div>
        <button 
          onClick={clearNotification}
          className="ml-4 text-theme-secondary hover:text-theme-primary"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;
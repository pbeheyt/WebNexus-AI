// src/components/feedback/Toast.jsx
import React, { useEffect, useState } from 'react';
import { useNotification } from './NotificationContext';

/**
 * Toast component for displaying notifications.
 * Automatically connects to NotificationContext when used without props.
 * Can also be used standalone with direct props.
 */
export function Toast({ 
  message, 
  type = 'info', 
  duration = 3000, 
  onClose,
  visible = false,
  position = 'bottom-left',
  standalone = false
}) {
  const [isVisible, setIsVisible] = useState(visible);
  const notificationContext = useNotification();
  
  // If not in standalone mode, connect to the notification context
  const notification = standalone ? { message, type } : notificationContext?.notification;
  const closeHandler = standalone ? onClose : notificationContext?.clearNotification;
  
  useEffect(() => {
    // For standalone usage, respond to the visible prop
    if (standalone) {
      setIsVisible(visible);
      
      if (visible && duration) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          if (onClose) onClose();
        }, duration);
        
        return () => clearTimeout(timer);
      }
    } 
    // For context usage, respond to notification changes
    else if (notificationContext) {
      setIsVisible(!!notification);
    }
  }, [standalone, visible, duration, onClose, notification, notificationContext]);
  
  if (!standalone && !notification) return null;
  
  const typeClasses = {
    info: 'border-l-primary',
    success: 'border-l-success',
    warning: 'border-l-warning',
    error: 'border-l-error',
  };
  
  const positionClasses = {
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
  };
  
  return (
    <div 
      className={`fixed p-3 bg-theme-surface border-l-4 ${typeClasses[notification?.type || type]} ${positionClasses[position]} rounded shadow-medium transform transition-all duration-300 z-50 inline-block max-w-md ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}
    >
      <div className="flex justify-between items-center">
        <div>{notification?.message || message}</div>
        <button 
          onClick={() => {
            setIsVisible(false);
            if (closeHandler) closeHandler();
          }}
          className="ml-2 text-theme-secondary hover:text-theme-primary"
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

export default Toast;

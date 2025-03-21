// src/components/layout/Modal.jsx
import React, { useEffect, useRef } from 'react';
import Button from '../core/Button';

/**
 * Reusable modal component with title, content, and actions.
 */
export function Modal({
  title,
  children,
  isOpen,
  onClose,
  actions,
  size = 'md',
  closeOnEscape = true,
  closeOnOutsideClick = true,
  className = ''
}) {
  const modalRef = useRef(null);
  
  // Size classes
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95%] h-[90vh]'
  };
  
  // Handle Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && closeOnEscape) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, closeOnEscape]);
  
  // Handle outside click
  const handleBackdropClick = (e) => {
    if (closeOnOutsideClick && modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div 
        ref={modalRef}
        className={`bg-theme-primary rounded-lg shadow-theme-medium ${sizeClasses[size]} w-full max-h-[90vh] overflow-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header p-4 border-b border-theme flex items-center justify-between">
            <h3 className="text-lg font-medium">{title}</h3>
            <button 
              className="text-2xl text-theme-secondary hover:text-theme-primary"
              onClick={onClose}
              aria-label="Close modal"
            >
              &times;
            </button>
          </div>
        )}
        
        <div className="modal-body p-4">
          {children}
        </div>
        
        {actions && (
          <div className="modal-footer flex justify-end gap-3 p-4 pt-2 border-t border-theme">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'primary'}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
// src/components/messaging/MessageInput.jsx
import React, { useState } from 'react';

/**
 * A reusable message input component with send button
 * 
 * @param {Object} props - Component props
 * @param {string} props.value - Input value
 * @param {Function} props.onChange - Value change handler
 * @param {Function} props.onSubmit - Submit handler
 * @param {boolean} props.disabled - Whether input is disabled
 * @param {string} props.placeholder - Input placeholder text
 * @param {string} props.buttonLabel - Send button label (for accessibility)
 * @param {string} props.className - Additional CSS classes
 */
export function MessageInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Type a message...',
  buttonLabel = 'Send',
  className = ''
}) {
  const handleInputChange = (e) => {
    onChange(e.target.value);
  };
  
  const handleKeyDown = (e) => {
    // Send on Enter (without shift for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSubmit(value);
    }
  };
  
  return (
    <div className={`border-t border-gray-200 dark:border-gray-700 p-3 flex items-center gap-2 ${className}`}>
      <div className="flex-1 relative">
        <input
          type="text"
          className="w-full py-2 px-4 pl-3 pr-10 border border-gray-200 dark:border-gray-700 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none transition-colors duration-200 focus:border-primary focus-primary"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        
        <button
          className={`absolute right-2 bottom-2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer border-none outline-none ${
            !value.trim() || disabled
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-hover text-white'
          }`}
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          aria-label={buttonLabel}
          title={buttonLabel}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default MessageInput;
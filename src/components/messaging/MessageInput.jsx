import React, { useEffect, useRef } from 'react';
import { TextArea } from '../form/TextArea';

/**
 * A reusable message input component with send button styled like modern AI chat interfaces
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
  const textareaRef = useRef(null);
  
  useEffect(() => {
    // Focus the textarea on mount
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);
  
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
      // Focus back on the textarea after sending
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };
  
  return (
    <div className={`border-t border-gray-200 dark:border-gray-700 p-3 ${className}`}>
      <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-all">
        <TextArea
          ref={textareaRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoResize={true}
          minHeight={44}
          maxHeight={200}
          className="py-3 px-4 pr-20 bg-transparent rounded-lg resize-none focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600 outline-none transition-all duration-200"
        />
        
        <div className="absolute right-2 top-2 flex items-center gap-2">
          {/* Attachment button - now on the right and at the top */}
          <button
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1"
            aria-label="Attach file"
            title="Attach file"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>
          
          {/* Send button with square shape and upward arrow like in the photo */}
          <button
            className={`flex items-center justify-center cursor-pointer border-none outline-none ${
              !value.trim() || disabled
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            } w-7 h-7 rounded`}
            onClick={handleSubmit}
            disabled={!value.trim() || disabled}
            aria-label={buttonLabel}
            title={buttonLabel}
          >
            {/* Upward arrow icon similar to the one in the photo */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 11L12 4L19 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 px-2">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}

export default MessageInput;
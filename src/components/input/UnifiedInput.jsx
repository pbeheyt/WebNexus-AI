// src/components/input/UnifiedInput.jsx
import React, { useState, useEffect, useRef } from 'react';
import { TextArea } from '../form/TextArea';
import Button from '../core/Button'; 
import { PromptDropdown } from './PromptDropdown';
import TokenCounter from '../../sidebar/components/TokenCounter';

/**
 * Unified input component for both popup and sidebar, supporting direct input
 * and custom prompt selection via dropdown.
 */
export function UnifiedInput({
  value,
  onChange,
  onSubmit,
  onCancel = null,
  placeholder = 'Type or select a prompt...',
  disabled = false,
  isProcessing = false,
  isCanceling = false,
  contentType,
  showTokenInfo = false,
  tokenStats,
  contextStatus,
  layoutVariant,
  className = ''
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const textareaRef = useRef(null);
  const promptButtonRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isProcessing && !isDropdownOpen && textareaRef.current) {
       setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isProcessing, isDropdownOpen]);

  const handleInputChange = (e) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled && !isProcessing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (layoutVariant === 'sidebar' && isProcessing && onCancel) {
      onCancel();
    } 
    else if (value.trim() && !disabled && !isProcessing) {
      onSubmit(value);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handlePromptSelected = (prompt) => {
    setIsDropdownOpen(false);
    if (!disabled && !isProcessing) {
      onSubmit(prompt.content);
    }
  };

  // Handle container click to focus textarea
  const handleContainerClick = (e) => {
    // Only focus if clicked on the container itself, not on buttons or other controls
    if (e.target === containerRef.current || e.target.classList.contains('input-container')) {
      if (textareaRef.current && !disabled && !isProcessing) {
        textareaRef.current.focus();
      }
    }
  };

  // --- Sidebar Specific Button Logic ---
  const isStreamingActive = layoutVariant === 'sidebar' && isProcessing;
  const sidebarButtonStyle = isStreamingActive
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : (!value.trim() || disabled)
      ? 'bg-gray-400 cursor-not-allowed text-white'
      : 'bg-orange-600 hover:bg-orange-700 text-white';
  const sidebarButtonLabel = isStreamingActive ? "Cancel generation" : "Send message";
  const sidebarButtonDisabled = (!value.trim() && !isStreamingActive) || disabled || (isStreamingActive && isCanceling);

  // --- Render Logic ---
  if (layoutVariant === 'sidebar') {
    return (
      <div className={`flex flex-col ${className}`}>
        {/* Token Counter */}
        {showTokenInfo && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
            <TokenCounter tokenStats={tokenStats} contextStatus={contextStatus} />
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div 
            ref={containerRef}
            onClick={handleContainerClick}
            className="input-container relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all">
            <TextArea
              ref={textareaRef}
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isProcessing}
              autoResize={true}
              minHeight={44}
              maxHeight={200}
              className="input-textarea w-full py-3 px-4 pr-20 bg-transparent resize-none focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600 outline-none transition-all duration-200"
            />
            
            <div className="absolute right-2 top-2 flex items-center gap-2">
              {/* Prompt Selection Button with Dropdown */}
              <div className="relative">
                <button
                  ref={promptButtonRef}
                  onClick={() => setIsDropdownOpen(prev => !prev)}
                  disabled={disabled || isProcessing}
                  className={`flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded w-7 h-7 ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Select prompt"
                  title="Select a custom prompt"
                >
                  <span className="font-semibold text-sm">P</span> 
                </button>
                
                {/* Prompt dropdown positioned inside the button container */}
                <PromptDropdown
                  isOpen={isDropdownOpen}
                  onClose={() => setIsDropdownOpen(false)}
                  onSelectPrompt={handlePromptSelected}
                  contentType={contentType}
                  anchorRef={promptButtonRef}
                />
              </div>
              
              {/* Send/Cancel Button */}
              <button
                className={`flex items-center justify-center cursor-pointer border-none outline-none ${sidebarButtonStyle} w-7 h-7 rounded ${isCanceling ? 'opacity-70' : ''}`}
                onClick={handleSubmit}
                disabled={sidebarButtonDisabled}
                aria-label={sidebarButtonLabel}
                title={sidebarButtonLabel}
              >
                {isStreamingActive ? (
                  // X icon for cancel
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  // Upward arrow icon for send
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 11L12 4L19 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          <div className="py-2 text-xs text-gray-500 dark:text-gray-400 px-4">
            {isStreamingActive 
              ? "Processing... Click button to cancel" 
              : "Press Enter to send, Shift+Enter for new line"}
          </div>
        </div>
      </div>
    );
  }
  
  // --- Popup Variant ---
  else if (layoutVariant === 'popup') {
    const popupSendButtonDisabled = !value.trim() || disabled || isProcessing;
    const popupSendButtonStyle = popupSendButtonDisabled
      ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white dark:text-gray-400'
      : 'bg-primary hover:bg-primary-dark text-white';

    return (
      <div className={`flex flex-col ${className}`}>
        {/* Input Area */}
        <div className="border border-theme rounded-lg bg-theme-surface">
          <div 
            ref={containerRef}
            onClick={handleContainerClick}
            className="input-container relative">
            <TextArea
              ref={textareaRef}
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isProcessing}
              autoResize={true}
              minHeight={60}
              maxHeight={150}
              className="input-textarea w-full py-3 px-3 pr-14 bg-transparent rounded-lg resize-none focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600 outline-none transition-all duration-200 text-theme-primary placeholder-theme-secondary"
            />
            
            <div className="absolute right-2 top-2 flex items-center gap-2">
              {/* Prompt Selection Button with Dropdown */}
              <div className="relative">
                <button
                  ref={promptButtonRef}
                  onClick={() => setIsDropdownOpen(prev => !prev)}
                  disabled={disabled || isProcessing}
                  className={`flex items-center justify-center text-theme-secondary hover:text-primary p-1 rounded w-5 h-5 ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Select prompt"
                  title="Select a custom prompt"
                >
                  <span className="font-semibold text-sm">P</span> 
                </button>
                
                {/* Prompt dropdown positioned inside the button container */}
                <PromptDropdown
                  isOpen={isDropdownOpen}
                  onClose={() => setIsDropdownOpen(false)}
                  onSelectPrompt={handlePromptSelected}
                  contentType={contentType}
                  anchorRef={promptButtonRef}
                />
              </div>
              
              {/* Send Button */}
              <button
                className={`flex items-center justify-center cursor-pointer border-none outline-none ${popupSendButtonStyle} w-5 h-5 rounded`}
                onClick={handleSubmit}
                disabled={popupSendButtonDisabled}
                aria-label="Send"
                title="Send"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 11L12 4L19 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return <div className="text-red-500">Error: Invalid layoutVariant specified.</div>;
}
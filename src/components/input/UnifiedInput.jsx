// src/components/input/UnifiedInput.jsx
import React, { useState, useEffect, useRef } from 'react';
import { TextArea } from '../form/TextArea';
import Button from '../core/Button'; // Assuming Button handles variants/disabled states
import { PromptDropdown } from './PromptDropdown'; // Changed to named import
import TokenCounter from '../../sidebar/components/TokenCounter'; // Only used in sidebar

/**
 * Unified input component for both popup and sidebar, supporting direct input
 * and custom prompt selection via modal.
 * 
 * @param {Object} props - Component props
 * @param {string} props.value - Current input value
 * @param {Function} props.onChange - Handler for input value change
 * @param {Function} props.onSubmit - Handler for submitting the input value
 * @param {Function|null} props.onCancel - Handler for canceling processing (sidebar only)
 * @param {string} [props.placeholder='Type or select a prompt...'] - Placeholder text
 * @param {boolean} [props.disabled=false] - Whether the input/buttons are disabled
 * @param {boolean} [props.isProcessing=false] - Whether processing is ongoing
 * @param {boolean} [props.isCanceling=false] - Whether cancellation is ongoing (sidebar only)
 * @param {string} props.contentType - Current content type for prompt filtering
 * @param {boolean} [props.showTokenInfo=false] - Whether to show token info (sidebar only)
 * @param {Object} [props.tokenStats] - Token statistics object (sidebar only)
 * @param {Object} [props.contextStatus] - Context window status object (sidebar only)
 * @param {'popup' | 'sidebar'} props.layoutVariant - Controls the layout style
 * @param {string} [props.className=''] - Additional CSS classes for the outer container
 */
export function UnifiedInput({ // Added export keyword
  value,
  onChange,
  onSubmit,
  onCancel = null, // Default to null for popup
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // Renamed state
  const textareaRef = useRef(null);
  const promptButtonRef = useRef(null); // Added ref for the trigger button

  useEffect(() => {
    // Focus textarea when not processing, useful after dropdown closes or initial load
    if (!isProcessing && !isDropdownOpen && textareaRef.current) { // Use isDropdownOpen
       // Small delay might be needed if focus is lost immediately after dropdown close
       setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isProcessing, isDropdownOpen]); // Use isDropdownOpen

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
    // Sidebar cancel logic
    if (layoutVariant === 'sidebar' && isProcessing && onCancel) {
      onCancel();
    } 
    // Submit logic (both variants)
    else if (value.trim() && !disabled && !isProcessing) {
      onSubmit(value);
      // Optionally clear input after submit? Depends on desired UX.
      // onChange(''); 
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handlePromptSelected = (prompt) => {
    setIsDropdownOpen(false); // Close dropdown on selection
    if (!disabled && !isProcessing) {
      onSubmit(prompt.content); // Submit the selected prompt's content
    }
    // Focus logic is handled by the useEffect hook now
  };

  // Removed openModal function as it's replaced by inline toggle

  // --- Sidebar Specific Button Logic ---
  const isStreamingActive = layoutVariant === 'sidebar' && isProcessing;
  const sidebarButtonStyle = isStreamingActive
    ? 'bg-red-500 hover:bg-red-600 text-white' // Cancel style
    : (!value.trim() || disabled)
      ? 'bg-gray-400 cursor-not-allowed text-white' // Disabled send style
      : 'bg-orange-600 hover:bg-orange-700 text-white'; // Active send style
  const sidebarButtonLabel = isStreamingActive ? "Cancel generation" : "Send message";
  const sidebarButtonDisabled = (!value.trim() && !isStreamingActive) || disabled || (isStreamingActive && isCanceling);


  // --- Render Logic ---

  if (layoutVariant === 'sidebar') {
    return (
      <div className={`flex flex-col ${className}`}>
        {/* Token Counter (Above Input Wrapper for Sidebar) */}
        {showTokenInfo && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
            <TokenCounter tokenStats={tokenStats} contextStatus={contextStatus} />
          </div>
        )}

        {/* Input Area (Replicating MessageInput structure) */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3">
          <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-all">
            <TextArea
              ref={textareaRef}
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isProcessing} // Disable textarea while processing
              autoResize={true}
              minHeight={44}
              maxHeight={200}
              className="py-3 px-4 pr-20 bg-transparent rounded-lg resize-none focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600 outline-none transition-all duration-200"
            />
            
            <div className="absolute right-2 top-2 flex items-center gap-2">
              {/* Prompt Selection Button ('P') */}
              <button
                ref={promptButtonRef} // Added ref
                onClick={() => setIsDropdownOpen(prev => !prev)} // Toggle dropdown
                disabled={disabled || isProcessing}
                className={`flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded w-7 h-7 ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Select prompt"
                title="Select a custom prompt"
              >
                <span className="font-semibold text-sm">P</span> 
              </button>
              
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
          
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 px-2">
            {isStreamingActive 
              ? "Processing... Click button to cancel" 
              : "Press Enter to send, Shift+Enter for new line"}
          </div>
        </div>

        {/* Replaced Modal with Dropdown */}
        <PromptDropdown
          isOpen={isDropdownOpen}
          onClose={() => setIsDropdownOpen(false)}
          onSelectPrompt={handlePromptSelected}
          contentType={contentType}
          anchorRef={promptButtonRef}
        />
      </div>
    );
  }
  
  // --- Popup Variant ---
  else if (layoutVariant === 'popup') {
    // Determine Send button style for popup
    const popupSendButtonDisabled = !value.trim() || disabled || isProcessing;
    const popupSendButtonStyle = popupSendButtonDisabled
      ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white dark:text-gray-400' // Disabled style
      : 'bg-primary hover:bg-primary-dark text-white'; // Active style (adjust classes based on your theme/design system)

    return (
      <div className={`flex flex-col ${className}`}>
        {/* Input Area (Mimicking sidebar structure) */}
        <div className="border border-theme rounded-lg p-3 bg-theme-surface"> {/* Changed p-2 to p-3 */}
          <div className="relative">
            <TextArea
              ref={textareaRef}
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isProcessing}
              autoResize={true}
              minHeight={60} // Adjust as needed
              maxHeight={150} // Adjust as needed
              className="w-full py-2 px-3 pr-20 bg-transparent rounded-lg resize-none focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600 outline-none transition-all duration-200 text-theme-primary placeholder-theme-secondary" // Added text/placeholder colors
            />
            
            <div className="absolute right-2 top-2 flex items-center gap-2"> {/* Changed alignment */}
              {/* Prompt Selection Button ('P') */}
              <button
                ref={promptButtonRef} // Added ref (Ensure only one element uses this ref if logic differs significantly)
                onClick={() => setIsDropdownOpen(prev => !prev)} // Toggle dropdown
                disabled={disabled || isProcessing}
                className={`flex items-center justify-center text-theme-secondary hover:text-primary p-1 rounded w-7 h-7 ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Select prompt"
                title="Select a custom prompt"
              >
                <span className="font-semibold text-sm">P</span> 
              </button>
              
              {/* Send Button (Popup) */}
              <button
                className={`flex items-center justify-center cursor-pointer border-none outline-none ${popupSendButtonStyle} w-7 h-7 rounded`}
                onClick={handleSubmit}
                disabled={popupSendButtonDisabled}
                aria-label="Send"
                title="Send"
              >
                {/* Upward arrow icon for send */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 11L12 4L19 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          {/* Optional: Hint text like sidebar */}
          {/* <div className="mt-1 text-xs text-theme-secondary px-1">
            Press Enter to send
          </div> */}
        </div>

        {/* Replaced Modal with Dropdown */}
        <PromptDropdown
          isOpen={isDropdownOpen}
          onClose={() => setIsDropdownOpen(false)}
          onSelectPrompt={handlePromptSelected}
          contentType={contentType}
          anchorRef={promptButtonRef} // Use the same ref
        />
      </div>
    );
  }

  // Fallback or error case
  return <div className="text-red-500">Error: Invalid layoutVariant specified.</div>;
}

// Removed default export

// src/components/input/UnifiedInput.jsx
import React, { useState, useEffect, useRef } from 'react';
import { TextArea } from '../form/TextArea';
import { PromptDropdown } from './PromptDropdown';
import TokenCounter from '../../sidebar/components/TokenCounter';
import { ArrowUpIcon } from '../icons/ArrowUpIcon';
import { XIcon } from '../icons/XIcon';
import { IconButton } from '../core/IconButton';

/**
 * Unified input component for both popup and sidebar, supporting direct input
 * and custom prompt selection via dropdown. Uses rem units for height to adapt to font size.
 */
export function UnifiedInput({
  value,
  onChange,
  onSubmit,
  onCancel = null,
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

  const handleContainerClick = (e) => {
    if (e.target === containerRef.current || e.target.classList.contains('input-container')) {
      if (textareaRef.current && !disabled && !isProcessing) {
        textareaRef.current.focus();
      }
    }
  };

  // --- Sidebar Specific Button Logic ---
  const isStreamingActive = layoutVariant === 'sidebar' && isProcessing;
  const sidebarButtonStyle = isStreamingActive
    ? 'bg-red-500 hover:bg-red-600 text-white' // Base styles
    : (!value.trim() || disabled)
      ? 'bg-gray-400 text-white' // Disabled state handled by IconButton, only need bg here
      : 'bg-orange-600 hover:bg-orange-700 text-white'; // Active state
  const sidebarButtonLabel = isStreamingActive ? "Cancel generation" : "Send message";
  const sidebarButtonDisabled = (!value.trim() && !isStreamingActive) || disabled || (isStreamingActive && isCanceling);
  const sidebarIconSize = "w-4 h-4";
  const sidebarButtonSize = "w-6 h-6 rounded";

  // --- Popup Specific Button Logic ---
   const popupSendButtonDisabled = !value.trim() || disabled || isProcessing;
   const popupSendButtonStyle = popupSendButtonDisabled
     ? 'bg-gray-400 dark:bg-gray-600 text-white dark:text-gray-400' // Disabled state handled by IconButton
     : 'bg-primary hover:bg-primary-dark text-white'; // Active state
   const popupIconSize = "w-3.5 h-3.5";
   const popupButtonSize = "w-5 h-5 rounded";

  // --- Define styles with rem units ---
  const sidebarStyle = { minHeight: '5rem', maxHeight: '12rem' };
  const popupStyle = { minHeight: '4.5rem', maxHeight: '6rem' };

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
            className="input-container relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all"
          >
            {/* Flex container for layout */}
            <div className="flex w-full">
              <TextArea
                ref={textareaRef}
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a prompt or select one..."
                disabled={disabled || isProcessing}
                autoResize={true}
                style={sidebarStyle}
                className="flex-grow w-full py-3 pl-4 pr-12 bg-transparent resize-none focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600 outline-none transition-all duration-200 scrollbar-gutter-stable text-sm"
              />
            </div>

            {/* Button container */}
            <div className="absolute right-3.5 top-3 flex flex-col items-center gap-2">
              {/* Send/Cancel Button */}
              <IconButton
                icon={isStreamingActive ? XIcon : ArrowUpIcon}
                iconClassName={sidebarIconSize}
                className={`${sidebarButtonStyle} ${sidebarButtonSize} ${isCanceling ? 'opacity-70' : ''}`}
                onClick={handleSubmit}
                disabled={sidebarButtonDisabled}
                ariaLabel={sidebarButtonLabel}
                title={sidebarButtonLabel}
              />

              {/* Prompt Selection Button */}
              <div className="relative">
                {/* Using a standard button here as it has text content */}
                <button
                  ref={promptButtonRef}
                  type="button"
                  onClick={() => setIsDropdownOpen(prev => !prev)}
                  disabled={disabled || isProcessing}
                  className={`flex items-center justify-center text-theme-secondary hover:text-primary p-1 ${sidebarButtonSize} ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-label="Select prompt"
                  title="Select a custom prompt"
                >
                  {/* Adjust text size/weight as needed */}
                  <span className="font-semibold text-sm leading-none">P</span>
                </button>

                <PromptDropdown
                  isOpen={isDropdownOpen}
                  onClose={() => setIsDropdownOpen(false)}
                  onSelectPrompt={handlePromptSelected}
                  contentType={contentType}
                  anchorRef={promptButtonRef}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Popup Variant ---
  else if (layoutVariant === 'popup') {
     return (
       <div className={`flex flex-col ${className}`}>
         {/* Input Area */}
         <div className="border border-theme rounded-lg bg-theme-surface">
           <div
             ref={containerRef}
             onClick={handleContainerClick}
             className="input-container relative"
           >
             {/* Flex container for layout */}
             <div className="flex w-full">
               <TextArea
                 ref={textareaRef}
                 value={value}
                 onChange={handleInputChange}
                 onKeyDown={handleKeyDown}
                 placeholder="Type a prompt or select one..."
                 disabled={disabled || isProcessing}
                 autoResize={true}
                 style={popupStyle}
                 className="flex-grow w-full py-3 pl-3 pr-10 bg-transparent rounded-lg resize-none focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600 outline-none transition-all duration-200 text-theme-primary placeholder-theme-secondary scrollbar-gutter-stable text-xs"
               />
             </div>

             {/* Button container */}
             <div className="absolute right-3.5 top-3 flex flex-col items-center gap-2">
               {/* Send Button */}
               <IconButton
                 icon={ArrowUpIcon}
                 iconClassName={popupIconSize}
                 className={`${popupSendButtonStyle} ${popupButtonSize}`}
                 onClick={handleSubmit}
                 disabled={popupSendButtonDisabled}
                 ariaLabel="Send"
                 title="Send"
               />

               {/* Prompt Selection Button */}
               <div className="relative">
                 <button
                   ref={promptButtonRef}
                   type="button"
                   onClick={() => setIsDropdownOpen(prev => !prev)}
                   disabled={disabled || isProcessing}
                   className={`flex items-center justify-center text-theme-secondary hover:text-primary p-1 ${popupButtonSize} ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                   aria-label="Select prompt"
                   title="Select a custom prompt"
                 >
                   <span className="font-semibold text-xs leading-none">P</span>
                 </button>

                 <PromptDropdown
                   isOpen={isDropdownOpen}
                   onClose={() => setIsDropdownOpen(false)}
                   onSelectPrompt={handlePromptSelected}
                   contentType={contentType}
                   anchorRef={promptButtonRef}
                 />
               </div>
             </div>
           </div>
         </div>
       </div>
     );
  }
}
import React, { useState } from 'react';

/**
 * A versatile message bubble component that supports different roles and states
 * with copy-to-clipboard functionality for assistant messages
 */
export function MessageBubble({ 
  content,
  role = 'assistant',
  isStreaming = false,
  model = null,
  platformIconUrl = null,
  metadata = {},
  className = ''
}) {
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const [copyState, setCopyState] = useState('idle'); // idle, copied, error
  
  // Format message content with proper paragraph breaks
  const formatContent = (content) => {
    if (!content) return null;
    
    // Split content by double line breaks (paragraphs)
    return content.split('\n\n').map((paragraph, pIndex) => (
      <p key={`p-${pIndex}`} className={pIndex > 0 ? 'mt-3' : ''}>
        {/* Split each paragraph by single line breaks */}
        {paragraph.split('\n').map((line, lIndex) => (
          <React.Fragment key={`l-${pIndex}-${lIndex}`}>
            {lIndex > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </p>
    ));
  };
  
  // Copy assistant message to clipboard
  const copyToClipboard = () => {
    if (!content || isStreaming) return;
    
    try {
      // Create a temporary textarea element to hold the text
      const textarea = document.createElement('textarea');
      textarea.value = content;
      
      // Make the textarea non-editable and invisible
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      
      // Append to the body, select, and execute copy command
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      
      // Remove the textarea
      document.body.removeChild(textarea);
      
      // Update state to show success
      setCopyState('copied');
      
      // Reset state after 2 seconds
      setTimeout(() => {
        setCopyState('idle');
      }, 2000);
    } catch (error) {
      console.error('Failed to copy text: ', error);
      setCopyState('error');
      
      setTimeout(() => {
        setCopyState('idle');
      }, 2000);
    }
  };
  
  // System messages (typically errors) with special styling
  if (isSystem) {
    return (
      <div className={`p-4 w-full bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 px-4 py-3 ${className}`}>
        <div className="break-words overflow-hidden">{formatContent(content)}</div>
      </div>
    );
  }

  // User messages with cleaner grey color scheme
  if (isUser) {
    return (
      <div className={`p-4 w-full flex justify-end ${className}`}>
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl p-4 max-w-[85%] overflow-hidden">
          <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere">{formatContent(content)}</div>
        </div>
      </div>
    );
  }

  // Assistant messages with no bubble, taking full width
  return (
    <div className={`p-4 w-full group relative ${className}`}>
      {/* Main content */}
      <div className="whitespace-pre-wrap break-words overflow-hidden text-gray-900 dark:text-gray-100">
        {formatContent(content)}
      </div>
      
      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex gap-1 mt-2">
          <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce"></div>
          <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )}
      
      {/* Footer section with model info and copy button aligned horizontally */}
      <div className="flex justify-between items-center mt-2">
        {/* Model info with platform icon */}
        <div className="text-xs opacity-70 flex items-center">
          {platformIconUrl && !isUser && (
            <img 
              src={platformIconUrl} 
              alt="AI Platform" 
              className="w-3 h-3 mr-1 object-contain"
            />
          )}
          {model && !isUser && <span>{model}</span>}
        </div>
        
        {/* Copy button - Right aligned, same height as model info */}
        {!isStreaming && content && (
          <button
            onClick={copyToClipboard}
            className={`p-1 rounded-md transition-opacity duration-200 z-50
                       ${copyState === 'idle' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} 
                       ${copyState === 'copied' ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 
                         copyState === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400' : 
                         'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            aria-label="Copy to clipboard"
            title="Copy to clipboard"
          >
            {copyState === 'copied' ? (
              // Checkmark icon for copied state
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : copyState === 'error' ? (
              // X icon for error state
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              // Clipboard icon for idle state
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            )}
          </button>
        )}
      </div>
      
      {/* Additional metadata display */}
      {Object.keys(metadata).length > 0 && (
        <div className="text-xs mt-1 opacity-70 overflow-hidden text-ellipsis">
          {Object.entries(metadata).map(([key, value]) => (
            <span key={key} className="mr-2 break-words">
              {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default MessageBubble;
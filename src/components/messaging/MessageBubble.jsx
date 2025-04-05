import React, { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Utility function for clipboard operations
 * Implements the document.execCommand approach for maximum compatibility
 * @param {string} text - The text content to copy to clipboard
 * @returns {boolean} - Returns true if successful, throws error otherwise
 */
const copyToClipboardUtil = (text) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  
  try {
    textarea.select();
    const successful = document.execCommand('copy');
    
    if (!successful) {
      throw new Error('ExecCommand operation failed');
    }
    
    return true;
  } finally {
    // Ensure cleanup happens regardless of success/failure
    document.body.removeChild(textarea);
  }
};

/**
 * Simple CodeBlock component with language header
 */
const CodeBlock = memo(({ className, children, isStreaming = false }) => {
  const [copyState, setCopyState] = useState('idle'); // idle, copied, error
  const codeContent = String(children).replace(/\n$/, '');
  
  // Extract language from className (format: language-python, language-javascript, etc.)
  const languageMatch = /language-(\w+)/.exec(className || '');
  const language = languageMatch ? languageMatch[1] : 'code';
  
  // Format the raw language name - just capitalize first letter
  const displayLanguage = language.charAt(0).toUpperCase() + language.slice(1);
  
  const copyCodeToClipboard = () => {
    try {
      copyToClipboardUtil(codeContent);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (error) {
      console.error('Copy method failed: ', error);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };
  
  return (
    <div className="relative code-block-group rounded-md overflow-hidden border border-theme mb-4">
      {/* Simple language header */}
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 text-xs font-medium border-b border-theme flex justify-between items-center">
        {/* Language name */}
        <span className="text-gray-600 dark:text-gray-300">{displayLanguage}</span>
        
        {/* Copy button - Only show when not streaming */}
        {!isStreaming && (
          <button
            onClick={copyCodeToClipboard}
            className={`p-1 rounded-md transition-all duration-200 shadow-sm text-xs
                      ${copyState === 'copied' ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 
                        copyState === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400' : 
                        'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            aria-label="Copy code to clipboard"
            title="Copy code to clipboard"
          >
            {copyState === 'copied' ? (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Copied</span>
              </div>
            ) : copyState === 'error' ? (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>Error</span>
              </div>
            ) : (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
                <span>Copy</span>
              </div>
            )}
          </button>
        )}
      </div>
      
      {/* Code content - Added max-height of 50vh and vertical scrolling */}
      <pre className="bg-theme-hover p-4 m-0 overflow-x-auto overflow-y-auto max-h-[50vh] text-sm font-mono">
        <code className={className}>
          {children}
        </code>
      </pre>
    </div>
  );
});

/**
 * A versatile message bubble component that supports different roles and states
 * with copy-to-clipboard functionality for assistant messages
 */
const MessageBubbleComponent = ({
  content,
  role = 'assistant',
  isStreaming = false,
  model = null,
  platformIconUrl = null,
  metadata = {},
  className = ''
}) => {
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const [copyState, setCopyState] = useState('idle'); // idle, copied, error

  // Copy assistant message to clipboard
  const copyToClipboard = () => {
    if (!content || isStreaming) return;
    
    try {
      copyToClipboardUtil(content);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (error) {
      console.error('Failed to copy text: ', error);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };
  
  // System messages (typically errors) with special styling
  if (isSystem) {
    return (
      <div className={`p-4 w-full bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 px-5 py-4 ${className}`}>
        {/* System messages render raw content, preserving whitespace */}
        <div className="whitespace-pre-wrap break-words overflow-hidden leading-relaxed">{content}</div>
      </div>
    );
  }

  // User messages with cleaner grey color scheme
  if (isUser) {
    return (
      <div className={`p-5 w-full flex justify-end ${className}`}>
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl p-4 max-w-[85%] overflow-hidden">
          {/* User messages render raw content, preserving whitespace */}
          <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed">{content}</div>
        </div>
      </div>
    );
  }

  // Assistant messages with no bubble, taking full width
  return (
    <div className={`p-4 w-full message-group relative ${className}`}>
      {/* Main content - Render Markdown for assistant messages */}
      <div className="prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 break-words overflow-hidden">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({node, ...props}) => <h1 className="text-xl font-semibold mb-3" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-lg font-medium mb-2" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-base font-medium mb-2" {...props} />,
            p: ({node, ...props}) => <p className="mb-3 last:mb-0 leading-relaxed" {...props} />,
            
            // Fixed list rendering to prevent marker line breaks
            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
            li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
            
            code: ({node, inline, className, children, ...props}) => {
              // Check if it's a block code (has language class) or inline
              const match = /language-(\w+)/.exec(className || '');
              return !inline ? (
                // Block code with copy button: use our CodeBlock component
                // Pass the isStreaming prop to CodeBlock
                <CodeBlock className={className} isStreaming={isStreaming}>
                  {children}
                </CodeBlock>
              ) : (
                // Inline code
                <code className="bg-theme-hover px-1 py-0.5 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            },
            // Ensure `pre` itself doesn't get default Prose styling if `code` handles it
            pre: ({node, children, ...props}) => <>{children}</>, // Render children directly as `code` handles the styling
            a: ({node, ...props}) => <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
            blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-theme pl-3 italic text-theme-secondary mb-3 py-0.5" {...props} />,
            strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
            em: ({node, ...props}) => <em className="italic" {...props} />,
            hr: ({node, ...props}) => <hr className="my-4 border-t border-gray-300 dark:border-gray-600" {...props} />,
            // Add other elements if needed, e.g., table
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex gap-1 mt-3">
          <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce"></div>
          <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )}
      
      {/* Footer section with model info and copy button aligned horizontally */}
      <div className="flex justify-between items-center mt-3">
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
        
        {/* Copy button - only show when not streaming */}
        {!isStreaming && content && (
          <button
            onClick={copyToClipboard}
            className={`p-1 rounded-md transition-opacity duration-200 z-50
                       ${copyState === 'idle' ? 'opacity-0 message-group-hover:opacity-100' : 'opacity-100'} 
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
        <div className="text-xs mt-2 opacity-70 overflow-hidden text-ellipsis">
          {Object.entries(metadata).map(([key, value]) => (
            <span key={key} className="mr-3 break-words">
              {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const MessageBubble = memo(MessageBubbleComponent);
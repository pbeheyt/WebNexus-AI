// src/components/messaging/MessageBubble.jsx
import React from 'react';

/**
 * A versatile message bubble component that supports different roles and states
 * 
 * @param {Object} props - Component props
 * @param {string} props.content - Message content
 * @param {string} props.role - Message role: 'user', 'assistant', or 'system'
 * @param {boolean} props.isStreaming - Whether the message is currently streaming
 * @param {string|null} props.model - Model name to display (for assistant messages)
 * @param {string|null} props.platformIconUrl - URL of the platform icon
 * @param {Object} props.metadata - Additional message metadata to display
 * @param {string} props.className - Additional CSS classes
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
  
  // System messages (typically errors) with special styling
  if (isSystem) {
    return (
      <div className={`p-3 w-full bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 px-3 py-2 ${className}`}>
        <div>{formatContent(content)}</div>
      </div>
    );
  }

  // User messages maintain bubble style but take full width
  if (isUser) {
    return (
      <div className={`p-3 w-full flex justify-end ${className}`}>
        <div className="bg-primary text-white rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl p-3 max-w-[85%]">
          <div className="whitespace-pre-wrap">{formatContent(content)}</div>
        </div>
      </div>
    );
  }

  // Assistant messages with no bubble, taking full width
  return (
    <div className={`p-3 w-full ${className}`}>
      <div className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
        {formatContent(content)}
      </div>
      
      {/* Streaming indicator - Only shown in the message bubble */}
      {isStreaming && (
        <div className="flex gap-1 mt-1">
          <div className="w-1 h-1 rounded-full bg-primary/70 dark:bg-primary/70 animate-bounce"></div>
          <div className="w-1 h-1 rounded-full bg-primary/70 dark:bg-primary/70 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-1 h-1 rounded-full bg-primary/70 dark:bg-primary/70 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )}
      
      {/* Model info with platform icon for assistant messages */}
      {!isUser && model && (
        <div className="text-xs mt-2 opacity-70 flex items-center">
          {platformIconUrl && (
            <img 
              src={platformIconUrl} 
              alt="AI Platform" 
              className="w-3 h-3 mr-1 object-contain"
            />
          )}
          <span>{model}</span>
        </div>
      )}
      
      {/* Additional metadata display */}
      {Object.keys(metadata).length > 0 && (
        <div className="text-xs mt-1 opacity-70">
          {Object.entries(metadata).map(([key, value]) => (
            <span key={key} className="mr-2">
              {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default MessageBubble;
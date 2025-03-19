// src/sidebar/components/MessageItem.jsx
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { marked } from 'marked';

// Configure marked for safe rendering
marked.setOptions({
  headerIds: false,
  mangle: false
});

const MessageItem = ({ role, content, timestamp }) => {
  const [showTimestamp, setShowTimestamp] = useState(false);
  
  // Format timestamp
  const formattedTime = new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  // Render markdown content safely
  const renderContent = () => {
    if (!content) return '';
    
    // For user messages, just use text
    if (role === 'user') {
      return content;
    }
    
    // For assistant messages, render markdown
    try {
      return { __html: marked(content) };
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return { __html: `<p>${content}</p>` };
    }
  };
  
  return (
    <div class={`message-item ${role}`} 
         onClick={() => setShowTimestamp(!showTimestamp)}>
      <div class="message-avatar">
        {role === 'user' ? '👤' : '🤖'}
      </div>
      <div class="message-content">
        {role === 'user' ? (
          <p>{content}</p>
        ) : (
          <div class="markdown-content" dangerouslySetInnerHTML={renderContent()} />
        )}
        
        {showTimestamp && (
          <div class="message-timestamp">{formattedTime}</div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;
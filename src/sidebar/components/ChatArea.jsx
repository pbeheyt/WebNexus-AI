// src/sidebar/components/ChatArea.jsx
import React, { useEffect, useRef } from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { useSidebarPlatform } from '../../contexts/platform';
import { MessageBubble } from '../../components/messaging/MessageBubble';

function ChatArea() {
  const { messages, isProcessing } = useSidebarChat();
  const messagesEndRef = useRef(null);
  const { platforms, selectedPlatformId, selectedModel } = useSidebarPlatform();
  const selectedPlatform = platforms.find(p => p.id === selectedPlatformId) || {};

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 text-center px-5">
        {selectedPlatformId && selectedPlatform.iconUrl ? (
          <>
            <img 
              src={selectedPlatform.iconUrl} 
              alt={selectedPlatform.name} 
              className="w-12 h-12 mb-2" 
            />
            {/* Display just the model name below the platform logo */}
            {selectedModel && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {selectedModel}
              </div>
            )}
          </>
        ) : (
          <div className="text-4xl mb-4 text-gray-400 dark:text-gray-600">🤖</div>
        )}
        <h3 className="text-base font-semibold mb-2">Start a conversation</h3>
        <p className="text-sm mb-4">
          Ask a question about this page or request a summary to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          content={message.content}
          role={message.role}
          isStreaming={message.isStreaming}
          model={message.model}
          platformIconUrl={message.platformIconUrl}
        />
      ))}
      
      {/* Only show this typing indicator if there's no streaming message */}
      {isProcessing && !messages.some(m => m.isStreaming) && (
        <div className="flex gap-1 p-3">
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce"></div>
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
}

export default ChatArea;
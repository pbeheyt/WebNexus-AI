import React, { useEffect, useRef } from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import ChatMessage from './ChatMessage';

function ChatArea() {
  const { messages, isProcessing } = useSidebarChat();
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 text-center px-5">
        <div className="text-4xl mb-4 text-gray-400 dark:text-gray-600">🤖</div>
        <h3 className="text-base font-semibold mb-2">Start a conversation</h3>
        <p className="text-sm mb-4">
          Ask a question about this page or request a summary to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      
      {isProcessing && (
        <div className="flex gap-1 p-3">
          <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce"></div>
          <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
}

export default ChatArea;
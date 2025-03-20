import React from 'react';
import { MESSAGE_ROLES } from '../constants';

function ChatMessage({ message }) {
  const isUser = message.role === MESSAGE_ROLES.USER;
  const isSystem = message.role === MESSAGE_ROLES.SYSTEM;
  const isStreaming = message.isStreaming;

  // Format system messages (typically errors) with different style
  if (isSystem) {
    return (
      <div className="p-3 rounded-lg w-full bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 px-3 py-2">
        <div>{message.content}</div>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg max-w-[85%] relative ${
      isUser
        ? 'bg-blue-500 text-white rounded-tl-xl rounded-tr-xl rounded-br-xl rounded-bl-none ml-auto'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl'
    }`}>
      <div>{message.content}</div>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex gap-1 mt-1">
          <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce"></div>
          <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-600 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )}

      {/* Model info for assistant messages */}
      {!isUser && message.model && (
        <div className="text-xs mt-1 opacity-70">
          {message.model}
        </div>
      )}
    </div>
  );
}

export default ChatMessage;

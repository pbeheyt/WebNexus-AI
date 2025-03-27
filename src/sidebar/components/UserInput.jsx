// src/sidebar/components/UserInput.jsx
import React from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { MessageInput } from '../../components/messaging/MessageInput';
import TokenCounter from './TokenCounter';

function UserInput({ className = '' }) {
  const {
    inputValue,
    setInputValue,
    sendMessage,
    cancelStream,
    isProcessing,
    isCanceling,
    tokenStats,
    contextStatus
  } = useSidebarChat();

  const handleInputChange = (value) => {
    setInputValue(value);
  };

  const handleSend = (value) => {
    sendMessage(value);
  };

  const handleCancel = () => {
    cancelStream();
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Token stats */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
        <TokenCounter tokenStats={tokenStats} contextStatus={contextStatus} />
      </div>

      <MessageInput
        value={inputValue}
        onChange={handleInputChange}
        onSubmit={handleSend}
        onCancel={handleCancel}
        disabled={isProcessing && isCanceling}
        isProcessing={isProcessing}
        isCanceling={isCanceling}
        placeholder="Type a message..."
        buttonLabel="Send message"
      />
    </div>
  );
}

export default UserInput;
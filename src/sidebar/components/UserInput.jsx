// src/sidebar/components/UserInput.jsx
import React from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { MessageInput } from '../../components/messaging/MessageInput';

function UserInput() {
  const { inputValue, setInputValue, sendMessage, isProcessing } = useSidebarChat();
  
  const handleInputChange = (value) => {
    setInputValue(value);
  };
  
  const handleSend = (value) => {
    sendMessage(value);
  };
  
  return (
    <MessageInput
      value={inputValue}
      onChange={handleInputChange}
      onSubmit={handleSend}
      disabled={isProcessing}
      placeholder="Type a message..."
      buttonLabel="Send message"
    />
  );
}

export default UserInput;
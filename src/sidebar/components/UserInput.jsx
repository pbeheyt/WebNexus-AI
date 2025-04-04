// src/sidebar/components/UserInput.jsx
import React from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { UnifiedInput } from '../../components/input/UnifiedInput';
// TokenCounter import removed as it's rendered within UnifiedInput
import { useContent } from '../../components/content/ContentContext';

export function UserInput({ className = '' }) {
  const { contentType } = useContent();
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
    <UnifiedInput
      value={inputValue}
      onChange={handleInputChange}
      onSubmit={handleSend}
      onCancel={handleCancel}
      disabled={isProcessing && isCanceling} // Pass the combined disabled state
      isProcessing={isProcessing}
      isCanceling={isCanceling}
      placeholder="Type a message or select a prompt..."
      contentType={contentType} // Pass contentType
      showTokenInfo={true}      // Enable token info
      tokenStats={tokenStats}     // Pass token stats
      contextStatus={contextStatus} // Pass context status
      layoutVariant='sidebar'   // Specify sidebar layout
      className={className}
    />
  );
}

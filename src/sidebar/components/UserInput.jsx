// src/sidebar/components/UserInput.jsx
import React from 'react';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { UnifiedInput } from '../../components/input/UnifiedInput'; // Changed to named import
import TokenCounter from './TokenCounter';
import { useContent } from '../../components/content/ContentContext'; // Added import

export function UserInput({ className = '' }) { // Added export keyword
  const { contentType } = useContent(); // Added hook call
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

  // Note: TokenCounter is now rendered *inside* UnifiedInput when layoutVariant='sidebar'
  // The outer div structure here might need adjustment if UnifiedInput doesn't provide it.
  // Based on UnifiedInput implementation, it *does* include the outer flex-col and renders TokenCounter first.
  // So we just replace MessageInput with UnifiedInput here.

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
      className={className}       // Pass className through
    />
  );
}

// Removed default export

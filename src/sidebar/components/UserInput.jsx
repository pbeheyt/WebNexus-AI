// src/sidebar/components/UserInput.jsx
import React from 'react';
import { useSidebarPlatform } from '../../contexts/platform';
import { useSidebarChat } from '../contexts/SidebarChatContext';
import { UnifiedInput } from '../../components/input/UnifiedInput';
import { useContent } from '../../contexts/ContentContext';

export function UserInput({ className = '' }) {
  const { contentType } = useContent();
  const { hasAnyPlatformCredentials } = useSidebarPlatform();
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
      disabled={!hasAnyPlatformCredentials || (isProcessing && isCanceling)}
      isProcessing={isProcessing}
      isCanceling={isCanceling}
      placeholder="Type a message or select a prompt..."
      contentType={contentType}
      showTokenInfo={true}
      tokenStats={tokenStats}
      contextStatus={contextStatus}
      layoutVariant='sidebar'
      className={className}
    />
  );
}

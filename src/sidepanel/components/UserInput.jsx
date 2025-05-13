// src/sidepanel/components/UserInput.jsx
import React from 'react';
import PropTypes from 'prop-types';

import { useSidePanelPlatform } from '../../contexts/platform';
import { useSidePanelChat } from '../contexts/SidePanelChatContext';
import { UnifiedInput } from '../../components/input/UnifiedInput';
import { useContent } from '../../contexts/ContentContext';

UserInput.propTypes = {
  className: PropTypes.string,
};

export function UserInput({ className = '' }) {
  const { contentType } = useContent();
  const { hasAnyPlatformCredentials } = useSidePanelPlatform();
  const {
    inputValue,
    setInputValue,
    sendMessage,
    cancelStream,
    isProcessing,
    isCanceling,
    isRefreshing,
    tokenStats,
    contextStatus,
  } = useSidePanelChat();

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
      disabled={!hasAnyPlatformCredentials || (isProcessing && isCanceling) || isRefreshing}
      isProcessing={isProcessing}
      isCanceling={isCanceling}
      placeholder='Type a message or select a prompt...'
      contentType={contentType}
      showTokenInfo={true}
      tokenStats={tokenStats}
      contextStatus={contextStatus}
      layoutVariant='sidepanel'
      className={className}
    />
  );
}

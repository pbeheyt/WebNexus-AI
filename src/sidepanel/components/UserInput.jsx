// src/sidepanel/components/UserInput.jsx
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

import { useSidePanelPlatform } from '../../contexts/platform';
import { useSidePanelChat } from '../contexts/SidePanelChatContext';
import { UnifiedInput } from '../../components/input/UnifiedInput';
import { useContent } from '../../contexts/ContentContext';
import { getSidepanelInitialPlaceholder, getSidepanelFollowUpPlaceholder } from '../../shared/utils/placeholder-utils';
import { isInjectablePage } from '../../shared/utils/content-utils';
import { CONTENT_TYPE_LABELS } from '../../shared/constants';

UserInput.propTypes = {
  className: PropTypes.string,
};

export function UserInput({ className = '' }) {
  const { contentType, currentTab, isLoading: contentLoading } = useContent();
  const { selectedPlatformId, platforms, isLoading: platformLoading, hasAnyPlatformCredentials } = useSidePanelPlatform();
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
  messages,
  isContentExtractionEnabled // <-- Ensure this is present
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

  const platformName = useMemo(() => {
    return platforms.find(p => p.id === selectedPlatformId)?.name || null;
  }, [platforms, selectedPlatformId]);

  const isPageInjectable = useMemo(() => currentTab?.url ? isInjectablePage(currentTab.url) : false, [currentTab?.url]);

  const dynamicPlaceholder = useMemo(() => {
    if (platformLoading || contentLoading) {
      return 'Loading...';
    }
    if (messages.length === 0) {
      return getSidepanelInitialPlaceholder({
        platformName,
        contentTypeLabel: contentType ? CONTENT_TYPE_LABELS[contentType] : null,
        isPageInjectable,
        isContentLoading: contentLoading,
        includeContext: isContentExtractionEnabled // Pass the toggle state
      });
    } else {
      return getSidepanelFollowUpPlaceholder({
        platformName,
        isContentLoading: contentLoading
      });
    }
  }, [messages.length, platformName, contentType, isPageInjectable, contentLoading, platformLoading, isContentExtractionEnabled]); // Added isContentExtractionEnabled

  return (
    <UnifiedInput
      value={inputValue}
      onChange={handleInputChange}
      onSubmit={handleSend}
      onCancel={handleCancel}
      disabled={!hasAnyPlatformCredentials || (isProcessing && isCanceling) || isRefreshing}
      isProcessing={isProcessing}
      isCanceling={isCanceling}
      placeholder={dynamicPlaceholder}
      contentType={contentType}
      showTokenInfo={true}
      tokenStats={tokenStats}
      contextStatus={contextStatus}
      layoutVariant='sidepanel'
      className={className}
    />
  );
}

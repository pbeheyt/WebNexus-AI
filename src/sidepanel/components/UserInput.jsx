// src/sidepanel/components/UserInput.jsx
import React, { useMemo, useState } from 'react';
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
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState('Loading...');
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
  isContentExtractionEnabled
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
    const genericLoadingPlaceholder = 'Loading...';
    
    // Condition for loading state or platform name not ready
    if (platformLoading || contentLoading || (selectedPlatformId && !platformName)) {
      // If an old specific placeholder exists (i.e., not the generic "Loading..."), show it.
      if (displayedPlaceholder !== genericLoadingPlaceholder) {
        return displayedPlaceholder;
      }
      // Otherwise (initial load or if displayedPlaceholder was already "Loading..."), show "Loading..."
      // And ensure displayedPlaceholder state is explicitly "Loading..." for the next render if it wasn't.
      if (displayedPlaceholder !== genericLoadingPlaceholder) {
         setDisplayedPlaceholder(genericLoadingPlaceholder);
      }
      return genericLoadingPlaceholder;
    }
    
    // If not loading, calculate the new placeholder
    let newPlaceholder;
    if (messages.length === 0) {
      newPlaceholder = getSidepanelInitialPlaceholder({
        platformName,
        contentTypeLabel: contentType ? CONTENT_TYPE_LABELS[contentType] : null,
        isPageInjectable,
        isContentLoading: contentLoading, // Should be false here, but pass for consistency
        includeContext: isContentExtractionEnabled,
      });
    } else {
      newPlaceholder = getSidepanelFollowUpPlaceholder({
        platformName,
        isContentLoading: contentLoading, // Should be false here
      });
    }
    
    // Update the remembered placeholder only if the new one is different
    if (newPlaceholder !== displayedPlaceholder) {
      setDisplayedPlaceholder(newPlaceholder);
    }
    return newPlaceholder;
    
  }, [
    platformLoading,
    contentLoading,
    selectedPlatformId,
    platformName,
    messages.length,
    contentType,
    isPageInjectable,
    isContentExtractionEnabled,
    displayedPlaceholder, 
  ]);

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

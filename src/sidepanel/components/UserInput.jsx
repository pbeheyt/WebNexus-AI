// src/sidepanel/components/UserInput.jsx
import React, { useMemo, useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

import { useSidePanelPlatform } from '../../contexts/platform';
import { useSidePanelChat } from '../contexts/SidePanelChatContext';
import { UnifiedInput } from '../../components/input/UnifiedInput';
import { useContent } from '../../contexts/ContentContext';
import {
  getSidepanelInitialPlaceholder,
  getSidepanelFollowUpPlaceholder,
} from '../../shared/utils/placeholder-utils';
import { isInjectablePage } from '../../shared/utils/content-utils';
import { CONTENT_TYPE_LABELS } from '../../shared/constants';

import TokenCounter from './TokenCounter';
import PlatformModelControls from './PlatformModelControls';

export function UserInput({ className = '', requestHeightRecalculation }) {
  const { contentType, currentTab, isLoading: contentLoading } = useContent();
  const [displayedPlaceholder, setDisplayedPlaceholder] =
    useState('Loading...');
  const {
    selectedPlatformId,
    platforms,
    isLoading: platformLoading,
    hasAnyPlatformCredentials,
  } = useSidePanelPlatform();
  const {
    inputValue,
    setInputValue,
    sendMessage,
    cancelStream,
    isProcessing,
    isCanceling,
    isRefreshing,
    tokenStats, // From SidePanelChatContext
    contextStatus, // From SidePanelChatContext
    messages,
    isContentExtractionEnabled,
  } = useSidePanelChat();

  const selfRef = useRef(null);

  const handlePlatformControlsToggle = useCallback(
    (_newHeight) => {
      // The actual height of PlatformModelControls is less important here
      // than the fact that its expansion state changed.
      // We rely on requestHeightRecalculation to measure the UserInput container.
      if (typeof requestHeightRecalculation === 'function') {
        requestHeightRecalculation();
      }
    },
    [requestHeightRecalculation]
  );

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
    return platforms.find((p) => p.id === selectedPlatformId)?.name || null;
  }, [platforms, selectedPlatformId]);

  const isPageInjectable = useMemo(
    () => (currentTab?.url ? isInjectablePage(currentTab.url) : false),
    [currentTab?.url]
  );

  const dynamicPlaceholder = useMemo(() => {
    const genericLoadingPlaceholder = 'Loading...';
    if (
      platformLoading ||
      contentLoading ||
      (selectedPlatformId && !platformName)
    ) {
      if (displayedPlaceholder !== genericLoadingPlaceholder) {
        return displayedPlaceholder;
      }
      if (displayedPlaceholder !== genericLoadingPlaceholder) {
        setDisplayedPlaceholder(genericLoadingPlaceholder);
      }
      return genericLoadingPlaceholder;
    }

    let newPlaceholder;
    if (messages.length === 0) {
      newPlaceholder = getSidepanelInitialPlaceholder({
        platformName,
        contentTypeLabel: contentType ? CONTENT_TYPE_LABELS[contentType] : null,
        isPageInjectable,
        isContentLoading: contentLoading,
        includeContext: isContentExtractionEnabled,
      });
    } else {
      newPlaceholder = getSidepanelFollowUpPlaceholder({
        platformName,
        isContentLoading: contentLoading,
      });
    }

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
    <div ref={selfRef} className={`flex flex-col ${className}`}>
      {/* Token Counter Section */}
      <TokenCounter tokenStats={tokenStats} contextStatus={contextStatus} />

      {/* Platform and Model Controls Section */}
      <PlatformModelControls onToggleExpand={handlePlatformControlsToggle} />

      {/* Unified Input (TextArea and buttons) Section */}
      <UnifiedInput
        value={inputValue}
        onChange={handleInputChange}
        onSubmit={handleSend}
        onCancel={handleCancel}
        disabled={
          !hasAnyPlatformCredentials ||
          (isProcessing && isCanceling) ||
          isRefreshing
        }
        isProcessing={isProcessing}
        isCanceling={isCanceling}
        placeholder={dynamicPlaceholder}
        contentType={contentType}
        layoutVariant='sidepanel'
        className=''
      />
    </div>
  );
}

UserInput.propTypes = {
  className: PropTypes.string,
  requestHeightRecalculation: PropTypes.func.isRequired,
};
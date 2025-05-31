// src/sidepanel/components/Header.jsx
import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';

import {
  ContentTypeIcon,
  InputTokenIcon,
  OutputTokenIcon,
  ContextWindowIcon,
  Toggle,
  Tooltip,
  ExtractionStrategySelector,
} from '../../components';
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
} from '../../shared/constants';
import { formatTokenCount, formatCost } from '../../shared/utils/number-format-utils';

function Header({
  isExpanded,
  tokenStats,
  contextStatus,
  contentType,
  isPageInjectable,
  isContentExtractionEnabled,
  setIsContentExtractionEnabled,
  hasAnyPlatformCredentials,
}) {
  const [isIncludeTooltipVisible, setIsIncludeTooltipVisible] = useState(false);
  const includeToggleRef = useRef(null);

  const [hoveredTokenElement, setHoveredTokenElement] = useState(null);
  const inputTokensRef = useRef(null);
  const outputTokensRef = useRef(null);
  const contextWindowRef = useRef(null);
  const costRef = useRef(null);

  if (!isExpanded) {
    return null;
  }

  const {
    outputTokens = 0,
    accumulatedCost = 0,
    inputTokensInLastApiCall = 0,
    promptTokensInLastApiCall = 0,
    historyTokensSentInLastApiCall = 0,
    systemTokensInLastApiCall = 0,
  } = tokenStats || {};

  const contextData = contextStatus || {
    percentage: 0,
    tokensRemaining: 0,
    totalTokens: 0,
    maxContextWindow: 0,
  };

  const formattedAccumulatedCost = formatCost(accumulatedCost);

  const tokenTooltipContent = {
    inputTokens: `Est. Input: ${formatTokenCount(promptTokensInLastApiCall)} (Prompt) + ${formatTokenCount(historyTokensSentInLastApiCall)} (History) + ${formatTokenCount(systemTokensInLastApiCall)} (System) = ${formatTokenCount(inputTokensInLastApiCall)} total.`,
    outputTokens: `Est. total output tokens generated in this chat session.`,
    contextWindow: `Est. ${formatTokenCount(contextData.tokensRemaining)} tokens remaining (${formatTokenCount(contextData.totalTokens)} / ${formatTokenCount(contextData.maxContextWindow)} used).`,
    cost: `Est. total accumulated cost for this chat session.`, // Tooltip for cost
  };

  return (
    <div className='px-5 py-2 border-b border-t border-theme flex justify-between items-center min-h-[40px]'>
      {/* Left Section: Content Extraction Controls */}
      <div className='flex items-center gap-1 text-xs text-theme-secondary cursor-default'>
        {isPageInjectable ? (
          <>
            <ContentTypeIcon
              contentType={contentType}
              className='w-5 h-5 text-current flex-shrink-0'
            />
            <span className='text-sm font-medium ml-1 mr-2 whitespace-nowrap'>
              {CONTENT_TYPE_LABELS[contentType] || 'Content'}
            </span>
            <span
              ref={includeToggleRef}
              onMouseEnter={() => setIsIncludeTooltipVisible(true)}
              onMouseLeave={() => setIsIncludeTooltipVisible(false)}
              onFocus={() => setIsIncludeTooltipVisible(true)}
              onBlur={() => setIsIncludeTooltipVisible(false)}
              aria-describedby='include-context-tooltip-header'
              className='inline-flex items-center flex-shrink-0'
            >
              <Toggle
                id='content-extract-toggle-header'
                checked={isContentExtractionEnabled}
                onChange={(newCheckedState) => {
                  if (hasAnyPlatformCredentials)
                    setIsContentExtractionEnabled(newCheckedState);
                }}
                disabled={!hasAnyPlatformCredentials}
                className='w-9 h-5 ml-1'
              />
            </span>
            <Tooltip
              show={isIncludeTooltipVisible}
              targetRef={includeToggleRef}
              message='Send page content with your prompt.'
              position='bottom'
              id='include-context-tooltip-header'
            />
            {contentType === CONTENT_TYPES.GENERAL && (
              <ExtractionStrategySelector
                disabled={!hasAnyPlatformCredentials}
                className='ml-2 flex-shrink-0'
              />
            )}
          </>
        ) : (
          <div className='text-xs text-theme-secondary whitespace-nowrap'>
            Page content cannot be extracted.
          </div>
        )}
      </div>

      {/* Right Section: Token Information */}
      <div className='flex items-center space-x-3 text-xs text-theme-secondary'>
        {/* Input Tokens */}
        <div
          ref={inputTokensRef}
          className='flex items-center relative cursor-help'
          onMouseEnter={() => setHoveredTokenElement('inputTokens')}
          onMouseLeave={() => setHoveredTokenElement(null)}
          onFocus={() => setHoveredTokenElement('inputTokens')}
          onBlur={() => setHoveredTokenElement(null)}
        >
          <InputTokenIcon className='w-3.5 h-3.5 mr-1 select-none flex-shrink-0' />
          <span className='whitespace-nowrap'>{formatTokenCount(inputTokensInLastApiCall)}</span>
          <Tooltip
            show={hoveredTokenElement === 'inputTokens'}
            message={tokenTooltipContent.inputTokens}
            targetRef={inputTokensRef}
            position='bottom'
          />
        </div>

        {/* Output Tokens */}
        <div
          ref={outputTokensRef}
          className='flex items-center relative cursor-help'
          onMouseEnter={() => setHoveredTokenElement('outputTokens')}
          onMouseLeave={() => setHoveredTokenElement(null)}
          onFocus={() => setHoveredTokenElement('outputTokens')}
          onBlur={() => setHoveredTokenElement(null)}
        >
          <OutputTokenIcon className='w-3.5 h-3.5 mr-1 select-none flex-shrink-0' />
          <span className='whitespace-nowrap'>{formatTokenCount(outputTokens)}</span>
          <Tooltip
            show={hoveredTokenElement === 'outputTokens'}
            message={tokenTooltipContent.outputTokens}
            targetRef={outputTokensRef}
            position='bottom'
          />
        </div>

        {/* Context Window Percentage */}
        <div
          ref={contextWindowRef}
          className='flex items-center relative cursor-help'
          onMouseEnter={() => setHoveredTokenElement('contextWindow')}
          onMouseLeave={() => setHoveredTokenElement(null)}
          onFocus={() => setHoveredTokenElement('contextWindow')}
          onBlur={() => setHoveredTokenElement(null)}
        >
          <ContextWindowIcon className='w-3.5 h-3.5 mr-1 select-none flex-shrink-0' />
          <span className='whitespace-nowrap'>{`${(contextData.percentage || 0).toFixed(0)}%`}</span>
          <Tooltip
            show={hoveredTokenElement === 'contextWindow'}
            message={tokenTooltipContent.contextWindow}
            targetRef={contextWindowRef}
            position='bottom'
          />
        </div>

        {/* Accumulated Cost */}
        <div
          ref={costRef}
          className='flex items-center relative cursor-help mr-1'
          onMouseEnter={() => setHoveredTokenElement('cost')}
          onMouseLeave={() => setHoveredTokenElement(null)}
          onFocus={() => setHoveredTokenElement('cost')}
          onBlur={() => setHoveredTokenElement(null)}
        >
          {/* No icon for cost, just the value */}
          <span className='whitespace-nowrap'>{formattedAccumulatedCost}</span>
          <Tooltip
            show={hoveredTokenElement === 'cost'}
            message={tokenTooltipContent.cost}
            targetRef={costRef}
            position='bottom'
          />
        </div>
      </div>
    </div>
  );
}

Header.propTypes = {
  isExpanded: PropTypes.bool,
  tokenStats: PropTypes.object,
  contextStatus: PropTypes.object,
  contentType: PropTypes.string,
  isPageInjectable: PropTypes.bool,
  isContentExtractionEnabled: PropTypes.bool,
  setIsContentExtractionEnabled: PropTypes.func,
  hasAnyPlatformCredentials: PropTypes.bool,
};

export default Header;
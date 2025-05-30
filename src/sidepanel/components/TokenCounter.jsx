import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';

import { Tooltip } from '../../components/layout/Tooltip';
import {
  InputTokenIcon,
  OutputTokenIcon,
  ContextWindowIcon,
} from '../../components';

function TokenCounter({ tokenStats, contextStatus, className = '' }) {
  const {
    outputTokens = 0,
    accumulatedCost = 0,
    inputTokensInLastApiCall = 0,
    promptTokensInLastApiCall = 0,
    historyTokensSentInLastApiCall = 0,
    systemTokensInLastApiCall = 0,
  } = tokenStats || {};

  const [hoveredElement, setHoveredElement] = useState(null);

  const inputTokensRef = useRef(null);
  const outputTokensRef = useRef(null);
  const costRef = useRef(null);
  const contextWindowRef = useRef(null);

  const formatCost = (cost) => {
    if (cost === 0) return '$0.00';
    if (cost < 0.01) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }).format(cost);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    }).format(cost);
  };

  const formattedCost = formatCost(accumulatedCost);

  const contextData = contextStatus || {
    percentage: 0,
    tokensRemaining: 0,
    totalTokens: 0,
    maxContextWindow: 0,
  };

  const tooltipContent = {
    inputTokens: `Est. Input: ${promptTokensInLastApiCall.toLocaleString()} (Prompt) + ${historyTokensSentInLastApiCall.toLocaleString()} (History) + ${systemTokensInLastApiCall.toLocaleString()} (System) = ${inputTokensInLastApiCall.toLocaleString()} total.`,
    outputTokens: `Est. total output tokens generated in this chat session.`,
    cost: `Est. total accumulated cost for this chat session.`,
    contextWindow: `Est. ${contextData.tokensRemaining.toLocaleString()} tokens remaining (${contextData.totalTokens.toLocaleString()} / ${contextData.maxContextWindow.toLocaleString()} used).`,
  };

  return (
    <div className={`text-xs text-theme-secondary px-3 py-2 ${className}`}>
      <div className='flex items-center justify-around'>
        {/* Metric 1: Input Tokens */}
        <div
          ref={inputTokensRef}
          className='flex items-center relative cursor-help'
          onMouseEnter={() => setHoveredElement('inputTokens')}
          onMouseLeave={() => setHoveredElement(null)}
          onFocus={() => setHoveredElement('inputTokens')}
          onBlur={() => setHoveredElement(null)}
        >
          <InputTokenIcon className='w-3 h-3 mr-1 select-none' />
          <span>{inputTokensInLastApiCall.toLocaleString()}</span>
          <Tooltip
            show={hoveredElement === 'inputTokens'}
            message={tooltipContent.inputTokens}
            targetRef={inputTokensRef}
            position='bottom'
          />
        </div>

        {/* Metric 2: Output Tokens */}
        <div
          ref={outputTokensRef}
          className='flex items-center relative cursor-help'
          onMouseEnter={() => setHoveredElement('outputTokens')}
          onMouseLeave={() => setHoveredElement(null)}
          onFocus={() => setHoveredElement('outputTokens')}
          onBlur={() => setHoveredElement(null)}
        >
          <OutputTokenIcon className='w-3 h-3 mr-1 select-none' />
          <span>{outputTokens.toLocaleString()}</span>
          <Tooltip
            show={hoveredElement === 'outputTokens'}
            message={tooltipContent.outputTokens}
            targetRef={outputTokensRef}
            position='bottom'
          />
        </div>

        {/* Metric 3: Context Window Percentage */}
        <div
          ref={contextWindowRef}
          className='flex items-center relative cursor-help'
          onMouseEnter={() => setHoveredElement('contextWindow')}
          onMouseLeave={() => setHoveredElement(null)}
          onFocus={() => setHoveredElement('contextWindow')}
          onBlur={() => setHoveredElement(null)}
        >
          <ContextWindowIcon className='w-3 h-3 mr-1 select-none' />
          <span>{`${(contextData.percentage || 0).toFixed(1)}%`}</span>
          <Tooltip
            show={hoveredElement === 'contextWindow'}
            message={tooltipContent.contextWindow}
            targetRef={contextWindowRef}
            position='bottom'
          />
        </div>

        {/* Metric 4: Accumulated Cost */}
        <div
          ref={costRef}
          className='relative cursor-help'
          onMouseEnter={() => setHoveredElement('cost')}
          onMouseLeave={() => setHoveredElement(null)}
          onFocus={() => setHoveredElement('cost')}
          onBlur={() => setHoveredElement(null)}
        >
          <span>{formattedCost}</span>
          <Tooltip
            show={hoveredElement === 'cost'}
            message={tooltipContent.cost}
            targetRef={costRef}
            position='bottom'
          />
        </div>
      </div>
    </div>
  );
}

TokenCounter.propTypes = {
  tokenStats: PropTypes.object,
  contextStatus: PropTypes.object,
  className: PropTypes.string,
};

export default TokenCounter;
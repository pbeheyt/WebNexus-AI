import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';

import { logger } from '../../shared/logger';
import { Tooltip } from '../../components/layout/Tooltip';
import { InputTokenIcon, OutputTokenIcon, ChevronUpIcon } from '../../components';

function TokenCounter({ tokenStats, contextStatus, className = '' }) {
  const {
    outputTokens = 0,
    accumulatedCost = 0,
    historyTokensSentInLastApiCall = 0,
    inputTokensInLastApiCall = 0,
    lastApiCallCost = 0,
    promptTokensInLastApiCall = 0,
    systemTokensInLastApiCall = 0,
  } = tokenStats || {};

  // Toggle for expanded details view
  const [showDetails, setShowDetails] = useState(false);

  // Tooltip hover states
  const [hoveredElement, setHoveredElement] = useState(null);

  // Refs for tooltip targets
  const inputTokensRef = useRef(null);
  const outputTokensRef = useRef(null);
  const costRef = useRef(null);
  const lastCostRef = useRef(null);
  const promptRef = useRef(null);
  const historySentRef = useRef(null);
  const systemRef = useRef(null);
  const contextWindowRef = useRef(null);

  // Format cost with appropriate decimal places
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

  // Ensure we have context status data with safe defaults
  const contextData = contextStatus || {
    warningLevel: 'none',
    percentage: 0,
    tokensRemaining: 0,
    totalTokens: 0, // Ensure totalTokens exists for the tooltip
  };

  // Ensure tokensRemaining is always defined with a safe default
  const tokensRemaining = contextData.tokensRemaining || 0;

  // Tooltip content definitions (Incorporating the base disclaimer)
  const tooltipContent = {
    inputTokens: `Est. total input tokens ( prompt + history + system) sent in the last API request.`,
    outputTokens: `Est. total output tokens generated in this chat session.`,
    cost: `Est. total accumulated cost for this chat session.`,
    lastCost: `Est. cost of the last API call.`,
    prompt: `Est. tokens in the user prompt sent in the last API request.`,
    historySent: `Est. tokens from conversation history sent in the last API request.`,
    system: `Est. tokens from system instructions sent in the last API request.`,
    contextWindow: `Est. ${tokensRemaining.toLocaleString()} tokens remaining in context window (${contextData.totalTokens?.toLocaleString()} used).`,
  };

  return (
    <div className='text-xs text-gray-500 dark:text-gray-400'>
      <div className={`flex items-center justify-between ${className}`}>
        <div className='flex items-center gap-2'>
          {/* Input tokens with tooltip */}
          <div
            ref={inputTokensRef}
            className='flex items-center relative cursor-help'
            onMouseEnter={() => setHoveredElement('inputTokens')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('inputTokens')}
            onBlur={() => setHoveredElement(null)}
          >
            <InputTokenIcon className='w-3 h-3 mr-1 select-none' />
            <span className='select-none'>
              {inputTokensInLastApiCall.toLocaleString()}
            </span>
            <Tooltip
              show={hoveredElement === 'inputTokens'}
              message={tooltipContent.inputTokens}
              targetRef={inputTokensRef}
            />
          </div>

          {/* Output tokens (Cumulative) with tooltip */}
          <div
            ref={outputTokensRef}
            className='flex items-center relative cursor-help'
            onMouseEnter={() => setHoveredElement('outputTokens')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('outputTokens')}
            onBlur={() => setHoveredElement(null)}
          >
            <OutputTokenIcon className='w-3 h-3 mr-1 select-none' />
            <span className='select-none'>{outputTokens.toLocaleString()}</span>
            <Tooltip
              show={hoveredElement === 'outputTokens'}
              message={tooltipContent.outputTokens}
              targetRef={outputTokensRef}
            />
          </div>
        </div>

        <div className='flex items-center'>
          {/* Last Call Cost with tooltip */}
          <div
            ref={lastCostRef}
            className='relative cursor-help text-gray-400 dark:text-gray-500 mr-2'
            onMouseEnter={() => setHoveredElement('lastCost')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('lastCost')}
            onBlur={() => setHoveredElement(null)}
          >
            <span className='select-none'>({formatCost(lastApiCallCost)})</span>
            <Tooltip
              show={hoveredElement === 'lastCost'}
              message={tooltipContent.lastCost}
              targetRef={lastCostRef}
            />
          </div>

          {/* Accumulated Cost with tooltip */}
          <div
            ref={costRef}
            className='relative cursor-help'
            onMouseEnter={() => setHoveredElement('cost')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('cost')}
            onBlur={() => setHoveredElement(null)}
          >
            <span className='select-none'>{formattedCost}</span>
            <Tooltip
              show={hoveredElement === 'cost'}
              message={tooltipContent.cost}
              targetRef={costRef}
            />
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className='ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none'
            title='Toggle token details'
          >
            <ChevronUpIcon className={`w-3 h-3 transition-transform select-none ${showDetails ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* --- Expanded Details Section --- */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          showDetails
            ? 'max-h-40 opacity-100 mt-2 pt-3 pb-1 border-t border-gray-200 dark:border-gray-700'
            : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!showDetails}
      >
        {/* Grid for detailed token breakdown */}
        <div className='grid grid-cols-3 gap-2'>
            {/* Prompt tokens */}
            <div
              ref={promptRef}
              className='flex flex-col items-center relative cursor-help'
              onMouseEnter={() => setHoveredElement('prompt')}
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('prompt')}
              onBlur={() => setHoveredElement(null)}
            >
              <span className='text-xs font-medium select-none'>Prompt</span>
              <span className='select-none'>
                {promptTokensInLastApiCall.toLocaleString()}
              </span>
              <Tooltip
                show={hoveredElement === 'prompt'}
                message={tooltipContent.prompt}
                targetRef={promptRef}
              />
            </div>

            {/* History Sent tokens */}
            <div
              ref={historySentRef}
              className='flex flex-col items-center relative cursor-help'
              onMouseEnter={() => setHoveredElement('historySent')}
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('historySent')}
              onBlur={() => setHoveredElement(null)}
            >
              <span className='text-xs font-medium select-none'>History</span>
              <span className='select-none'>
                {historyTokensSentInLastApiCall.toLocaleString()}
              </span>
              <Tooltip
                show={hoveredElement === 'historySent'}
                message={tooltipContent.historySent}
                targetRef={historySentRef}
              />
            </div>

            {/* System Sent tokens */}
            <div
              ref={systemRef}
              className='flex flex-col items-center relative cursor-help'
              onMouseEnter={() => setHoveredElement('system')}
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('system')}
              onBlur={() => setHoveredElement(null)}
            >
              <span className='text-xs font-medium select-none'>System</span>
              <span className='select-none'>
                {systemTokensInLastApiCall.toLocaleString()}
              </span>
              <Tooltip
                show={hoveredElement === 'system'}
                message={tooltipContent.system}
                targetRef={systemRef}
              />
            </div>
          </div>

        {/* Context window progress bar */}
        <div className='mt-2'>
          <div
            ref={contextWindowRef}
            className='flex items-center relative cursor-help'
            onMouseEnter={() => setHoveredElement('contextWindow')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('contextWindow')}
            onBlur={() => setHoveredElement(null)}
          >
            <div className='h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full mr-2 select-none'>
              <div
                className={`h-1.5 rounded-full ${
                  contextData.warningLevel === 'critical'
                    ? 'bg-red-500'
                    : contextData.warningLevel === 'warning'
                      ? 'bg-yellow-500'
                      : contextData.warningLevel === 'notice'
                        ? 'bg-blue-500'
                        : 'bg-gray-500'
                }`}
                style={{
                  width: `${Math.min(100, contextData.percentage || 0)}%`,
                }}
              ></div>
            </div>
            <span className='text-xs whitespace-nowrap select-none'>
              {Math.min(100, contextData.percentage || 0).toFixed(1)}%
            </span>
            <Tooltip
              show={hoveredElement === 'contextWindow'}
              message={tooltipContent.contextWindow}
              position='bottom'
              targetRef={contextWindowRef}
            />
          </div>
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

import React, { useState, useRef } from 'react';
import { Tooltip } from '../../components/layout/Tooltip';

function TokenCounter({ tokenStats, contextStatus, className = '' }) {
  const {
    inputTokens = 0,
    outputTokens = 0,
    accumulatedCost = 0,
    promptTokens = 0,
    historyTokens = 0,
    historyTokensSentInLastCall = 0,
    inputTokensInLastCall = 0,
    outputTokensInLastCall = 0, // Added field
    lastCallCost = 0, // Added field
    systemTokens = 0
  } = tokenStats || {};

  // Toggle for expanded details view
  const [showDetails, setShowDetails] = useState(false);

  // Tooltip hover states
  const [hoveredElement, setHoveredElement] = useState(null);

  // Refs for tooltip targets
  const inputTokensRef = useRef(null);
  const outputTokensRef = useRef(null);
  const costRef = useRef(null); // For accumulated cost
  const lastCostRef = useRef(null); // For last call cost
  const promptRef = useRef(null);
  const historyRef = useRef(null);
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
        maximumFractionDigits: 4
      }).format(cost);
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 3
    }).format(cost);
  };

  const formattedCost = formatCost(accumulatedCost);

  // Ensure we have context status data with safe defaults
  const contextData = contextStatus || {
    warningLevel: 'none',
    percentage: 0,
    tokensRemaining: 0
  };

  // Ensure tokensRemaining is always defined with a safe default
  const tokensRemaining = contextData.tokensRemaining || 0;

  // Tooltip content definitions
  const tooltipContent = {
    inputTokens: "Input tokens sent in the last API request",
    outputTokens: "Total output tokens generated in this chat session", // Updated tooltip
    cost: "Total estimated accumulated cost for this chat session", // Updated tooltip
    lastCost: "Estimated cost of the last API call", // New tooltip
    prompt: "Tokens in your most recent message",
    history: "Tokens from conversation history sent in the last API request",
    system: "Tokens from system instructions and settings",
    contextWindow: `${tokensRemaining.toLocaleString()} tokens remaining in the context window`
  };

  return (
    <div className="text-xs text-gray-500 dark:text-gray-400">
      <div className={`flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-2">
          {/* Input tokens with tooltip */}
          <div
            ref={inputTokensRef}
            className="flex items-center relative cursor-help"
            onMouseEnter={() => setHoveredElement('inputTokens')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('inputTokens')}
            onBlur={() => setHoveredElement(null)}
            tabIndex="0"
          >
            <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {/* Display input tokens from the last call */}
            <span>{inputTokensInLastCall.toLocaleString()}</span>
            <Tooltip show={hoveredElement === 'inputTokens'} message={tooltipContent.inputTokens} targetRef={inputTokensRef} />
          </div>

          {/* Output tokens with tooltip */}
          <div
            ref={outputTokensRef}
            className="flex items-center relative cursor-help"
            onMouseEnter={() => setHoveredElement('outputTokens')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('outputTokens')}
            onBlur={() => setHoveredElement(null)}
            tabIndex="0"
          >
            <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" transform="rotate(45, 12, 12)"/>
            </svg>
            {/* Display TOTAL output tokens */}
            <span>{outputTokens.toLocaleString()}</span>
            <Tooltip show={hoveredElement === 'outputTokens'} message={tooltipContent.outputTokens} targetRef={outputTokensRef} />
          </div>
        </div>

        <div className="flex items-center">
          {/* Accumulated Cost with tooltip */}
          <div
            ref={costRef}
            className="relative cursor-help mr-2" // Added margin
            onMouseEnter={() => setHoveredElement('cost')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('cost')}
            onBlur={() => setHoveredElement(null)}
            tabIndex="0"
          >
            <span>{formattedCost}</span>
            <Tooltip show={hoveredElement === 'cost'} message={tooltipContent.cost} targetRef={costRef} />
          </div>

          {/* Last Call Cost with tooltip */}
          <div
            ref={lastCostRef}
            className="relative cursor-help text-gray-400 dark:text-gray-500"
            onMouseEnter={() => setHoveredElement('lastCost')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('lastCost')}
            onBlur={() => setHoveredElement(null)}
            tabIndex="0"
          >
            <span>(Last: {formatCost(lastCallCost)})</span>
            <Tooltip show={hoveredElement === 'lastCost'} message={tooltipContent.lastCost} targetRef={lastCostRef} />
          </div>


          <button
            onClick={() => setShowDetails(!showDetails)}
            className="ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
            title="Toggle token details"
          >
          <svg className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 15l-7 -7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          </button>
        </div>
      </div>

      {showDetails && (
        <>
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-2">
            {/* Prompt tokens with tooltip */}
            <div
              ref={promptRef}
              className="flex flex-col items-center relative cursor-help"
              onMouseEnter={() => setHoveredElement('prompt')}
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('prompt')}
              onBlur={() => setHoveredElement(null)}
              tabIndex="0"
            >
              <span className="text-xs font-medium">Prompt</span>
              <span>{promptTokens.toLocaleString()}</span>
              <Tooltip show={hoveredElement === 'prompt'} message={tooltipContent.prompt} targetRef={promptRef} />
            </div>

            {/* Last Output tokens (Optional but recommended) */}
            <div
              // ref={lastOutputRef} // Add ref if tooltip needed
              className="flex flex-col items-center relative"
              // Add hover/focus handlers if tooltip needed
            >
              <span className="text-xs font-medium">Last Output</span>
              <span>{outputTokensInLastCall.toLocaleString()}</span>
              {/* Add Tooltip if needed */}
            </div>

            {/* History tokens with tooltip */}
            <div
              ref={historyRef}
              className="flex flex-col items-center relative cursor-help"
              onMouseEnter={() => setHoveredElement('history')}
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('history')}
              onBlur={() => setHoveredElement(null)}
              tabIndex="0"
            >
              <span className="text-xs font-medium">History Sent</span> {/* Clarified label */}
              {/* Display the history tokens sent in the last call */}
              <span>{historyTokensSentInLastCall.toLocaleString()}</span>
              <Tooltip show={hoveredElement === 'history'} message={tooltipContent.history} targetRef={historyRef} />
            </div>

            {/* System tokens with tooltip */}
            <div
              ref={systemRef}
              className="flex flex-col items-center relative cursor-help"
              onMouseEnter={() => setHoveredElement('system')}
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('system')}
              onBlur={() => setHoveredElement(null)}
              tabIndex="0"
            >
              <span className="text-xs font-medium">System</span>
              <span>{systemTokens.toLocaleString()}</span>
              <Tooltip show={hoveredElement === 'system'} message={tooltipContent.system} targetRef={systemRef} />
            </div>
          </div>

          {/* Context window progress bar with tooltip */}
          <div className="mt-3">
            <div
              ref={contextWindowRef}
              className="flex items-center relative cursor-help"
              onMouseEnter={() => setHoveredElement('contextWindow')}
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('contextWindow')}
              onBlur={() => setHoveredElement(null)}
              tabIndex="0"
            >
              <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full mr-2">
                <div
                  className={`h-1.5 rounded-full ${
                    contextData.warningLevel === 'critical' ? 'bg-red-500' :
                    contextData.warningLevel === 'warning' ? 'bg-yellow-500' :
                    contextData.warningLevel === 'notice' ? 'bg-blue-500' : 'bg-gray-500'
                  }`}
                  style={{ width: `${Math.min(100, contextData.percentage || 0)}%` }}
                ></div>
              </div>
              <span className="text-xs whitespace-nowrap">
                {Math.min(100, contextData.percentage || 0).toFixed(1)}%
              </span>
              <Tooltip show={hoveredElement === 'contextWindow'} message={tooltipContent.contextWindow} position="bottom" targetRef={contextWindowRef} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TokenCounter;

import React, { useState, useRef } from 'react';
import { Tooltip } from '../../components/layout/Tooltip';

function TokenCounter({ tokenStats, contextStatus, className = '' }) {
  // Destructure using the new field names and remove unused ones
  const {
    // inputTokens = 0, // REMOVED (cumulative)
    outputTokens = 0, // KEEP (cumulative)
    accumulatedCost = 0, // KEEP (cumulative)
    // promptTokens = 0, // REMOVED (old name)
    // historyTokens = 0, // REMOVED (cumulative)
    historyTokensSentInLastApiCall = 0, // KEEP
    inputTokensInLastApiCall = 0, // KEEP
    // outputTokensInApiLastCall = 0, // REMOVED as requested
    lastApiCallCost = 0, // KEEP
    // systemTokens = 0, // REMOVED (old name)
    promptTokensInLastApiCall = 0, // ADDED (new name)
    systemTokensInLastApiCall = 0 // ADDED (new name)
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
  const promptRef = useRef(null); // Will be "Last Prompt"
  // const historyRef = useRef(null); // REMOVED (cumulative history display)
  const historySentRef = useRef(null); // ADDED (for history sent in last call)
  const systemRef = useRef(null); // Will be "System Sent"
  // const lastOutputRef = useRef(null); // REMOVED (last output tokens)
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

  // Tooltip content definitions (updated for estimates)
  const tooltipContent = {
    inputTokens: "Est. input tokens (system + history + prompt) sent in the last API request. Based on tiktoken(cl100k_base), may differ from actual platform count.",
    outputTokens: "Est. total output tokens generated in this chat session. Based on tiktoken(cl100k_base), may differ from actual platform count.",
    cost: "Est. total accumulated cost for this chat session. Based on tiktoken(cl100k_base) estimates.",
    lastCost: "Est. cost of the last API call. Based on tiktoken(cl100k_base) estimates.",
    prompt: "Est. tokens in the user prompt sent in the last API request. Based on tiktoken(cl100k_base), may differ from actual platform count.",
    historySent: "Est. tokens from conversation history sent in the last API request. Based on tiktoken(cl100k_base), may differ from actual platform count.",
    system: "Est. tokens from system instructions sent in the last API request. Based on tiktoken(cl100k_base), may differ from actual platform count.",
    contextWindow: `Est. ${tokensRemaining.toLocaleString()} tokens remaining (${contextData.totalTokens?.toLocaleString()} used). Context usage is estimated with tiktoken(cl100k_base) and may differ from the platform's limit calculation.`
  };

  return (
    <div className="text-xs text-gray-500 dark:text-gray-400">
      <div className={`flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-2">
          {/* Input tokens with tooltip - Updated SVG */}
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
              {/* Up arrow for input (sending data) */}
              <path d="M12 18V6M7 11l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* Display input tokens from the last call */}
            <span className="mr-1">Est. In:</span> {/* Added Label */}
            <span>{inputTokensInLastApiCall.toLocaleString()}</span>
            <Tooltip show={hoveredElement === 'inputTokens'} message={tooltipContent.inputTokens} targetRef={inputTokensRef} />
          </div>

          {/* Output tokens (Cumulative) with tooltip - Updated SVG */}
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
              {/* Down arrow for output (receiving data) */}
              <path d="M12 6v12M7 13l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* Display TOTAL output tokens */}
            <span className="mr-1">Est. Out:</span> {/* Added Label */}
            <span>{outputTokens.toLocaleString()}</span>
            <Tooltip show={hoveredElement === 'outputTokens'} message={tooltipContent.outputTokens} targetRef={outputTokensRef} />
          </div>
        </div>

        <div className="flex items-center">
          {/* Last Call Cost with tooltip */}
          <div
            ref={lastCostRef}
            className="relative cursor-help text-gray-400 dark:text-gray-500 mr-2" // Added margin
            onMouseEnter={() => setHoveredElement('lastCost')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('lastCost')}
            onBlur={() => setHoveredElement(null)}
            tabIndex="0"
          >
            <span>(Est. Last: {formatCost(lastApiCallCost)})</span> {/* Updated Label */}
            <Tooltip show={hoveredElement === 'lastCost'} message={tooltipContent.lastCost} targetRef={lastCostRef} />
          </div>

          {/* Accumulated Cost with tooltip */}
          <div
            ref={costRef}
            className="relative cursor-help"
            onMouseEnter={() => setHoveredElement('cost')}
            onMouseLeave={() => setHoveredElement(null)}
            onFocus={() => setHoveredElement('cost')}
            onBlur={() => setHoveredElement(null)}
            tabIndex="0"
          >
            <span className="mr-1">Est. Total:</span> {/* Added Label */}
            <span>{formattedCost}</span>
            <Tooltip show={hoveredElement === 'cost'} message={tooltipContent.cost} targetRef={costRef} />
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
              <span className="text-xs font-medium">Est. Prompt</span> {/* Updated Label */}
              <span>{promptTokensInLastApiCall.toLocaleString()}</span> {/* Updated Value */}
              <Tooltip show={hoveredElement === 'prompt'} message={tooltipContent.prompt} targetRef={promptRef} />
            </div>

            {/* History Sent tokens with tooltip */}
            <div
              ref={historySentRef} // Use new ref
              className="flex flex-col items-center relative cursor-help"
              onMouseEnter={() => setHoveredElement('historySent')} // Use new key
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('historySent')} // Use new key
              onBlur={() => setHoveredElement(null)}
              tabIndex="0"
            >
              <span className="text-xs font-medium">Est. History</span> {/* Updated Label */}
              <span>{historyTokensSentInLastApiCall.toLocaleString()}</span> {/* Value remains */}
              <Tooltip show={hoveredElement === 'historySent'} message={tooltipContent.historySent} targetRef={historySentRef} /> {/* Use new key/ref */}
            </div>

            {/* System Sent tokens with tooltip */}
            <div
              ref={systemRef}
              className="flex flex-col items-center relative cursor-help"
              onMouseEnter={() => setHoveredElement('system')}
              onMouseLeave={() => setHoveredElement(null)}
              onFocus={() => setHoveredElement('system')}
              onBlur={() => setHoveredElement(null)}
              tabIndex="0"
            >
              <span className="text-xs font-medium">Est. System</span> {/* Updated Label */}
              <span>{systemTokensInLastApiCall.toLocaleString()}</span> {/* Updated Value */}
              <Tooltip show={hoveredElement === 'system'} message={tooltipContent.system} targetRef={systemRef} />
            </div>

            {/* REMOVED cumulative inputTokens display */}
            {/* REMOVED cumulative historyTokens display */}
            {/* REMOVED Last Output display */}
          </div>

          {/* Context window progress bar with tooltip (verify calculation) */}
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

          {/* Context window progress bar with tooltip (verify calculation) */}
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
      {/* Disclaimer Added Below */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">
        *Token counts & costs are estimates using tiktoken(cl100k_base) and may vary from actual platform usage.*
      </p>
    </div>
  );
}

export default TokenCounter;

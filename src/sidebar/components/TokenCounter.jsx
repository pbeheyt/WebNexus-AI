// src/sidebar/components/TokenCounter.jsx

import React, { useState } from 'react';

function TokenCounter({ tokenStats, contextStatus, className = '' }) {
  const {
    inputTokens = 0,
    outputTokens = 0,
    accumulatedCost = 0, // Changed from totalCost to accumulatedCost
    promptTokens = 0,
    historyTokens = 0,
    systemTokens = 0
  } = tokenStats || {};

  const [showDetails, setShowDetails] = useState(false);

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

  const formattedCost = formatCost(accumulatedCost); // Changed from totalCost to accumulatedCost

  // Ensure we have context status data
  const contextData = contextStatus || {
    warningLevel: 'none',
    percentage: 0,
    tokensRemaining: 0
  };

  return (
    <div className={`text-xs text-gray-500 dark:text-gray-400 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>{inputTokens.toLocaleString()}</span>
          </div>

          <div className="flex items-center">
            <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" transform="rotate(45, 12, 12)"/>
            </svg>
            <span>{outputTokens.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center">
          <span>{formattedCost}</span>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
            title="Toggle token details"
          >
            <svg className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 9l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {showDetails && (
        <>
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium">Prompt</span>
              <span>{promptTokens.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium">History</span>
              <span>{historyTokens.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium">System</span>
              <span>{systemTokens.toLocaleString()}</span>
            </div>
          </div>

          {/* Context window progress bar with percentage */}
          <div className="mt-3">
            <div className="flex items-center">
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TokenCounter;
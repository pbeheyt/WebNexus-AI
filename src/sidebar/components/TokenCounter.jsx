// src/sidebar/components/TokenCounter.jsx
import React, { useState } from 'react';

function TokenCounter({ tokenStats, className = '' }) {
  const { 
    inputTokens, 
    outputTokens, 
    totalCost, 
    promptTokens,
    historyTokens,
    systemTokens
  } = tokenStats || { 
    inputTokens: 0, 
    outputTokens: 0, 
    totalCost: 0,
    promptTokens: 0,
    historyTokens: 0,
    systemTokens: 0
  };
  
  const [showDetails, setShowDetails] = useState(false);
  
  // Format cost with appropriate decimal places
  // Show more decimal places for very small amounts
  const formatCost = (cost) => {
    if (cost === 0) return '$0.00';
    
    if (cost < 0.01) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 6,
        maximumFractionDigits: 6
      }).format(cost);
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(cost);
  };
  
  const formattedCost = formatCost(totalCost);
  
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
          {/* Dollar sign SVG removed, only showing formatted cost with its built-in currency symbol */}
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
      )}
    </div>
  );
}

export default TokenCounter;
// src/sidebar/components/TokenCounter.jsx
import React from 'react';

function TokenCounter({ tokenStats, className = '' }) {
  const { inputTokens, outputTokens, totalCost } = tokenStats || { inputTokens: 0, outputTokens: 0, totalCost: 0 };
  
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
    <div className={`flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 ${className}`}>
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
        <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" 
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>{formattedCost}</span>
      </div>
    </div>
  );
}

export default TokenCounter;
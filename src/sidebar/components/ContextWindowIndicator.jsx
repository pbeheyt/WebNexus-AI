// src/sidebar/components/ContextWindowIndicator.jsx
import React from 'react';

function ContextWindowIndicator({ contextStatus }) {
  if (!contextStatus || !contextStatus.warningLevel || contextStatus.warningLevel === 'none') {
    return null;
  }

  const statusStyles = {
    notice: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", 
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  };
  
  const statusIcons = {
    notice: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
    warning: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    critical: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    )
  };
  
  // Visual progress bar for context window usage
  const ProgressBar = () => {
    const percentage = Math.min(100, contextStatus.percentage);
    const bgColor = 
      contextStatus.warningLevel === 'critical' ? 'bg-red-500' :
      contextStatus.warningLevel === 'warning' ? 'bg-yellow-500' : 'bg-blue-500';
      
    return (
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-1 mb-1">
        <div 
          className={`h-1.5 rounded-full ${bgColor}`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    );
  };
  
  const getMessage = () => {
    if (contextStatus.exceeds) {
      return "Context limit exceeded! Some messages may be truncated.";
    }
    
    const percentageText = contextStatus.percentage.toFixed(0);
    const tokensRemaining = contextStatus.tokensRemaining.toLocaleString();
    
    switch (contextStatus.warningLevel) {
      case 'warning':
        return `Approaching context limit (${percentageText}% used). ${tokensRemaining} tokens remaining.`;
      case 'notice':
        return `Context window ${percentageText}% used. ${tokensRemaining} tokens remaining.`;
      default:
        return null;
    }
  };
  
  return (
    <div className={`text-sm p-2 rounded ${statusStyles[contextStatus.warningLevel]}`}>
      <div className="flex items-center">
        {statusIcons[contextStatus.warningLevel]}
        <span>{getMessage()}</span>
      </div>
      <ProgressBar />
    </div>
  );
}

export default ContextWindowIndicator;
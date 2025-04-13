import React, { memo, useState } from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

/**
 * Enhanced math formula block component
 * Safely renders math expressions with error handling
 * @param {Object} props - Component props
 * @param {string} props.content - The LaTeX content to render
 * @param {boolean} props.inline - Whether to render inline or block math
 * @returns {JSX.Element} - The rendered math formula
 */
const MathFormulaBlock = memo(({ content, inline = false }) => {
  // Use state to track if rendering fails
  const [renderError, setRenderError] = useState(false);
  
  // Safely render math with error boundary
  const renderMathSafely = () => {
    try {
      return inline ? 
        <InlineMath math={content} /> : 
        <BlockMath math={content} />;
    } catch (error) {
      console.error('Math rendering error:', error);
      setRenderError(true);
      return (
        <code className="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 px-2 py-1 rounded font-mono text-xs">
          {content} (Error: Invalid math syntax)
        </code>
      );
    }
  };
  
  // If there was an error, show original content with error styling
  if (renderError) {
    return (
      <div className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded my-3 font-mono text-sm whitespace-pre-wrap">
        <div className="mb-2 text-xs text-red-500">Unable to render formula - showing LaTeX source:</div>
        {content}
      </div>
    );
  }
  
  // Normal rendering with appropriate KaTeX component
  return inline ? (
    <span className="inline-flex items-center">
      {renderMathSafely()}
    </span>
  ) : (
    <div className="flex justify-center my-4 overflow-x-auto max-w-full">
      {renderMathSafely()}
    </div>
  );
});

export default MathFormulaBlock;
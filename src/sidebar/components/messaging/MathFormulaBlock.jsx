// src/components/MathFormulaBlock.jsx
import React, { memo, useState } from 'react';
import { InlineMath, BlockMath } from 'react-katex';

import { logger } from '../../../shared/logger';
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
      return inline ? (
        <InlineMath math={content} />
      ) : (
        <BlockMath math={content} />
      );
    } catch (error) {
      logger.sidebar.error('Math rendering error:', error);
      setRenderError(true);
      return null;
    }
  };

  // If there was an error, show original content with error styling
  if (renderError) {
    return (
      <div className='p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded my-4 font-mono text-sm whitespace-pre-wrap select-none'>
        <div className='mb-2 text-xs text-red-600 dark:text-red-400 font-semibold'>
          Unable to render formula - showing LaTeX source:
        </div>
        <code className='text-red-700 dark:text-red-300'>{content}</code>
      </div>
    );
  }

  const renderedMath = renderMathSafely();

  // Only render if math was successfully generated
  if (!renderedMath) return null;

  // Normal rendering with appropriate KaTeX component
  return inline ? (
    <span className='inline-flex items-center align-middle my-2 mx-1'>
      {renderedMath}
    </span>
  ) : (
    <div className='my-3 overflow-x-auto max-w-full'>{renderedMath}</div>
  );
});

MathFormulaBlock.displayName = 'MathFormulaBlock';

export default MathFormulaBlock;

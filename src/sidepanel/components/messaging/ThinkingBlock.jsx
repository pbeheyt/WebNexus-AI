// src/sidepanel/components/messaging/ThinkingBlock.jsx
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { ChevronUpIcon } from '../../../components/icons/ChevronUpIcon';

const ThinkingBlock = ({ thinkingContent }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef(null);
  const [contentMaxHeight, setContentMaxHeight] = useState('0px');

  useEffect(() => {
    if (isExpanded && contentRef.current) {
      setContentMaxHeight(`${contentRef.current.scrollHeight}px`);
    } else {
      setContentMaxHeight('0px');
    }
  }, [isExpanded, thinkingContent]); // Recalculate on expand/collapse and content change

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Simplified Markdown components for thinking block
  const thinkingMarkdownComponents = {
    p: ({ node: _node, children }) => <p className='mb-2'>{children}</p>,
    ul: ({ node: _node, ordered: _ordered, ...props }) => (
      <ul className='list-disc pl-4 mb-2' {...props} />
    ),
    ol: ({ node: _node, ordered: _ordered, ...props }) => (
      <ol className='list-decimal pl-4 mb-2' {...props} />
    ),
    li: ({ node: _node, children, ordered: _ordered, ...props }) => (
      <li className='mb-1' {...props}>
        {children}
      </li>
    ),
    code: ({ node: _node, inline, children, ...props }) => {
      if (inline) {
        return (
          <code
            className='bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs'
            {...props}
          >
            {children}
          </code>
        );
      }
      // Basic block code rendering (no syntax highlighting needed here)
      return (
        <pre className='bg-gray-200 dark:bg-gray-700 p-2 rounded text-xs my-2 overflow-x-auto'>
          <code {...props}>{children}</code>
        </pre>
      );
    },
  };

  return (
    <div className='mb-4 border border-dashed border-gray-400 dark:border-gray-600 rounded-md bg-gray-100/50 dark:bg-gray-800/50'>
      <button
        onClick={toggleExpand}
        className='flex items-center justify-between w-full px-3 py-2 text-left rounded-t-md hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
        aria-expanded={isExpanded}
        aria-controls={`thinking-content-${React.useId()}`} // Generate unique ID
      >
        <div className='flex items-center'>
          <span className='text-xs italic text-gray-600 dark:text-gray-400'>
            Thinking Process
          </span>
        </div>
        <ChevronUpIcon
          className={`w-4 h-4 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 ${
            isExpanded ? 'rotate-0' : 'rotate-180'
          }`}
        />
      </button>
      <div
        ref={contentRef}
        id={`thinking-content-${React.useId()}`} // Match aria-controls
        className='overflow-hidden transition-all duration-300 ease-in-out'
        style={{ maxHeight: contentMaxHeight }}
      >
        <div className='p-3 text-xs text-gray-700 dark:text-gray-300 prose prose-xs dark:prose-invert max-w-none'>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={thinkingMarkdownComponents}
          >
            {thinkingContent}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

ThinkingBlock.propTypes = {
  thinkingContent: PropTypes.string,
  isStreaming: PropTypes.bool,
};

export default ThinkingBlock;

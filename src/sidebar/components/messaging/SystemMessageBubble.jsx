import React, { memo, forwardRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Define System Message Component Overrides:
const systemMessageComponents = {
  p: ({ node: _node, children }) => (
    <p className='leading-relaxed text-sm'>{children}</p>
  ),
  a: ({ node: _node, children, ...props }) => (
    <a
      {...props} // Pass through href, etc.
      target='_blank' // Open links in new tab
      rel='noopener noreferrer' // Security best practice
      className='text-red-700 dark:text-red-300 underline hover:text-red-800 dark:hover:text-red-200 break-words'
    >
      {children}
    </a>
  ),
};

export const SystemMessageBubble = memo(
  forwardRef(
    (
      {
        id,
        content,
        className = '',
        style = {},
        // Other props are destructured but not used directly in this component
        // They are included to accept the full original props signature
        // isStreaming, model, platformIconUrl, platformId, metadata, etc.
      },
      ref
    ) => {
      return (
        <div
          ref={ref}
          id={id}
          style={style}
          className={`px-5 py-4 w-full ${className}`}
        >
          <div // Intermediate container: Provides the red background around the text ONLY
            className='bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-md p-3'
          >
            <ReactMarkdown
              components={systemMessageComponents} // Use the specific overrides
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[]}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      );
    }
  )
);

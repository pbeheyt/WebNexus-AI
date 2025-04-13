// src/components/messaging/MessageBubble.jsx
import React, { useState, memo, Fragment } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';

import CopyButtonIcon from './icons/CopyButtonIcon';
import EnhancedCodeBlock from './components/EnhancedCodeBlock';
import MathFormulaBlock from './components/MathFormulaBlock';
import { copyToClipboard as copyUtil } from './utils/clipboard';
import { parseTextAndMath } from './utils/parseTextAndMath';

/**
 * Message bubble component
 */
export const MessageBubble = memo(({
  content,
  role = 'assistant',
  isStreaming = false,
  model = null,
  platformIconUrl = null,
  metadata = {},
  className = ''
}) => {
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const [copyState, setCopyState] = useState('idle');


  const handleCopyToClipboard = () => {
    if (!content || isStreaming) return;
    copyUtil(content)
      .then(() => {
        setCopyState('copied');
        setTimeout(() => setCopyState('idle'), 2000);
      })
      .catch((error) => {
        console.error('Failed to copy text: ', error);
        setCopyState('error');
        setTimeout(() => setCopyState('idle'), 2000);
      });
  };

  // System messages
  if (isSystem) {
    return (
      <div className={`px-5 py-2 my-2 w-full bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 ${className}`}>
        <div className="whitespace-pre-wrap break-words overflow-hidden leading-relaxed text-sm">{content}</div>
      </div>
    );
  }

  // User messages
  if (isUser) {
    return (
      <div className={`px-5 py-2 w-full flex justify-end ${className}`}>
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl p-3 max-w-[85%] overflow-hidden">
          <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed text-sm">{content}</div>
        </div>
      </div>
    );
  }

  // Assistant Message Rendering
  if (role === 'assistant') {
    const segments = parseTextAndMath(content || '');

    return (
      <div className={`px-5 py-2 w-full message-group relative ${className}`}>
        <div className={`prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 break-words overflow-visible mb-0`}>
          {segments.map((segment, index) => {
            return (
              <Fragment key={index}>
                {segment.type === 'text' ? (
                  <span className="text-segment">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[]}
                      disallowedElements={['p']}
                      unwrapDisallowed={true}
                      components={{
                         h1: ({node, ...props}) => <h1 className="text-xl font-semibold mt-5 mb-3" {...props} />,
                         h2: ({node, ...props}) => <h2 className="text-lg font-medium mt-4 mb-2" {...props} />,
                         h3: ({node, ...props}) => <h3 className="text-base font-medium mt-3 mb-2" {...props} />,
                         p: ({node, children, ...props}) => <p className="mb-3 leading-relaxed text-sm" {...props}>{children}</p>,
                         ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 mt-1 space-y-1.5" {...props} />,
                         ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 mt-1 space-y-1.5" {...props} />,
                         li: ({node, ...props}) => <li className="leading-relaxed text-sm" {...props} />,
                         code: ({node, inline, className, children, ...props}) => {
                            const rawChildren = React.Children.toArray(children);
                            // Extract the actual string content from children
                            const codeString = rawChildren
                              .map(child => typeof child === 'string' ? child : '')
                              .join('');

                            // Determine if it should be treated as inline.
                            // Treat as inline if the 'inline' prop is true OR if it's likely intended as inline
                            // (single line, doesn't contain newline characters).
                            const treatAsInline = inline || !codeString.includes('\n');

                            if (treatAsInline) {
                               // Use the standard inline code styling
                               return <code className="bg-theme-hover px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>;
                            } else {
                               // It's definitely a block
                               const codeContent = codeString.replace(/\n$/, '');
                               const language = className?.replace('language-', '');
                               // Use EnhancedCodeBlock for fenced code blocks parsed by remarkGfm
                               return <EnhancedCodeBlock language={language} isStreaming={isStreaming}>{codeContent}</EnhancedCodeBlock>;
                            }
                         },
                         pre: ({node, children, ...props}) => <>{children}</>,
                         a: ({node, ...props}) => <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                         blockquote: ({node, children, ...props}) => <blockquote className="border-l-2 border-theme pl-3 italic text-theme-secondary my-3 py-1 text-xs" {...props}>{children}</blockquote>,
                         strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                         em: ({node, ...props}) => <em className="italic" {...props} />,
                         hr: ({node, ...props}) => <hr className="my-4 border-t border-gray-300 dark:border-gray-600" {...props} />,
                         table: ({node, ...props}) => <div className="overflow-x-auto my-3"><table className="border-collapse w-full text-xs" {...props} /></div>,
                         thead: ({node, ...props}) => <thead className="bg-gray-100 dark:bg-gray-800" {...props} />,
                         tbody: ({node, ...props}) => <tbody {...props} />,
                         tr: ({node, ...props}) => <tr className="border-b border-gray-200 dark:border-gray-700" {...props} />,
                         th: ({node, children, ...props}) => <th className="p-2 text-left font-medium text-xs" {...props}>{children}</th>,
                         td: ({node, children, ...props}) => <td className="p-2 border-gray-200 dark:border-gray-700 text-xs" {...props}>{children}</td>,
                      }}
                      children={segment.value}
                     />
                   </span>
                ) : (
                  // Math rendering logic
                  segment.inline ? (
                    <span className="inline-math-wrapper px-1">
                      <MathFormulaBlock content={segment.value} inline={segment.inline} />
                    </span>
                  ) : (
                    <MathFormulaBlock content={segment.value} inline={segment.inline} />
                  )
                )}
              </Fragment>
            );
          })}
        </div>

        {/* Footer section */}
        <div className="flex justify-between items-center">
          <div className="text-xs opacity-70 flex items-center">
            {platformIconUrl && !isUser && (
              <img src={platformIconUrl} alt="AI Platform" className="w-3 h-3 mr-2 object-contain" />
            )}
            {model && !isUser && <span>{model}</span>}
            {isStreaming && (
              <div className="flex gap-1 ml-2">
                <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce"></div>
                <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
          </div>
          <div className="w-7 h-7 flex items-center justify-center">
            {!isStreaming && content && (
              <button
                onClick={handleCopyToClipboard}
                className={`p-1 rounded-md transition-opacity duration-200 z-50 ${copyState === 'idle' ? 'opacity-0 message-group-hover:opacity-100' : 'opacity-100'} ${copyState === 'copied' ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : copyState === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                aria-label="Copy to clipboard" title="Copy to clipboard"
              >
                <CopyButtonIcon state={copyState} />
              </button>
            )}
          </div>
        </div>

        {/* Metadata */}
        {Object.keys(metadata).length > 0 && (
          <div className="text-xs mt-2 opacity-70 overflow-hidden text-ellipsis">
            {Object.entries(metadata).map(([key, value]) => (
              <span key={key} className="mr-3 break-words">
                {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null; // Fallback return
});

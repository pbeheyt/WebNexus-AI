import React, { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import CopyButtonIcon from './icons/CopyButtonIcon';
import EnhancedCodeBlock from './components/EnhancedCodeBlock';
import MathFormulaBlock from './components/MathFormulaBlock';
import { copyToClipboard as copyUtil } from './utils/clipboard';
import { detectContentType, ContentType } from './services/ContentTypeDetector';
import {
  isMathematicalFunction,
  hasLatexCommands,
  hasHighConfidenceMathIndicators
} from './utils/mathDetection';

/**
 * A versatile message bubble component that supports different roles and states
 * with copy-to-clipboard functionality for assistant messages
 * @param {Object} props - Component props
 * @param {string} props.content - The message content
 * @param {string} props.role - The role of the message sender ('user', 'assistant', or 'system')
 * @param {boolean} props.isStreaming - Whether the content is still streaming
 * @param {string|null} props.model - The AI model information (optional)
 * @param {string|null} props.platformIconUrl - URL to platform icon (optional)
 * @param {Object} props.metadata - Additional metadata to display (optional)
 * @param {string} props.className - Additional CSS classes (optional)
 * @returns {JSX.Element} - The rendered message bubble
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
  const [copyState, setCopyState] = useState('idle'); // idle, copied, error

  // Helper to extract text content from ReactMarkdown node
  const getNodeText = (node) => {
    let text = '';
    if (node && node.children && Array.isArray(node.children)) {
      node.children.forEach(child => {
        if (child.type === 'text') {
          text += child.value;
        }
      });
    }
    return text;
  };

  // Helper to detect if node contains standalone math content
  const isNodeLikelyStandaloneMath = (node) => {
    const textContent = getNodeText(node).trim();
    if (!textContent) {
      return false;
    }
    return (
      isMathematicalFunction(textContent) ||
      hasLatexCommands(textContent) || 
      hasHighConfidenceMathIndicators(textContent)
    );
  };

  // Copy assistant message to clipboard
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

  // System messages (typically errors) with special styling
  if (isSystem) {
    return (
      <div className={`px-5 py-2 my-2 w-full bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 ${className}`}>
        {/* System messages render raw content, preserving whitespace */}
        <div className="whitespace-pre-wrap break-words overflow-hidden leading-relaxed text-sm">{content}</div>
      </div>
    );
  }

  // User messages with grey color scheme
  if (isUser) {
    return (
      <div className={`px-5 py-2 w-full flex justify-end ${className}`}>
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl p-3 max-w-[85%] overflow-hidden">
          {/* User messages render raw content, preserving whitespace */}
          <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed text-sm">{content}</div>
        </div>
      </div>
    );
  }

  // Assistant messages with no bubble, taking full width
  return (
    <div className={`px-5 py-2 w-full message-group relative ${className}`}>
      {/* Main content - Render Markdown for assistant messages */}
      <div className={`prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 break-words overflow-visible mb-0`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          components={{
            // Math components for LaTeX-style math rendering
            math: ({value}) => <MathFormulaBlock content={value} />,
            inlineMath: ({value}) => <MathFormulaBlock content={value} inline={true} />,
            h1: ({node, ...props}) => <h1 className="text-xl font-semibold mt-5 mb-3" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-lg font-medium mt-4 mb-2" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-base font-medium mt-3 mb-2" {...props} />,
            p: ({node, children, ...props}) => {
              if (isNodeLikelyStandaloneMath(node)) {
                return <MathFormulaBlock content={getNodeText(node).trim()} inline={false} />;
              }
              return <p className="mb-3 leading-relaxed text-sm" {...props}>{children}</p>;
            },
            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 mt-1 space-y-1.5" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 mt-1 space-y-1.5" {...props} />,
            li: ({node, ...props}) => <li className="leading-relaxed text-sm" {...props} />,

            code: ({node, inline, className, children, ...props}) => {
              const content = String(children).trim();
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : null;
              
              // Leverage the context-aware detector for content classification
              const contentType = detectContentType(content, inline, language);
              
              // Apply rendering strategy based on determined content type
              switch (contentType) {
                case ContentType.MATH_INLINE:
                  return <MathFormulaBlock content={content} inline={true} />;
                
                case ContentType.MATH_BLOCK:
                  return <MathFormulaBlock content={content} inline={false} />;
                
                case ContentType.CODE_BLOCK:
                  return <EnhancedCodeBlock className={className} isStreaming={isStreaming}>{children}</EnhancedCodeBlock>;
                
                case ContentType.CODE_INLINE:
                  return (
                    <code className="bg-theme-hover px-1 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  );
                  
                case ContentType.TEXT:
                default:
                  // Fallback to basic code formatting for TEXT or unknown types within a code context
                  return (
                    <code className="bg-theme-hover px-1 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  );
              }
            },
            pre: ({node, children, ...props}) => <>{children}</>,
            a: ({node, ...props}) => <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
            blockquote: ({node, children, ...props}) => {
              if (isNodeLikelyStandaloneMath(node)) {
                return <MathFormulaBlock content={getNodeText(node).trim()} inline={false} />;
              }
              return <blockquote className="border-l-2 border-theme pl-3 italic text-theme-secondary my-3 py-1 text-xs" {...props}>{children}</blockquote>;
            },
            strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
            em: ({node, ...props}) => <em className="italic" {...props} />,
            hr: ({node, ...props}) => <hr className="my-4 border-t border-gray-300 dark:border-gray-600" {...props} />,
            table: ({node, ...props}) => <div className="overflow-x-auto my-3"><table className="border-collapse w-full text-xs" {...props} /></div>,
            thead: ({node, ...props}) => <thead className="bg-gray-100 dark:bg-gray-800" {...props} />,
            tbody: ({node, ...props}) => <tbody {...props} />,
            tr: ({node, ...props}) => <tr className="border-b border-gray-200 dark:border-gray-700" {...props} />,
            th: ({node, children, ...props}) => {
              if (isNodeLikelyStandaloneMath(node)) {
                return <MathFormulaBlock content={getNodeText(node).trim()} inline={false} />;
              }
              return <th className="p-2 text-left font-medium text-xs" {...props}>{children}</th>;
            },
            td: ({node, children, ...props}) => {
              if (isNodeLikelyStandaloneMath(node)) {
                return <MathFormulaBlock content={getNodeText(node).trim()} inline={false} />;
              }
              return <td className="p-2 border-gray-200 dark:border-gray-700 text-xs" {...props}>{children}</td>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      <div className="flex justify-between items-center -mt-1">
        {/* Model info with platform icon and streaming indicator */}
        <div className="text-xs opacity-70 flex items-center">
          {platformIconUrl && !isUser && (
            <img
              src={platformIconUrl}
              alt="AI Platform"
              className="w-3 h-3 mr-2 object-contain"
            />
          )}
          {model && !isUser && <span>{model}</span>}
          {/* Streaming indicator */}
          {isStreaming && (
            <div className="flex gap-1 ml-2">
              <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce"></div>
              <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          )}
        </div>

        {/* Always reserve space for button */}
        <div className="w-7 h-7 flex items-center justify-center">
          {!isStreaming && content && (
            <button
              onClick={handleCopyToClipboard}
              className={`p-1 rounded-md transition-opacity duration-200 z-50
                        ${copyState === 'idle' ? 'opacity-0 message-group-hover:opacity-100' : 'opacity-100'}
                        ${copyState === 'copied' ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
                          copyState === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400' :
                          'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              aria-label="Copy to clipboard"
              title="Copy to clipboard"
            >
              <CopyButtonIcon state={copyState} />
            </button>
          )}
        </div>
      </div>

      {/* Additional metadata display */}
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
});

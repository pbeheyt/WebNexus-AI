// src/components/messaging/MessageBubble.jsx
import React, { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import 'katex/dist/katex.min.css';

import CopyButtonIcon from './icons/CopyButtonIcon';
import EnhancedCodeBlock from './components/EnhancedCodeBlock';
import MathFormulaBlock from './components/MathFormulaBlock';
import { copyToClipboard as copyUtil } from './utils/clipboard';
import { parseTextAndMath } from './utils/parseTextAndMath';
import logger from '../../../shared/logger';

// Placeholder Regex - matches @@MATH_(BLOCK|INLINE)_(\d+)@@
const MATH_PLACEHOLDER_REGEX = /@@MATH_(BLOCK|INLINE)_(\d+)@@/g;

/**
 * RECURSIVE function to process children, find placeholders, and replace them with MathFormulaBlock
 * @param {React.ReactNode|React.ReactNodeArray} children - Children nodes to process
 * @param {Map<string, { content: string, inline: boolean }>} mathMap - Map containing math data
 * @returns {Array<React.ReactNode>} - Array of processed nodes
 */
const renderWithPlaceholdersRecursive = (children, mathMap) => {
  if (!mathMap) return React.Children.toArray(children); // Return array if no map

  return React.Children.toArray(children).flatMap((child, index) => {
    // 1. Process String Children
    if (typeof child === 'string') {
      const parts = [];
      let lastIndex = 0;
      let match;
      MATH_PLACEHOLDER_REGEX.lastIndex = 0; // Reset regex state for each string

      while ((match = MATH_PLACEHOLDER_REGEX.exec(child)) !== null) {
        // Add text before the placeholder
        if (match.index > lastIndex) {
          parts.push(child.slice(lastIndex, match.index));
        }
        // Add the MathFormulaBlock component
        const placeholder = match[0];
        const mathType = match[1]; // Extract type for fallback
        const mathData = mathMap.get(placeholder);
        if (mathData) {
          parts.push(
            <MathFormulaBlock
              key={`${placeholder}-${index}`} // Make key more unique
              content={mathData.content}
              inline={mathData.inline}
            />
          );
        } else {
          // Fallback: Render marker based on placeholder type
          logger.sidebar.warn(`Math placeholder ${placeholder} not found in map. Rendering fallback marker.`);
          const fallbackText = mathType === 'INLINE' ? '[ inline math ]' : '[ block math ]';
          parts.push(fallbackText);
        }
        lastIndex = MATH_PLACEHOLDER_REGEX.lastIndex;
      }
      // Add any remaining text after the last placeholder
      if (lastIndex < child.length) {
        parts.push(child.slice(lastIndex));
      }
      // If no placeholders were found, parts will be empty, return original text string in an array
      return parts.length > 0 ? parts : [child];
    }

    // 2. Process React Element Children (Recursively)
    if (React.isValidElement(child) && child.props.children) {
      const processedGrandchildren = renderWithPlaceholdersRecursive(child.props.children, mathMap);
      // Ensure key is stable and unique if possible, fallback to index
      const key = child.key ?? `child-${index}`;
      return React.cloneElement(child, { ...child.props, key: key }, processedGrandchildren);
    }

    // 3. Return other children (non-string, non-element with children) as is
    return child;
  });
};

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

  const handleCopyToClipboard = async () => {
    if (!content || isStreaming) return;
    try {
      await copyUtil(content);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (error) {
      logger.sidebar.error('Failed to copy text: ', error);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  // System messages
  if (isSystem) {
     return (
        <div className={`px-5 py-3 mb-2 w-full bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-md ${className}`}>
          <div className="whitespace-pre-wrap break-words overflow-hidden leading-relaxed text-sm">{content}</div>
        </div>
      );
  }

  // User messages
  if (isUser) {
     return (
      <div className={`px-5 py-2 w-full flex justify-end items-start mb-2 ${className}`}>
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl p-3 max-w-[85%] overflow-hidden">
           <ReactMarkdown
             remarkPlugins={[remarkGfm]}
             className="whitespace-pre-wrap break-words overflow-wrap-anywhere text-sm"
             allowedElements={['a', 'code', 'pre', 'strong', 'em', 'br']}
             unwrapDisallowed={true}
             components={{
                a: ({node, ...props}) => <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                code: ({node, ...props}) => <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono" {...props}>{props.children}</code>,
                pre: ({node, ...props}) => <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono overflow-x-auto">{props.children}</pre>,
             }}
          >
             {content}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  // Assistant Message Rendering - Placeholder Method
  if (role === 'assistant') {

    // --- Preprocessing Step: Generate Placeholders ---
    const mathMap = new Map();
    let preprocessedContent = '';
    let mathIndex = 0;
    try {
        const segments = parseTextAndMath(content || ''); // Use original parser
        const processedSegments = segments.map((segment) => {
            if (segment.type === 'math') {
                // Generate placeholder and store original math data
                const placeholder = `@@MATH_${segment.inline ? 'INLINE' : 'BLOCK'}_${mathIndex++}@@`;
                mathMap.set(placeholder, { content: segment.value, inline: segment.inline });
                return placeholder;
            }
            return segment.value; // Keep text segment value
        });
        preprocessedContent = processedSegments.join('');
    } catch (error) {
        logger.sidebar.error("Error during math preprocessing:", error);
        preprocessedContent = content || ''; // Fallback
    }
    // --- End Preprocessing Step ---


    return (
      <div className={`group px-5 py-2 w-full message-group relative mb-2 ${className}`}>
        <div className={`prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 break-words overflow-visible mb-3`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]} // Keep GFM
            rehypePlugins={[]} // No rehype plugins needed for math
            components={{
               // --- Standard element overrides ---
               h1: ({node, ...props}) => <h1 className="text-xl font-semibold mt-6 mb-4" {...props} />,
               h2: ({node, ...props}) => <h2 className="text-lg font-medium mt-5 mb-3" {...props} />,
               h3: ({node, ...props}) => <h3 className="text-base font-medium mt-4 mb-3" {...props} />,
               ul: ({node, ...props}) => <ul className="list-disc pl-5 my-4 space-y-2" {...props} />,
               ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-4 space-y-2" {...props} />,
               li: ({node, children, ...props}) => {
                  // Process children of li recursively for placeholders
                  const processedChildren = renderWithPlaceholdersRecursive(children, mathMap);
                  return <li className="leading-relaxed text-sm" {...props}>{processedChildren}</li>;
               },
               p: ({node, children, ...props}) => {
                  // Process children of p recursively for placeholders
                  const processedChildren = renderWithPlaceholdersRecursive(children, mathMap);
                  return <p className="mb-4 leading-relaxed text-sm" {...props}>{processedChildren}</p>;
               },
               code: ({node, inline, className, children, ...props}) => {
                  // Code blocks should not contain math placeholders, render normally
                  if (className && className.startsWith('language-')) {
                     const codeContent = String(children).replace(/\n$/, '');
                     const match = /language-(\w+)/.exec(className);
                     const language = match ? match[1] : 'text';
                     return <EnhancedCodeBlock className={`language-${language}`} isStreaming={isStreaming}>{codeContent}</EnhancedCodeBlock>;
                  }
                  // Inline code - process children just in case (though unlikely needed)
                  const processedChildren = renderWithPlaceholdersRecursive(children, mathMap);
                  return <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono mx-0.5" {...props}>{processedChildren}</code>;
               },
               pre: ({node, children, ...props}) => {
                 // Pre should typically contain only code, let code override handle it
                 return <>{children}</>;
               },
               a: ({node, children, ...props}) => {
                 const processedChildren = renderWithPlaceholdersRecursive(children, mathMap);
                 return <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props}>{processedChildren}</a>;
               },
               blockquote: ({node, children, ...props}) => {
                 const processedChildren = renderWithPlaceholdersRecursive(children, mathMap);
                 return <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-600 dark:text-gray-400 my-4 py-1 text-sm" {...props}>{processedChildren}</blockquote>;
               },
               strong: ({node, children, ...props}) => {
                 const processedChildren = renderWithPlaceholdersRecursive(children, mathMap);
                 return <strong className="font-semibold" {...props}>{processedChildren}</strong>;
               },
               em: ({node, children, ...props}) => {
                 const processedChildren = renderWithPlaceholdersRecursive(children, mathMap);
                 return <em className="italic" {...props}>{processedChildren}</em>;
               },
               // Add overrides for any other elements that might contain text/math
               // Default rendering will apply for elements not overridden

            }}
            children={preprocessedContent} // Pass preprocessed content
           />
        </div>

        {/* Footer section */}
        <div className="flex justify-between items-center -mt-1">
           <div className="text-xs opacity-70 flex items-center space-x-2">
            {platformIconUrl && !isUser && (
              <img src={platformIconUrl} alt="AI Platform" className="w-3.5 h-3.5 object-contain" />
            )}
            {model && !isUser && <span>{model}</span>}
            {isStreaming && (
              <div className="flex gap-1 items-center">
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
                className={`p-1 rounded-md transition-opacity duration-200 z-10 ${copyState === 'idle' ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} ${copyState === 'copied' ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : copyState === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                aria-label="Copy to clipboard" title="Copy to clipboard"
              >
                <CopyButtonIcon state={copyState} />
              </button>
            )}
          </div>
        </div>

        {/* Metadata (no change) */}
        {Object.keys(metadata).length > 0 && (
          <div className="text-xs mt-3 opacity-70 overflow-hidden text-ellipsis space-x-3">
            {Object.entries(metadata).map(([key, value]) => (
              <span key={key} className="inline-block break-words">
                <span className='font-medium'>{key}:</span> {typeof value === 'object' ? JSON.stringify(value) : value}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null; // Fallback return
});

MessageBubble.displayName = 'MessageBubble';
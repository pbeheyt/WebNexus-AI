// src/components/messaging/MessageBubble.jsx
import React, { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import 'katex/dist/katex.min.css';

import CopyButtonIcon from './icons/CopyButtonIcon';
import EnhancedCodeBlock from './EnhancedCodeBlock';
import MathFormulaBlock from './MathFormulaBlock'
import { copyToClipboard as copyUtil } from './utils/clipboard';
import { parseTextAndMath } from './utils/parseTextAndMath';
import logger from '../../../shared/logger';
import { MESSAGE_ROLES } from '../../../shared/constants'; // Import MESSAGE_ROLES

// Placeholder Regex - matches @@MATH_(BLOCK|INLINE)_(\d+)@@
const MATH_PLACEHOLDER_REGEX = /@@MATH_(BLOCK|INLINE)_(\d+)@@/g;
// Regex for checking if *any* placeholder exists (used for optimization)
const HAS_MATH_PLACEHOLDER_REGEX = /@@MATH_(BLOCK|INLINE)_\d+@@/;

/**
 * Utility function to check if processed children contain a block-level element (div).
 * @param {React.ReactNode|React.ReactNodeArray} processedChildren - Children processed by renderWithPlaceholdersRecursive.
 * @returns {boolean} - True if a direct child is a div element.
 */
const containsBlockElementCheck = (processedChildren) => {
    return React.Children.toArray(processedChildren).some(
        child => React.isValidElement(child) && child.type === 'div'
    );
};

/**
 * RECURSIVE function to process children, find placeholders, and replace them with MathFormulaBlock
 */
const renderWithPlaceholdersRecursive = (children, mathMap) => {
  return React.Children.toArray(children).flatMap((child, index) => {
    // 1. Process String Children
    if (typeof child === 'string') {
      const parts = [];
      let lastIndex = 0;
      let match;
      MATH_PLACEHOLDER_REGEX.lastIndex = 0; // Reset regex state for each string

      while ((match = MATH_PLACEHOLDER_REGEX.exec(child)) !== null) {
        if (match.index > lastIndex) {
          parts.push(child.slice(lastIndex, match.index));
        }
        const placeholder = match[0];
        const mathType = match[1];
        const mathData = mathMap.get(placeholder);
        if (mathData) {
          parts.push(
            <MathFormulaBlock
              key={`${placeholder}-${index}`}
              content={mathData.content}
              inline={mathData.inline}
            />
          );
        } else {
          logger.sidebar.warn(`Math placeholder ${placeholder} not found in map. Rendering fallback marker.`);
          const fallbackText = mathType === 'INLINE' ? '[ inline math ]' : '[ block math ]';
          parts.push(fallbackText);
        }
        lastIndex = MATH_PLACEHOLDER_REGEX.lastIndex;
      }
      if (lastIndex < child.length) {
        parts.push(child.slice(lastIndex));
      }
      return parts.length > 0 ? parts : [child];
    }

    // 2. Process React Element Children (Recursively)
    if (React.isValidElement(child) && child.props.children) {
      const processedGrandchildren = renderWithPlaceholdersRecursive(child.props.children, mathMap);
      const key = child.key ?? `child-${index}`;
      return React.cloneElement(child, { ...child.props, key: key }, processedGrandchildren);
    }

    // 3. Return other children as is
    return child;
  });
};


/**
 * Message bubble component
 */
export const MessageBubble = memo(({
  id, // Expect the message ID to be passed as a prop
  content,
  role = MESSAGE_ROLES.ASSISTANT, // Use constant
  isStreaming = false,
  model = null,
  platformIconUrl = null,
  metadata = {},
  className = ''
}) => {
  const isUser = role === MESSAGE_ROLES.USER; // Use constant
  const isSystem = role === MESSAGE_ROLES.SYSTEM; // Use constant
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
        // *** ADDED id attribute ***
        <div id={`message-${id}`} className={`px-5 py-4 w-full bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-md ${className}`}>
          <div className="whitespace-pre-wrap break-words overflow-hidden leading-relaxed text-sm">{content}</div>
        </div>
      );
  }

  // User messages
  if (isUser) {
    return (
      // *** ADDED id attribute ***
      <div id={`message-${id}`} className={`px-5 py-2 mb-2 w-full flex justify-end items-start ${className}`}>
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl p-3 max-w-[85%] overflow-hidden">
          <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed text-sm">{content}</div>
        </div>
      </div>
    );
  }

  // Assistant Message Rendering
  if (role === MESSAGE_ROLES.ASSISTANT) { // Use constant

    // --- Preprocessing Step  ---
    const mathMap = new Map();
    let preprocessedContent = '';
    let mathIndex = 0; // Renamed from idx for clarity
    try {
        const segments = parseTextAndMath(content || '');
        const processedSegments = segments.map((segment) => {
            if (segment.type === 'math') {
                const placeholder = `@@MATH_${segment.inline ? 'INLINE' : 'BLOCK'}_${mathIndex++}@@`;
                mathMap.set(placeholder, { content: segment.value, inline: segment.inline });
                return placeholder;
            }
            return segment.value;
        });
        preprocessedContent = processedSegments.join('');
    } catch (error) {
        logger.sidebar.error("Error during math preprocessing:", error);
        preprocessedContent = content || ''; // Fallback
    }

    // --- Optimization Check  ---
    const hasMathPlaceholders = HAS_MATH_PLACEHOLDER_REGEX.test(preprocessedContent);

    // --- Define Component Overrides ---
    const markdownComponents = {
        // --- Headings h1-h6 (Conditional processing, no nesting issue expected) ---
        h1: ({node, children, ...props}) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            return <h1 className="text-xl font-semibold mt-6 mb-4" {...props}>{processedChildren}</h1>;
        },
        h2: ({node, children, ...props}) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            return <h2 className="text-lg font-medium mt-5 mb-3" {...props}>{processedChildren}</h2>;
        },
        h3: ({node, children, ...props}) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            return <h3 className="text-base font-medium mt-4 mb-3" {...props}>{processedChildren}</h3>;
        },
        h4: ({node, children, ...props}) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            return <h4 className="text-sm font-medium mt-3 mb-2" {...props}>{processedChildren}</h4>;
        },
        h5: ({node, children, ...props}) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            return <h5 className="text-xs font-semibold mt-2 mb-1" {...props}>{processedChildren}</h5>;
        },
        h6: ({node, children, ...props}) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            return <h6 className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 mb-1" {...props}>{processedChildren}</h6>;
        },
        // --- Lists ul, ol, li (Conditional processing for li, no nesting issue expected) ---
        ul: ({node, ...props}) => <ul className="list-disc pl-5 my-4 space-y-2" {...props} />,
        ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-4 space-y-2" {...props} />,
        li: ({node, children, ...props}) => {
           const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
           return <li className="leading-relaxed text-sm" {...props}>{processedChildren}</li>;
        },

        // --- Paragraph Override ---
        p: ({ node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            const containsBlockElement = containsBlockElementCheck(processedChildren);
            const commonClasses = "mb-4 leading-relaxed text-sm";
            // Use div wrapper if block math is present to avoid p > div nesting
            const Tag = containsBlockElement ? 'div' : 'p';
            return <Tag className={commonClasses} {...props}>{processedChildren}</Tag>;
        },
        // --- Code and Pre ---
        code: ({node, inline, className, children, ...props}) => {
           // Block code: Render EnhancedCodeBlock, no placeholder processing needed inside
           if (className && className.startsWith('language-')) {
              const codeContent = String(children).replace(/\n$/, '');
              const match = /language-(\w+)/.exec(className);
              const language = match ? match[1] : 'text';
              return <EnhancedCodeBlock className={`language-${language}`} isStreaming={isStreaming}>{codeContent}</EnhancedCodeBlock>;
           }

           // Inline code: Apply conditional placeholder processing AND nesting fix
           const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
           const containsBlockElement = containsBlockElementCheck(processedChildren);
           const commonClasses = "bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono mx-0.5";
           // Use span wrapper if block math is present to avoid code > div nesting
           const Tag = containsBlockElement ? 'span' : 'code';
           return <Tag className={commonClasses} {...props}>{processedChildren}</Tag>;
        },
        pre: ({node, children, ...props}) => {
          // Pre should typically contain only code, let code override handle it.
          // It can validly contain divs if needed.
          return <pre {...props}>{children}</pre>; // Render pre directly, code override handles content
        },
        // --- Link Override (Fixed) ---
        a: ({node, children, ...props}) => {
          const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
          const containsBlockElement = containsBlockElementCheck(processedChildren);
          const commonClasses = "text-primary hover:underline";
          // Use span wrapper if block math is present to avoid a > div nesting
          const Tag = containsBlockElement ? 'span' : 'a';
          const tagProps = containsBlockElement
            ? { className: commonClasses, ...props } // Apply classes to span, keep other props
            : { className: commonClasses, target: "_blank", rel: "noopener noreferrer", ...props }; // Apply classes and link attrs to <a>
          return <Tag {...tagProps}>{processedChildren}</Tag>;
        },
        // --- Blockquote (Conditional processing, no nesting issue expected) ---
        blockquote: ({node, children, ...props}) => {
          const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
          // blockquote can contain div
          return <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-600 dark:text-gray-400 my-4 py-1 text-sm" {...props}>{processedChildren}</blockquote>;
        },
        // --- Strong Override ---
        strong: ({node, children, ...props}) => {
          const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
          const containsBlockElement = containsBlockElementCheck(processedChildren);
          const commonClasses = "font-semibold";
          // Use span wrapper if block math is present to avoid strong > div nesting
          const Tag = containsBlockElement ? 'span' : 'strong';
          return <Tag className={commonClasses} {...props}>{processedChildren}</Tag>;
        },
        // --- Emphasis Override ---
        em: ({node, children, ...props}) => {
          const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
          const containsBlockElement = containsBlockElementCheck(processedChildren);
          const commonClasses = "italic";
          // Use span wrapper if block math is present to avoid em > div nesting
          const Tag = containsBlockElement ? 'span' : 'em';
          return <Tag className={commonClasses} {...props}>{processedChildren}</Tag>;
        },
     };
    // --- End Component Overrides ---


    return (
      // *** ADDED id attribute ***
      <div id={`message-${id}`} className={`group px-5 py-2 w-full message-group relative mb-2 ${className}`}>
        <div className={`prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 break-words overflow-visible mb-3`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[]}
            components={markdownComponents}
            children={preprocessedContent}
           />
        </div>

        {/* Footer section  */}
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
            {!isStreaming && content && content.trim() && (
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

        {/* Metadata  */}
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
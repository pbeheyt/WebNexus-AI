// src/sidebar/components/messaging/MessageBubble.jsx
import React, { useState, memo, forwardRef } from 'react'; // Import forwardRef
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import 'katex/dist/katex.min.css'; // Ensure KaTeX CSS is imported

import CopyButtonIcon from './icons/CopyButtonIcon';
import EnhancedCodeBlock from './EnhancedCodeBlock';
import MathFormulaBlock from './MathFormulaBlock'
import { copyToClipboard as copyUtil } from './utils/clipboard';
import { parseTextAndMath } from './utils/parseTextAndMath';
import logger from '../../../shared/logger';
import { MESSAGE_ROLES } from '../../../shared/constants'; // Import message roles

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
  // Check if math placeholders are even present in the parent string/element for optimization
  const hasMathPlaceholders = typeof children === 'string'
      ? HAS_MATH_PLACEHOLDER_REGEX.test(children)
      : React.Children.toArray(children).some(c => typeof c === 'string' && HAS_MATH_PLACEHOLDER_REGEX.test(c));

  // If no placeholders in this branch, return children as is
  if (!hasMathPlaceholders) return children;

  return React.Children.toArray(children).flatMap((child, index) => {
    // 1. Process String Children
    if (typeof child === 'string') {
      if (!HAS_MATH_PLACEHOLDER_REGEX.test(child)) return [child]; // Optimization: Skip regex if no placeholders

      const parts = [];
      let lastIndex = 0;
      let match;
      MATH_PLACEHOLDER_REGEX.lastIndex = 0; // Reset regex state

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
              key={`${placeholder}-${index}-${lastIndex}`} // More unique key
              content={mathData.content}
              inline={mathData.inline}
            />
          );
        } else {
          logger.sidebar.warn(`Math placeholder ${placeholder} not found in map. Rendering fallback marker.`);
          const fallbackText = mathType === 'INLINE' ? '[ math ]' : '[ block math ]'; // Simplified fallback
          parts.push(fallbackText);
        }
        lastIndex = MATH_PLACEHOLDER_REGEX.lastIndex;
      }
      if (lastIndex < child.length) {
        parts.push(child.slice(lastIndex));
      }
      // Ensure we return something, even if parts is empty (e.g., child was only placeholders)
      return parts.length > 0 ? parts : [child];
    }

    // 2. Process React Element Children (Recursively)
    if (React.isValidElement(child) && child.props.children) {
      // Process grandchildren only if the element itself might contain placeholders (recursively)
      const processedGrandchildren = renderWithPlaceholdersRecursive(child.props.children, mathMap);
      const key = child.key ?? `child-${index}`; // Use existing key or generate one
      // Clone element with potentially processed children
      return React.cloneElement(child, { ...child.props, key: key }, processedGrandchildren);
    }

    // 3. Return other children (like numbers, null, etc.) as is
    return child;
  });
};


/**
 * Message bubble component wrapped with forwardRef
 */
export const MessageBubble = memo(forwardRef(({ // Use forwardRef
  id,
  content,
  role = 'assistant',
  isStreaming = false,
  model = null,
  platformIconUrl = null,
  metadata = {},
  className = '',
  style = {}
}, ref) => { // Add ref as second argument
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
  // System messages
  if (role === MESSAGE_ROLES.SYSTEM) {
    return (
       <div // Outer container: Provides overall spacing (px-5 py-4) and structure
         ref={ref}
         id={id}
         style={style}
         // REMOVED background and text color from here
         className={`px-5 py-2 mb-2 w-full ${className}`} // Kept padding for spacing
       >
         <div // Intermediate container: Provides the red background around the text ONLY
           className="inline-block bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-md p-3" // Added inline-block, bg, text color, internal padding, rounded
         >
           <div // Inner container: Holds the actual text content
             className="whitespace-pre-wrap break-words leading-relaxed text-sm" // Removed overflow-hidden as inline-block handles wrapping
           >
             {content}
           </div>
         </div>
       </div>
     );
  }

  // User messages
  if (role === MESSAGE_ROLES.USER) {
    return (
      <div
        ref={ref} // Apply ref here
        id={id}
        style={style}
        className={`px-5 py-2 mb-2 w-full flex justify-end items-start message-group user-message ${className}`}
      >
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl p-3 max-w-[85%] overflow-hidden">
          {/* User messages don't need complex rendering, just display content */}
          <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed text-sm">{content}</div>
        </div>
      </div>
    );
  }

  // Assistant Message Rendering
  if (role === MESSAGE_ROLES.ASSISTANT) {

    // --- Preprocessing Step ---
    const mathMap = new Map();
    let preprocessedContent = '';
    const potentialMath = content && /(\$\$|\\\[|\\\]|\$|\\\(|\\\))/.test(content);
    if (potentialMath) {
        let mathIndex = 0;
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
    } else {
        preprocessedContent = content || ''; // Skip preprocessing
    }
    // --- End Preprocessing ---

    // --- Optimization Check ---
    const hasMathPlaceholders = HAS_MATH_PLACEHOLDER_REGEX.test(preprocessedContent);
    // --- End Optimization Check ---

    // --- Define Component Overrides ---
    const markdownComponents = {
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
        ul: ({node, ordered, ...props}) => <ul className="list-disc pl-5 my-4 space-y-2" {...props} />,
        ol: ({node, ordered, ...props}) => <ol className="list-decimal pl-5 my-4 space-y-2" {...props} />,
        li: ({node, children, ordered, ...props}) => {
           const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
           return <li className="leading-relaxed text-sm" {...props}>{processedChildren}</li>;
        },
        p: ({ node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
            const containsBlockElement = containsBlockElementCheck(processedChildren);
            const commonClasses = "mb-4 leading-relaxed text-sm";
            const Tag = containsBlockElement ? 'div' : 'p';
            return <Tag className={commonClasses} {...props}>{processedChildren}</Tag>;
        },
        code: ({node, inline, className, children, ...props}) => {
           if (className && className.startsWith('language-')) {
              const codeContent = String(children).replace(/\n$/, '');
              return <EnhancedCodeBlock className={className} isStreaming={isStreaming}>{codeContent}</EnhancedCodeBlock>;
           }
           const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
           const containsBlockElement = containsBlockElementCheck(processedChildren);
           const commonClasses = "bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono mx-0.5 align-middle";
           const Tag = containsBlockElement ? 'span' : 'code';
           return <Tag className={commonClasses} {...props}>{processedChildren}</Tag>;
        },
        pre: ({node, children, ...props}) => {
          return <pre {...props}>{children}</pre>;
        },
        a: ({node, children, ...props}) => {
          const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
          const containsBlockElement = containsBlockElementCheck(processedChildren);
          const commonClasses = "text-primary hover:underline";
          const Tag = containsBlockElement ? 'span' : 'a';
          const tagProps = containsBlockElement
            ? { className: commonClasses, ...props }
            : { className: commonClasses, target: "_blank", rel: "noopener noreferrer", ...props };
          return <Tag {...tagProps}>{processedChildren}</Tag>;
        },
        blockquote: ({node, children, ...props}) => {
          const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
          return <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-600 dark:text-gray-400 my-4 py-1 text-sm" {...props}>{processedChildren}</blockquote>;
        },
        strong: ({node, children, ...props}) => {
          const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
          const containsBlockElement = containsBlockElementCheck(processedChildren);
          const commonClasses = "font-semibold";
          const Tag = containsBlockElement ? 'span' : 'strong';
          return <Tag className={commonClasses} {...props}>{processedChildren}</Tag>;
        },
        em: ({node, children, ...props}) => {
          const processedChildren = hasMathPlaceholders ? renderWithPlaceholdersRecursive(children, mathMap) : children;
          const containsBlockElement = containsBlockElementCheck(processedChildren);
          const commonClasses = "italic";
          const Tag = containsBlockElement ? 'span' : 'em';
          return <Tag className={commonClasses} {...props}>{processedChildren}</Tag>;
        },
     };
    // --- End Component Overrides ---


    return (
      <div
        ref={ref} // Apply ref here
        id={id}
        style={style}
        className={`group px-5 py-2 mb-2 w-full message-group assistant-message relative ${className}`}
      >
        {/* Prose container for Markdown styling */}
        <div className={`prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 break-words overflow-visible mb-3`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[]}
            components={markdownComponents}
            children={preprocessedContent}
           />
        </div>

        {/* Footer section */}
        <div className="flex justify-between items-center -mt-1 pb-6">
           <div className="text-xs opacity-70 flex items-center space-x-2">
            {platformIconUrl && (
              <img src={platformIconUrl} alt="AI Platform" className="w-3.5 h-3.5 object-contain" />
            )}
            {model && (
              <span title={model}>{model}</span>
            )}
            {isStreaming && (
              <div className="flex gap-1 items-center">
                <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce"></div>
                <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
          </div>
          {/* Copy Button Container */}
          <div className="w-7 h-7 flex items-center justify-center">
            {!isStreaming && content && content.trim() && (
              <button
                onClick={handleCopyToClipboard}
                className={`p-1 rounded-md transition-opacity duration-200 z-10 ${copyState === 'idle' ? 'opacity-0 group-hover:opacity-100 focus-within:opacity-100' : 'opacity-100'} ${copyState === 'copied' ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : copyState === 'error' ? 'bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:bg-gray-200 dark:focus:bg-gray-700'}`}
                aria-label="Copy to clipboard" title="Copy to clipboard"
              >
                <CopyButtonIcon state={copyState} />
              </button>
            )}
          </div>
        </div>

        {/* Metadata (Optional) */}
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

  // Fallback if role is somehow invalid
  return null;
})); // Close forwardRef

MessageBubble.displayName = 'MessageBubble'; // Set display name
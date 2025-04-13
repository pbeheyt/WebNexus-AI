// src/components/messaging/MessageBubble.jsx
import React, { useState, memo, Fragment } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // Keep GFM for non-math parts
// Math plugins are removed as we handle math manually
import 'katex/dist/katex.min.css'; // Keep KaTeX CSS for MathFormulaBlock

import CopyButtonIcon from './icons/CopyButtonIcon';
import EnhancedCodeBlock from './components/EnhancedCodeBlock';
import MathFormulaBlock from './components/MathFormulaBlock'; // We will use this directly
import { copyToClipboard as copyUtil } from './utils/clipboard';

// --- Console Logging Configuration ---
const DEBUG_MODE = true; // Set to true to enable detailed logs, false for production

const logDebug = (...args) => {
  if (DEBUG_MODE) {
    console.log('[MessageBubble]', ...args);
  }
};
// ------------------------------------

/**
 * Helper function to parse text and math segments using Regex.
 * Splits the string by math delimiters, preserving the delimiters for type checking.
 * @param {string} text - The raw content string
 * @returns {Array<{type: 'text'|'math', value: string, inline: boolean}>}
 */
const parseTextAndMath = (text) => {
  logDebug('Starting parseTextAndMath for text:', text);
  if (!text) {
    logDebug('Input text is empty, returning empty array.');
    return [];
  }

  // Regex to find block math ($$..$$, \[..\]) and inline math ($..$, \(..\))
  // Made inline $..$ non-greedy and require at least one char to avoid matching lone $
  // Made inline \(..\) non-greedy
  const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\]|\$.+?\$|\\\(.+?\\\))/g;
  const result = [];
  let lastIndex = 0;
  let match;

  logDebug('Using regex:', regex);

  while ((match = regex.exec(text)) !== null) {
    logDebug(`Regex match found:`, match[0], `at index:`, match.index);

    // 1. Add the text segment before the match
    if (match.index > lastIndex) {
      const textValue = text.slice(lastIndex, match.index);
      logDebug(`Adding text segment: "${textValue}"`);
      result.push({ type: 'text', value: textValue, inline: false }); // inline: false here is just a placeholder for text type
    }

    // 2. Process the matched math segment
    const part = match[0]; // The entire matched math string e.g., "$p$", "\[...\]"
    let mathContent = '';
    let inline = true; // Default to inline

    logDebug(`Processing math part: "${part}"`);

    if (part.startsWith('$$') && part.endsWith('$$')) {
      mathContent = part.slice(2, -2);
      inline = false;
      logDebug(`Detected block math ($$): "${mathContent}"`);
    } else if (part.startsWith('\\[')) {
      mathContent = part.slice(2, -2);
      inline = false;
      logDebug(`Detected block math (\\[): "${mathContent}"`);
    } else if (part.startsWith('$') && part.endsWith('$')) {
      mathContent = part.slice(1, -1);
      inline = true;
      logDebug(`Detected inline math ($): "${mathContent}"`);
    } else if (part.startsWith('\\(')) {
      mathContent = part.slice(2, -2);
      inline = true;
      logDebug(`Detected inline math (\\(): "${mathContent}"`);
    } else {
       // Should not happen with this regex, but as fallback treat as text
       logDebug(`Regex match "${part}" didn't fit expected math patterns. Treating as text.`);
       result.push({ type: 'text', value: part, inline: false });
       lastIndex = regex.lastIndex;
       continue; // Skip adding as math
    }

    // Push the identified math segment (only if content found)
    const trimmedMathContent = mathContent.trim();
    if (trimmedMathContent) {
       logDebug(`Adding math segment: value="${trimmedMathContent}", inline=${inline}`);
       result.push({ type: 'math', value: trimmedMathContent, inline });
    } else {
       // If math content is empty (e.g. "$$" or "\( \)" ), treat as text
       logDebug(`Math content was empty or whitespace only ("${mathContent}"). Treating original part "${part}" as text.`);
       result.push({ type: 'text', value: part, inline: false });
    }

    // Update the index for the next search
    lastIndex = regex.lastIndex;
    logDebug(`Updated lastIndex to: ${lastIndex}`);
  }

  // 3. Add any remaining text after the last match
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    logDebug(`Adding final text segment: "${remainingText}"`);
    result.push({ type: 'text', value: remainingText, inline: false });
  }

  logDebug('Finished parseTextAndMath. Segments:', result);
  return result;
};

/**
 * Message bubble component using manual regex parsing for math rendering.
 * @param {Object} props - Component props
 * @param {string} props.content - The message content
 * @param {string} props.role - The role of the message sender ('user', 'assistant', or 'system')
 * @param {boolean} props.isStreaming - Whether the content is still streaming
 * @param {string|null} props.model - The AI model information (optional)
 * @param {string|null} props.platformIconUrl - URL to platform icon (optional)
 * @param {Object} props.metadata - Additional metadata to display (optional)
 * @param {string} props.className - Additional CSS classes (optional)
 * @returns {JSX.Element | null} - The rendered message bubble or null
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

  logDebug(`Rendering MessageBubble. Role: ${role}, Content length: ${content?.length || 0}`);

  // Copy assistant message to clipboard
  const handleCopyToClipboard = () => {
    if (!content || isStreaming) return;
    logDebug('Attempting to copy content to clipboard.');
    copyUtil(content)
      .then(() => {
        logDebug('Copy successful.');
        setCopyState('copied');
        setTimeout(() => setCopyState('idle'), 2000);
      })
      .catch((error) => {
        console.error('Failed to copy text: ', error);
        logDebug('Copy failed.');
        setCopyState('error');
        setTimeout(() => setCopyState('idle'), 2000);
      });
  };

  // System messages (typically errors) with special styling
  if (isSystem) {
    logDebug('Rendering as system message.');
    return (
      <div className={`px-5 py-2 my-2 w-full bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 ${className}`}>
        <div className="whitespace-pre-wrap break-words overflow-hidden leading-relaxed text-sm">{content}</div>
      </div>
    );
  }

  // User messages with grey color scheme
  if (isUser) {
    logDebug('Rendering as user message.');
    return (
      <div className={`px-5 py-2 w-full flex justify-end ${className}`}>
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-tl-xl rounded-tr-xl rounded-br-none rounded-bl-xl p-3 max-w-[85%] overflow-hidden">
          <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere leading-relaxed text-sm">{content}</div>
        </div>
      </div>
    );
  }

  // --- Assistant Message Rendering ---
  if (role === 'assistant') {
    logDebug('Rendering as assistant message. Parsing content...');
    // Parse the content into text and math segments using our helper
    const segments = parseTextAndMath(content || ''); // Ensure content is not null/undefined

    logDebug(`Parsed ${segments.length} segments. Rendering...`);

    return (
      <div className={`px-5 py-2 w-full message-group relative ${className}`}>
        {/* Container for rendering segments */}
        {/* Apply prose styles for overall text formatting */}
        <div className={`prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 break-words overflow-visible mb-0`}>
          {segments.map((segment, index) => {
            logDebug(`Rendering segment ${index}: type=${segment.type}, inline=${segment.inline}, value="${segment.value.substring(0, 50)}..."`);
            return (
              <Fragment key={index}>
                {segment.type === 'text' ? (
                  // Render text segments using ReactMarkdown (with GFM, without math plugins)
                  // Wrap in a span to keep it conceptually inline within the flow
                  // Use unwrapDisallowed to prevent ReactMarkdown from adding <p> around simple text runs
                  <span className="text-segment">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]} // Use GFM for text parts (tables, lists, etc.)
                      rehypePlugins={[]} // No rehype plugins needed here
                      // *** CHANGE HERE: Attempt to prevent <p> wrapping for simple text ***
                      disallowedElements={['p']}
                      unwrapDisallowed={true}
                      // --------------------------------------------------------------------
                      components={{
                        // Keep necessary components for text rendering
                         h1: ({node, ...props}) => <h1 className="text-xl font-semibold mt-5 mb-3" {...props} />,
                         h2: ({node, ...props}) => <h2 className="text-lg font-medium mt-4 mb-2" {...props} />,
                         h3: ({node, ...props}) => <h3 className="text-base font-medium mt-3 mb-2" {...props} />,
                         // If unwrapDisallowed works, this 'p' might not be used often for simple text,
                         // but it's needed if the text segment itself contains paragraph breaks.
                         p: ({node, children, ...props}) => <p className="mb-3 leading-relaxed text-sm" {...props}>{children}</p>,
                         ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 mt-1 space-y-1.5" {...props} />,
                         ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 mt-1 space-y-1.5" {...props} />,
                         li: ({node, ...props}) => <li className="leading-relaxed text-sm" {...props} />,
                         code: ({node, inline, className, children, ...props}) => {
                            // Handle code blocks/inline code found within text segments
                            if (inline) {
                               return <code className="bg-theme-hover px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>;
                            }
                            // Use EnhancedCodeBlock for fenced code blocks parsed by remarkGfm
                            // Ensure children are passed correctly, might need processing
                            const codeContent = React.Children.toArray(children).map(child =>
                              typeof child === 'string' ? child : ''
                            ).join('').replace(/\n$/, ''); // Remove trailing newline often added
                            return <EnhancedCodeBlock language={className?.replace('language-', '')} isStreaming={isStreaming}>{codeContent}</EnhancedCodeBlock>;
                         },
                         // Pass 'pre' through, EnhancedCodeBlock likely handles it
                         pre: ({node, children, ...props}) => <>{children}</>, // Let `code` handle the block rendering
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
                      // Render only this specific text segment
                      children={segment.value}
                     />
                   </span>
                ) : (
                  // Render math segments using MathFormulaBlock directly
                  // Assuming MathFormulaBlock renders an inline element (e.g., span) when inline={true}
                  // and a block element (e.g., div) when inline={false}
                  <MathFormulaBlock content={segment.value} inline={segment.inline} />
                )}
              </Fragment>
            );
          })}
        </div>

        {/* Footer section: Model info, streaming indicator, copy button */}
        <div className="flex justify-between items-center -mt-1">
          {/* Model info */}
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

          {/* Copy Button */}
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

  logDebug('Component rendering fallback (should not happen for user/assistant/system roles).');
  return null; // Fallback return
});

// Make sure MathFormulaBlock is imported correctly
// Example minimal stub for MathFormulaBlock if you don't have it,
// replace with your actual component.
/*
const MathFormulaBlock = ({ content, inline }) => {
  const Tag = inline ? 'span' : 'div';
  // In a real component, you'd use KaTeX here
  // For debugging, just show the content and inline status
  return (
    <Tag style={{
      display: inline ? 'inline' : 'block',
      padding: '0 2px',
      margin: inline ? '0' : '1em 0',
      border: '1px dashed lightgray', // For visualization
      fontFamily: 'monospace'
    }}>
      {`MATH(${inline ? 'inline' : 'block'}): ${content}`}
    </Tag>
  );
};
*/
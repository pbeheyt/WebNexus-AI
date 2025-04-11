import React, { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { looksLikeCode } from '../utils/codeDetection';
import { isMathFormula, isMathVariable, hasLatexEnvironments, hasLatexCommands, hasLatexDelimiters } from '../utils/mathDetection';
import CopyButtonIcon from './icons/CopyButtonIcon';
import EnhancedCodeBlock from './EnhancedCodeBlock';
import MathFormulaBlock from './MathFormulaBlock';

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
const MessageBubbleComponent = ({
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

  // Copy assistant message to clipboard
  const copyToClipboard = () => {
    if (!content || isStreaming) return;
    
    try {
      copyToClipboard(content);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (error) {
      console.error('Failed to copy text: ', error);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
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
      <div className={`prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 break-words overflow-visible`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]} // Added remarkMath plugin
          components={{
            // Math components for LaTeX-style math rendering
            math: ({value}) => <MathFormulaBlock content={value} />,
            inlineMath: ({value}) => <MathFormulaBlock content={value} inline={true} />,
            
            // Headings with consistent spacing hierarchy (more compact)
            h1: ({node, ...props}) => <h1 className="text-xl font-semibold mt-5 mb-3" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-lg font-medium mt-4 mb-2" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-base font-medium mt-3 mb-2" {...props} />,
            
            // Paragraph with improved spacing (more compact)
            p: ({node, ...props}) => <p className="mb-3 leading-relaxed text-sm" {...props} />,

            // Lists with better spacing between items and surrounding elements (more compact)
            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 mt-1 space-y-1.5" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 mt-1 space-y-1.5" {...props} />,
            li: ({node, ...props}) => <li className="leading-relaxed text-sm" {...props} />,

            code: ({node, inline, className, children, ...props}) => {
              // Check if it's a block code (has language class) or inline
              const match = /language-(\w+)/.exec(className || '');
              const content = String(children).trim();
              
              // First check for explicit language code blocks
              const isExplicitCodeBlock = match && match[1] && 
                                        ['python', 'javascript', 'java', 'c', 'cpp', 'csharp', 'ruby',
                                        'go', 'rust', 'swift', 'kotlin', 'typescript', 'php'].includes(match[1].toLowerCase());
              
              // If this is explicitly marked as code, render it as code
              if (!inline && isExplicitCodeBlock) {
                return (
                  <EnhancedCodeBlock className={className} isStreaming={isStreaming}>
                    {children}
                  </EnhancedCodeBlock>
                );
              }
              
              // Check if this is obviously code
              if (!inline && looksLikeCode(content)) {
                return (
                  <EnhancedCodeBlock className={className} isStreaming={isStreaming}>
                    {children}
                  </EnhancedCodeBlock>
                );
              }
              
              // Check for math variables (but only if not code)
              if (inline && isMathVariable(content)) {
                return <MathFormulaBlock content={content} inline={true} />;
              }
              
              // Check for LaTeX environments directly
              if (hasLatexEnvironments(content)) {
                return <MathFormulaBlock content={content} inline={false} />;
              }
              
              // Check for LaTeX commands that indicate math content
              if (hasLatexCommands(content)) {
                // Determine if this should be inline based on content length and complexity
                const shouldBeInline = inline || (content.length < 30 && !content.includes('\n'));
                return <MathFormulaBlock content={content} inline={shouldBeInline} />;
              }
              
              // Check if this is marked as "text" language but contains LaTeX markers
              const isTextLanguage = match && match[1]?.toLowerCase() === 'text';
              if (!inline && isTextLanguage && 
                  (content.includes('\\begin') || content.includes('\\end') || 
                  content.includes('\\cdot') || content.includes('\\_{'))) {
                return <MathFormulaBlock content={content} />;
              }
              
              // Check for LaTeX-style math delimiters
              if (hasLatexDelimiters(content)) {
                // Let the remark-math plugin handle this
                return props.children;
              }
              
              // Skip code block rendering for "text" language blocks that aren't math
              if (!inline && isTextLanguage && !isMathFormula(content)) {
                // For "text" language blocks, render as a formatted text block
                return (
                  <div className="p-3 rounded my-3 font-mono text-sm whitespace-pre-wrap">
                    {children}
                  </div>
                );
              }
              
              // Check if this is a math formula
              if (isMathFormula(content)) {
                // Short expressions should be inline
                const isShortExpression = content.length < 30 && !content.includes('\n');
                const shouldRenderInline = inline || isShortExpression;
                
                // Use KaTeX to render the formula
                return <MathFormulaBlock content={content} inline={shouldRenderInline} />;
              }
              
              // If multi-line and not explicitly marked as a language, treat as code
              if (!inline && content.includes('\n')) {
                return (
                  <EnhancedCodeBlock className={className} isStreaming={isStreaming}>
                    {children}
                  </EnhancedCodeBlock>
                );
              }
              
              // Special case for filenames or module references
              const isFilenameOrModule = !inline && content.indexOf('\n') === -1 && 
                                content.indexOf(' ') === -1 && 
                                (
                                  // Traditional file extensions
                                  /\.\w{1,4}$/.test(content) ||
                                  // Module.function patterns (like numpy.polyfit)
                                  /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(content)
                                );
              
              if (isFilenameOrModule) {
                return (
                  <code className="px-2 py-1 rounded text-xs font-mono inline-block">
                    {children}
                  </code>
                );
              }
              
              // Default: Regular inline code
              return (
                <code className="bg-theme-hover px-1 py-0.5 rounded text-xs font-mono" {...props}>
                  {children}
                </code>
              );
            },
            
            // Ensure `pre` itself doesn't get default Prose styling if `code` handles it
            pre: ({node, children, ...props}) => <>{children}</>, // Render children directly as `code` handles the styling
            a: ({node, ...props}) => <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
            
            // Better spacing for blockquotes (more compact)
            blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-theme pl-3 italic text-theme-secondary my-3 py-1 text-xs" {...props} />,
            
            strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
            em: ({node, ...props}) => <em className="italic" {...props} />,
            
            // Improved horizontal rule spacing (more compact)
            hr: ({node, ...props}) => <hr className="my-4 border-t border-gray-300 dark:border-gray-600" {...props} />,
            
            // Table handling with consistent spacing (more compact)
            table: ({node, ...props}) => <div className="overflow-x-auto my-3"><table className="border-collapse w-full text-xs" {...props} /></div>,
            thead: ({node, ...props}) => <thead className="bg-gray-100 dark:bg-gray-800" {...props} />,
            tbody: ({node, ...props}) => <tbody {...props} />,
            tr: ({node, ...props}) => <tr className="border-b border-gray-200 dark:border-gray-700" {...props} />,
            th: ({node, ...props}) => <th className="p-2 text-left font-medium text-xs" {...props} />,
            td: ({node, ...props}) => <td className="p-2 border-gray-200 dark:border-gray-700 text-xs" {...props} />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      <div className="flex justify-between items-center mt-1">
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
              onClick={copyToClipboard}
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
};

const MessageBubble = memo(MessageBubbleComponent);

export default MessageBubble;
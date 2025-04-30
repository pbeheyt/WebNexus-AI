import React, { memo, forwardRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';

import { logger } from '../../../shared/logger';
import { IconButton, RerunIcon, PlatformIcon } from '../../../components';
import { useSidebarChat } from '../../contexts/SidebarChatContext';

import EnhancedCodeBlock from './EnhancedCodeBlock';
import { useCopyToClipboard } from './hooks/useCopyToClipboard';
import { parseTextAndMath } from './utils/parseTextAndMath';
import {
  renderWithPlaceholdersRecursive,
  containsBlockElementCheck,
  HAS_MATH_PLACEHOLDER_REGEX,
} from './utils/markdownUtils.js';

// Common button styling classes
const actionButtonClasses =
  'p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-primary';

export const AssistantMessageBubble = memo(
  forwardRef(
    (
      {
        id,
        content,
        isStreaming = false,
        model = null,
        platformIconUrl = null,
        platformId = null,
        metadata = {},
        className = '',
        style = {},
      },
      ref
    ) => {
      // Hooks needed for Assistant functionality
      const { rerunAssistantMessage, isProcessing, isCanceling } =
        useSidebarChat();
      const {
        copyState: assistantCopyState,
        handleCopy: handleAssistantCopy,
        IconComponent: AssistantIconComponent,
        iconClassName: assistantIconClassName,
        disabled: assistantCopyDisabled,
      } = useCopyToClipboard(content);

      // For assistant rerun
      const handleRerunAssistant = () => {
        if (id && rerunAssistantMessage) {
          rerunAssistantMessage(id);
        }
      };

      // --- Memoized Preprocessing Step ---
      const { preprocessedContent, mathMap } = useMemo(() => {
        const map = new Map();
        let processed = '';
        const potentialMath =
          content && /(\$\$|\\\[|\\\]|\$|\\\(|\\\))/.test(content);

        if (potentialMath) {
          let mathIndex = 0;
          try {
            const segments = parseTextAndMath(content || '');
            const processedSegments = segments.map((segment) => {
              if (segment.type === 'math') {
                const placeholder = `@@MATH_${segment.inline ? 'INLINE' : 'BLOCK'}_${mathIndex++}@@`;
                map.set(placeholder, {
                  content: segment.value,
                  inline: segment.inline,
                });
                return placeholder;
              }
              return segment.value;
            });
            processed = processedSegments.join('');
          } catch (error) {
            logger.sidebar.error('Error during math preprocessing:', error);
            processed = content || ''; // Fallback
          }
        } else {
          processed = content || ''; // Skip preprocessing
        }
        return { preprocessedContent: processed, mathMap: map };
      }, [content]);
      // --- End Memoized Preprocessing ---

      // --- Optimization Check (after memoization) ---
      const hasMathPlaceholders = useMemo(
        () => HAS_MATH_PLACEHOLDER_REGEX.test(preprocessedContent),
        [preprocessedContent]
      );
      // --- End Optimization Check ---

      // --- Memoized Component Overrides ---
      const markdownComponents = useMemo(
        () => ({
          h1: ({ node: _node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            return (
              <h1 className='text-xl font-semibold mt-6 mb-4' {...props}>
                {processedChildren}
              </h1>
            );
          },
          h2: ({ node: _node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            return (
              <h2 className='text-lg font-medium mt-5 mb-3' {...props}>
                {processedChildren}
              </h2>
            );
          },
          h3: ({ node: _node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            return (
              <h3 className='text-base font-medium mt-4 mb-3' {...props}>
                {processedChildren}
              </h3>
            );
          },
          h4: ({ node: _node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            return (
              <h4 className='text-sm font-medium mt-3 mb-2' {...props}>
                {processedChildren}
              </h4>
            );
          },
          h5: ({ node: _node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            return (
              <h5 className='text-xs font-semibold mt-2 mb-1' {...props}>
                {processedChildren}
              </h5>
            );
          },
          h6: ({ node: _node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            return (
              <h6
                className='text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 mb-1'
                {...props}
              >
                {processedChildren}
              </h6>
            );
          },
          ul: ({ node: _node, ordered: _ordered, ...props }) => (
            <ul className='list-disc pl-5 my-4 space-y-2' {...props} />
          ),
          ol: ({ node: _node, ordered: _ordered, ...props }) => (
            <ol className='list-decimal pl-5 my-4 space-y-2' {...props} />
          ),
          li: ({ node: _node, children, ordered: _ordered, ...props }) => {
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            return (
              <li className='leading-relaxed text-sm' {...props}>
                {processedChildren}
              </li>
            );
          },
          p: ({ node: _node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            const commonClasses = 'mb-4 leading-relaxed text-sm';
            // ALWAYS use a <div> tag as the container
            return (
              <div className={commonClasses} {...props}>
                {processedChildren}
              </div>
            );
          },
          pre: ({ node: _node, children, ...props }) => {
            const codeChild = node?.children?.[0];
            const isFencedCodeBlock =
              codeChild?.tagName === 'code' &&
              codeChild?.properties?.className?.some((cls) =>
                cls.startsWith('language-')
              );

            if (isFencedCodeBlock) {
              const languageClass = codeChild.properties.className.find((cls) =>
                cls.startsWith('language-')
              );
              const codeContent = codeChild.children?.[0]?.value || '';
              return (
                <EnhancedCodeBlock
                  className={languageClass}
                  isStreaming={isStreaming}
                >
                  {codeContent}
                </EnhancedCodeBlock>
              );
            }
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            return <pre {...props}>{processedChildren}</pre>;
          },
          code: ({ node: _node, inline, className: _className, children, ...props }) => {
            if (inline) {
              const processedChildren = hasMathPlaceholders
                ? renderWithPlaceholdersRecursive(children, mathMap)
                : children;
              const containsBlockElement =
                containsBlockElementCheck(processedChildren);
              const commonClasses =
                'bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono mx-0.5 align-middle';
              const Tag = containsBlockElement ? 'span' : 'code';
              return (
                <Tag className={commonClasses} {...props}>
                  {processedChildren}
                </Tag>
              );
            }
            return <>{children}</>; // Let `pre` handle block code
          },
          a: ({ node: _node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            // Use imported check function
            const containsBlockElement =
              containsBlockElementCheck(processedChildren);
            const commonClasses = 'text-primary hover:underline';
            const Tag = containsBlockElement ? 'span' : 'a';
            const tagProps = containsBlockElement
              ? { className: commonClasses, ...props }
              : {
                  className: commonClasses,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  ...props,
                };
            return <Tag {...tagProps}>{processedChildren}</Tag>;
          },
          blockquote: ({ node: _node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            return (
              <blockquote
                className='border-l-2 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-600 dark:text-gray-400 my-4 py-1 text-sm'
                {...props}
              >
                {processedChildren}
              </blockquote>
            );
          },
          strong: ({ node: _node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            const containsBlockElement =
              containsBlockElementCheck(processedChildren);
            const commonClasses = 'font-semibold';
            const Tag = containsBlockElement ? 'span' : 'strong';
            return (
              <Tag className={commonClasses} {...props}>
                {processedChildren}
              </Tag>
            );
          },
          em: ({ node: _node, children, ...props }) => {
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            const containsBlockElement =
              containsBlockElementCheck(processedChildren);
            const commonClasses = 'italic';
            const Tag = containsBlockElement ? 'span' : 'em';
            return (
              <Tag className={commonClasses} {...props}>
                {processedChildren}
              </Tag>
            );
          },
        }),
        [hasMathPlaceholders, mathMap, isStreaming] // isStreaming dependency for EnhancedCodeBlock
      ); // Dependencies for markdownComponents memo
      // --- End Memoized Component Overrides ---

      return (
        <div
          ref={ref}
          id={id}
          style={style}
          className={`group px-5 pt-4 w-full message-group assistant-message relative ${className}`}
        >
          {/* Prose container for Markdown styling */}
          <div
            className={`prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 break-words overflow-visible`}
          >
            {/* Changed from children prop to nesting */}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[]}
              components={markdownComponents}
            >
              {preprocessedContent}
            </ReactMarkdown>
          </div>

          {/* Footer section */}
          <div className='flex justify-between items-center pb-4'>
            <div className='text-xs opacity-70 flex items-center space-x-2 select-none'>
              {platformIconUrl && (
                <PlatformIcon
                  platformId={platformId}
                  iconUrl={platformIconUrl}
                  altText='AI Platform'
                  className='w-3.5 h-3.5'
                />
              )}
              {model && (
                <span title={model} className='select-none'>
                  {model}
                </span>
              )}
              {isStreaming && (
                <div className='flex gap-1 items-center'>
                  <div className='w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce'></div>
                  <div
                    className='w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce'
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                  <div
                    className='w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400 animate-bounce'
                    style={{ animationDelay: '0.4s' }}
                  ></div>
                </div>
              )}
            </div>
            {/* Buttons Container (Rerun + Copy) */}
            <div
              className={`flex items-center justify-center gap-1 transition-opacity duration-150 ${isProcessing ? 'opacity-0 pointer-events-none' : assistantCopyState === 'copied' || assistantCopyState === 'error' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}
            >
              {!isStreaming && content && content.trim() && (
                <>
                  {' '}
                  {/* Use fragment to group buttons */}
                  <IconButton
                    icon={RerunIcon}
                    iconClassName='w-4 h-4 select-none'
                    onClick={handleRerunAssistant}
                    className={actionButtonClasses}
                    aria-label='Rerun generation'
                    title='Rerun generation'
                    disabled={isProcessing || isCanceling}
                  />
                  {/* Copy IconButton using renamed variables */}
                  <IconButton
                    onClick={handleAssistantCopy}
                    className={actionButtonClasses}
                    aria-label='Copy to clipboard'
                    title='Copy to clipboard'
                    icon={AssistantIconComponent}
                    iconClassName={`w-4 h-4 select-none ${assistantIconClassName}`}
                    disabled={isStreaming || assistantCopyDisabled}
                  />
                </>
              )}
            </div>
          </div>

          {/* Metadata (Optional) */}
          {Object.keys(metadata).length > 0 && (
            <div className='text-xs mt-3 opacity-70 overflow-hidden text-ellipsis space-x-3'>
              {Object.entries(metadata).map(([key, value]) => (
                <span key={key} className='inline-block break-words'>
                  <span className='font-medium'>{key}:</span>{' '}
                  {typeof value === 'object' ? JSON.stringify(value) : value}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
  )
);

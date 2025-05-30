import React, { memo, forwardRef, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';

import { logger } from '../../../shared/logger';
import { IconButton, RerunIcon, PlatformIcon, Tooltip } from '../../../components';
import { useSidePanelChat } from '../../contexts/SidePanelChatContext';
import { formatCost } from '../../../shared/utils/number-format-utils.js';

import ThinkingBlock from './ThinkingBlock';
import CodeBlock from './CodeBlock.jsx';
import { useCopyToClipboard } from './hooks/useCopyToClipboard';
import { parseTextAndMath } from './utils/parse-text-and-math-utils';
import {
  renderWithPlaceholdersRecursive,
  containsBlockElementCheck,
  HAS_MATH_PLACEHOLDER_REGEX,
} from './utils/markdown-utils.js';

// Common button styling classes
const actionButtonClasses =
  'p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-primary';

export const AssistantMessageBubble = memo(
  forwardRef(
    (
      {
        id,
        content,
        thinkingContent = null,
        isStreaming = false,
        model = null,
        modelDisplayName = null,
        platformIconUrl = null,
        platformId = null,
        className = '',
        style = {},
        apiCost, // Destructure apiCost
      },
      ref
    ) => {
      // Hooks needed for Assistant functionality
      const { rerunAssistantMessage, isProcessing, isCanceling } =
        useSidePanelChat();
      const {
        copyState: assistantCopyState,
        handleCopy: handleAssistantCopy,
        IconComponent: AssistantIconComponent,
        iconClassName: assistantIconClassName,
        disabled: assistantCopyDisabled,
      } = useCopyToClipboard(content);

      const [costTooltipVisible, setCostTooltipVisible] = useState(false);
      const costDisplayRef = useRef(null);

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
            logger.sidepanel.error('Error during math preprocessing:', error);
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
          pre: ({ node, children, ...props }) => {
            const isFencedCodeBlock =
              node?.children?.[0]?.type === 'element' &&
              node?.children?.[0]?.tagName === 'code' &&
              node?.children?.[0]?.properties?.className?.some((cls) =>
                cls.startsWith('language-')
              );

            if (isFencedCodeBlock) {
              const languageClass = node.children[0].properties.className.find(
                (cls) => cls.startsWith('language-')
              );
              const codeContent = node.children[0].children?.[0]?.value || '';
              return (
                <CodeBlock className={languageClass} isStreaming={isStreaming}>
                  {codeContent}
                </CodeBlock>
              );
            }
            const processedChildren = hasMathPlaceholders
              ? renderWithPlaceholdersRecursive(children, mathMap)
              : children;
            return <pre {...props}>{processedChildren}</pre>;
          },
          code: ({
            node: _node,
            inline,
            className: _className,
            children,
            ...props
          }) => {
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
        [hasMathPlaceholders, mathMap, isStreaming] // isStreaming dependency for CodeBlock
      ); // Dependencies for markdownComponents memo
      // --- End Memoized Component Overrides ---

      return (
        <div
          ref={ref}
          id={id}
          style={style}
          className={`group px-5 @md:px-6 @lg:px-7 @xl:px-8 pt-4 w-full message-group assistant-message relative ${className}`}
        >
          {/* Render Thinking Block if content exists */}
          {thinkingContent && thinkingContent.trim() && (
            <ThinkingBlock
              thinkingContent={thinkingContent}
              isStreaming={isStreaming}
            />
          )}

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
            <div className='text-xs opacity-70 flex items-center space-x-2'>
              {platformIconUrl && (
                <div className='select-none'>
                  <PlatformIcon
                    platformId={platformId}
                    iconUrl={platformIconUrl}
                    altText='AI Platform'
                    className='w-3.5 h-3.5'
                  />
                </div>
              )}
              {model && (
                <span title={modelDisplayName || model}>
                  {' '}
                  {/* Show ID in title if displayName is different */}
                  {modelDisplayName || model}{' '}
                  {/* Display displayName, fallback to ID */}
                </span>
              )}
              {/* API Cost Badge */}
              {!isStreaming && typeof apiCost === 'number' && apiCost >= 0 && ( // Show if apiCost is a number and >= 0
                <>
                  <span
                    ref={costDisplayRef}
                    className="ml-2 text-xxs text-theme-secondary opacity-80 cursor-help"
                      onMouseEnter={() => setCostTooltipVisible(true)}
                      onMouseLeave={() => setCostTooltipVisible(false)}
                      role="status"
                      aria-label={`Estimated cost: ${formatCost(apiCost)}`}
                    >
                      ({formatCost(apiCost)})
                    </span>
                    <Tooltip
                      show={costTooltipVisible}
                      message={`Est. cost for this response: ${formatCost(apiCost)}`}
                      targetRef={costDisplayRef}
                      position="top"
                    />
                  </>
                )}
                {/* End API Cost Badge */}
              <div
                className={`flex gap-1 items-center transition-opacity duration-150 h-4 select-none ${isStreaming ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              >
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
        </div>
      );
    }
  )
);

AssistantMessageBubble.propTypes = {
  id: PropTypes.string.isRequired,
  content: PropTypes.string,
  thinkingContent: PropTypes.string,
  isStreaming: PropTypes.bool,
  model: PropTypes.string,
  modelDisplayName: PropTypes.string,
  platformIconUrl: PropTypes.string,
  platformId: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  apiCost: PropTypes.number, // Add this line
};

AssistantMessageBubble.displayName = 'AssistantMessageBubble';
<environment_details>
# VSCode Visible Files
src/sidepanel/components/messaging/AssistantMessageBubble.jsx

# VSCode Open Tabs
.aidigestignore
src/sidepanel/components/Header.jsx
src/sidepanel/components/ModelSelector.jsx
src/sidepanel/components/PlatformSelector.jsx
src/sidepanel/components/PlatformModelControls.jsx
src/sidepanel/components/UserInput.jsx
src/sidepanel/services/TokenManagementService.js
src/sidepanel/SidePanelApp.jsx
src/components/icons/ModelParametersIcon.jsx
src/components/index.js
src/sidepanel/index.jsx
src/styles/index.css
src/components/input/UnifiedInput.jsx
src/components/input/PromptDropdown.jsx
src/shared/constants.js
src/background/initialization.js
src/content/extractor-content.js
src/extractor/base-extractor.js
src/extractor/strategies/general-strategy.js
src/components/icons/FocusedStrategyIcon.jsx
src/components/icons/BroadStrategyIcon.jsx
src/components/core/ExtractionStrategySelector.jsx
src/popup/Popup.jsx
src/services/ContentFormatter.js
src/extractor/extractor-factory.js
src/background/services/content-extraction.js
src/extractor/strategies/reddit-strategy.js
src/shared/utils/prompt-utils.js
src/components/icons/StarFilledIcon.jsx
src/components/icons/StarOutlineIcon.jsx
src/components/core/Button.jsx
src/settings/components/ui/api/PlatformDetails.jsx
src/hooks/useMinimumLoadingTime.js
src/shared/utils/placeholder-utils.js
src/platforms/implementations/chatgpt-platform.js
src/platforms/implementations/deepseek-platform.js
src/platforms/implementations/gemini-platform.js
src/platforms/implementations/grok-platform.js
src/sidepanel/components/messaging/utils/markdown-utils.js
src/sidepanel/components/messaging/CodeBlock.jsx
package.json
src/components/feedback/StatusMessage.jsx
prompt-full-code
src/background/services/content-processing.js
src/components/layout/AppHeader.jsx
src/settings/SettingsApp.jsx
src/settings/components/ui/api/PlatformSidebar.jsx
src/settings/components/tabs/PromptManagement.jsx
src/shared/utils/shortcut-utils.js
src/components/core/Modal.jsx
src/background/services/sidebar-manager.js
src/components/icons/KeyIcon.jsx
prompt-auto-edit
src/shared/utils/number-format-utils.js
src/sidepanel/services/ChatHistoryService.js
src/sidepanel/hooks/useChatStreaming.js
src/sidepanel/components/messaging/AssistantMessageBubble.jsx
src/sidepanel/components/TokenCounter.jsx
src/sidepanel/components/ChatArea.jsx
src/sidepanel/hooks/useSidePanelModelParameters.js
src/sidepanel/components/SidePanelModelParametersEditor.jsx
src/sidepanel/components/messaging/hooks/useCopyToClipboard.js
src/settings/hooks/useModelParametersSettings.js
src/api/api-base.js
src/settings/services/UserDataService.js
src/api/utils/error-utils.js
src/settings/utils/import-validation-utils.js
src/settings/contexts/ApiSettingsContext.jsx
webpack.config.js
src/settings/components/tabs/DataManagementTab.jsx
src/background/listeners/tab-listener.js
platform-api-config.json
package-lock.json
platform-display-config.json
src/settings/components/ui/api/ModelParametersSettings.jsx
src/sidepanel/contexts/SidePanelChatContext.jsx
src/sidepanel/hooks/useMessageActions.js
src/sidepanel/components/messaging/MessageBubble.jsx
src/sidepanel/components/messaging/SystemMessageBubble.jsx
src/background/services/sidepanel-manager.js
src/components/feedback/Toast.jsx
src/settings/components/ui/prompts/PromptList.jsx
src/contexts/platform/hooks/useModelManagement.js
src/contexts/platform/TabAwarePlatformContext.jsx
src/services/CredentialManager.js
src/services/ConfigService.js
src/settings/contexts/TabContext.jsx
src/settings/components/tabs/index.js
src/settings/components/layout/TabNavigation.jsx
src/settings/components/layout/TabContent.jsx
src/settings/components/tabs/KeyboardShortcutsTab.jsx
tailwind.config.js
src/platforms/platform-base.js
src/components/core/IconButton.jsx
src/platforms/implementations/mistral-platform.js
src/platforms/implementations/claude-platform.js
NOTICES.txt
src/extractor/utils/text-utils.js
src/extractor/strategies/youtube-strategy.js
prompt-config.json
permissions.md
presentation/description.md
src/components/core/Toggle.jsx
README.md
src/extractor/strategies/pdf-strategy.js
src/shared/logger.js
src/platforms/platform-interface.js
src/services/ApiServiceManager.js
src/background/core/state-manager.js
src/background/api/api-coordinator.js
src/background/listeners/tab-state-listener.js
src/background/index.js
src/services/SidePanelStateManager.js
src/background/core/message-router.js
src/contexts/platform/hooks/useCredentialStatus.js
src/contexts/platform/hooks/usePlatformSelection.js
src/sidepanel/components/messaging/UserMessageBubble.jsx
src/background/services/theme-service.js
src/components/icons/SidepanelIcon.jsx
src/contexts/platform/SidePanelPlatformContext.jsx
src/contexts/platform/index.js
src/hooks/useConfigurableShortcut.js
src/hooks/useContentProcessing.js
src/services/ModelParameterService.js
.gitignore
src/sidepanel/components/messaging/MathFormulaBlock.jsx
src/sidepanel/components/messaging/ThinkingBlock.jsx
src/sidepanel/components/messaging/utils/clipboard.js
src/sidepanel/components/messaging/utils/parseTextAndMath.js
src/sidepanel/hooks/useTokenTracking.js
src/settings/components/ui/ShortcutCaptureInput.jsx
manifest.json
src/settings/components/ui/common/SubTabLayout.jsx
src/settings/components/ui/common/SettingsCard.jsx
sidepanel.html
src/components/core/CustomSelect.jsx
src/components/feedback/NotificationContext.jsx
src/settings/utils/modelSettingsHelper.js
src/settings/components/tabs/ApiSettings.jsx
src/components/form/TextArea.jsx
src/settings/components/ui/prompts/PromptDetail.jsx
src/components/form/Input.jsx
src/settings/components/ui/prompts/PromptForm.jsx
src/shared/utils/import-validation-utils.js
src/services/UserDataService.js

# Current Time
5/30/2025, 11:30:42 PM (Europe/Paris, UTC+2:00)

# Context Window Usage
116,723 / 1,048.576K tokens used (11%)

# Current Mode
ACT MODE
</environment_details>

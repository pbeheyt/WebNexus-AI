// src/sidepanel/components/messaging/SimpleCodeBlock.jsx
import React from 'react';
import PropTypes from 'prop-types';

import { IconButton } from '../../../components';

import { useCopyToClipboard } from './hooks/useCopyToClipboard';

/**
 * A simple, non-syntax-highlighted code block for indented code in Markdown.
 * Features a copy button and distinct, theme-aware styling.
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Content to be rendered inside the code block
 * @returns {JSX.Element} - A formatted code block
 */
const SimpleCodeBlock = ({ children }) => {
  const codeContent = String(children).replace(/\n$/, '');
  const { copyState, handleCopy, IconComponent, iconClassName, disabled } =
    useCopyToClipboard(codeContent);

  // Define classes based on the copy state for better readability and maintenance
  const idleClasses =
    'text-theme-secondary opacity-0 code-block-group-hover:opacity-100 focus-within:opacity-100 hover:bg-theme-hover hover:text-theme-primary';
  const copiedClasses =
    'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 opacity-100';
  const errorClasses =
    'bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400 opacity-100';

  let buttonStateClasses;
  switch (copyState) {
    case 'copied':
      buttonStateClasses = copiedClasses;
      break;
    case 'error':
      buttonStateClasses = errorClasses;
      break;
    default: // 'idle'
      buttonStateClasses = idleClasses;
  }

  return (
    // Changed to `inline-flex` and added `max-w-full` to allow shrink-to-fit behavior
    <div className='relative code-block-group m-2 rounded-lg bg-theme-secondary inline-flex items-center max-w-full px-1.5'>
      {/* Code content area, grows to fill space */}
      <div className='whitespace-pre-wrap break-words text-theme-primary text-sm font-mono p-1.5'>
        {codeContent}
      </div>
      {/* Copy button container */}
      <div className='flex-shrink-0'>
        <IconButton
          icon={IconComponent}
          iconClassName={`w-4 h-4 select-none ${iconClassName}`}
          onClick={handleCopy}
          disabled={disabled}
          aria-label='Copy code to clipboard'
          title='Copy code to clipboard'
          className={`p-1 rounded-md transition-all duration-200 ${buttonStateClasses}`}
        />
      </div>
    </div>
  );
};

SimpleCodeBlock.propTypes = {
  children: PropTypes.node,
};

export default SimpleCodeBlock;

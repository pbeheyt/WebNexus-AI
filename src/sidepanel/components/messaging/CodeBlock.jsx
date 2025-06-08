// src/sidepanel/components/messaging/CodeBlock.jsx
import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import html from 'react-syntax-highlighter/dist/esm/languages/prism/markup'; // HTML is often under 'markup'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import scss from 'react-syntax-highlighter/dist/esm/languages/prism/scss';
import less from 'react-syntax-highlighter/dist/esm/languages/prism/less';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import xml from 'react-syntax-highlighter/dist/esm/languages/prism/markup'; // XML also often under 'markup'
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import ini from 'react-syntax-highlighter/dist/esm/languages/prism/ini';
import makefile from 'react-syntax-highlighter/dist/esm/languages/prism/makefile';

import { IconButton } from '../../../components';
import { useUI } from '../../../contexts/UIContext';

import { useCopyToClipboard } from './hooks/useCopyToClipboard';

// Register languages for syntax highlighting
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('cs', csharp);
SyntaxHighlighter.registerLanguage('dotnet', csharp);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('c++', cpp);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('golang', go);
SyntaxHighlighter.registerLanguage('ruby', ruby);
SyntaxHighlighter.registerLanguage('rb', ruby);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('swift', swift);
SyntaxHighlighter.registerLanguage('kotlin', kotlin);
SyntaxHighlighter.registerLanguage('kt', kotlin);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('rs', rust);
SyntaxHighlighter.registerLanguage('html', html);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('scss', scss);
SyntaxHighlighter.registerLanguage('less', less);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('mkd', markdown);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('xml', xml);
SyntaxHighlighter.registerLanguage('diff', diff);
SyntaxHighlighter.registerLanguage('ini', ini);
SyntaxHighlighter.registerLanguage('makefile', makefile);

/**
 * CodeBlock with syntax highlighting and copy functionality.
 * This version allows the code block to grow vertically to fit its content.
 * @param {Object} props - Component props
 * @param {string} props.className - Class containing language information
 * @param {React.ReactNode} props.children - Content to be rendered inside the code block
 * @param {boolean} props.isStreaming - Whether the content is still streaming
 * @returns {JSX.Element} - A formatted code block with syntax highlighting
 */
const CodeBlock = memo(({ className, children, isStreaming = false }) => {
  const codeContent = String(children).replace(/\n$/, '');
  const { copyState, handleCopy, IconComponent, iconClassName, disabled } =
    useCopyToClipboard(codeContent);
  const { theme } = useUI(); // Get theme from the extension's context

        const isDarkMode = theme === 'dark';

  const languageMatch = /language-(\w+)/.exec(className || '');
  const language = languageMatch ? languageMatch[1] : 'text';
  const displayLanguage = language.charAt(0).toUpperCase() + language.slice(1);
        const syntaxTheme = isDarkMode ? oneDark : oneLight;

  // Refactored button classes for readability
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
    <div className='relative code-block-group my-4 rounded-lg border border-gray-200 dark:border-gray-700'>
      {/* Header with language display and copy button */}
      <div className='flex justify-between items-center px-3 py-1.5 bg-theme-secondary rounded-t-lg'>
        <span className='font-mono text-xs text-theme-secondary'>
          {displayLanguage}
        </span>
        {!isStreaming && (
          <IconButton
            icon={IconComponent}
            iconClassName={`w-4 h-4 select-none ${iconClassName}`}
            onClick={handleCopy}
            disabled={disabled}
            aria-label='Copy code to clipboard'
            title='Copy code to clipboard'
            className={`p-1 rounded-md transition-all duration-200 ${buttonStateClasses}`}
          />
        )}
      </div>

      {/* Code content area with syntax highlighting and distinct background */}
        <div className='overflow-x-auto w-full rounded-b-lg bg-white dark:bg-gray-900'>
        <SyntaxHighlighter
          language={language}
          style={syntaxTheme}
          customStyle={{
            margin: 0,
            padding: '0.75rem 1rem', // py-3 px-4
            background: 'transparent', // Make highlighter background transparent
            fontSize: '0.875rem', // text-sm
            lineHeight: 1.5,
            minHeight: '1.5rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
          wrapLongLines={true}
          codeTagProps={{
            // The syntax theme will control the color of the text itself
            className: 'font-mono',
          }}
        >
          {codeContent || ' '}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

CodeBlock.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  isStreaming: PropTypes.bool,
};

export default CodeBlock;

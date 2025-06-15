// src/sidepanel/components/messaging/CodeBlock.jsx
import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
// --- Static Language Imports ---
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
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import scss from 'react-syntax-highlighter/dist/esm/languages/prism/scss';
import less from 'react-syntax-highlighter/dist/esm/languages/prism/less';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import ini from 'react-syntax-highlighter/dist/esm/languages/prism/ini';
import makefile from 'react-syntax-highlighter/dist/esm/languages/prism/makefile';

import { useUI } from '../../../contexts/UIContext';
import { IconButton } from '../../../components';

import { useCopyToClipboard } from './hooks/useCopyToClipboard';

// --- Language Registration ---
// A clean, maintainable way to register languages and their aliases.
const languagesToRegister = [
  { name: 'javascript', module: javascript, aliases: ['js'] },
  { name: 'jsx', module: jsx },
  { name: 'typescript', module: typescript, aliases: ['ts'] },
  { name: 'tsx', module: tsx },
  { name: 'python', module: python, aliases: ['py'] },
  { name: 'java', module: java },
  { name: 'csharp', module: csharp, aliases: ['cs', 'dotnet'] },
  { name: 'cpp', module: cpp, aliases: ['c++'] },
  { name: 'c', module: c },
  { name: 'go', module: go, aliases: ['golang'] },
  { name: 'ruby', module: ruby, aliases: ['rb'] },
  { name: 'php', module: php },
  { name: 'swift', module: swift },
  { name: 'kotlin', module: kotlin, aliases: ['kt'] },
  { name: 'rust', module: rust, aliases: ['rs'] },
  { name: 'markup', module: markup, aliases: ['html', 'xml'] },
  { name: 'css', module: css },
  { name: 'scss', module: scss },
  { name: 'less', module: less },
  { name: 'json', module: json },
  { name: 'yaml', module: yaml, aliases: ['yml'] },
  { name: 'markdown', module: markdown, aliases: ['md', 'mkd'] },
  { name: 'sql', module: sql },
  { name: 'bash', module: bash, aliases: ['shell', 'sh'] },
  { name: 'diff', module: diff },
  { name: 'ini', module: ini },
  { name: 'makefile', module: makefile },
];

languagesToRegister.forEach(lang => {
  SyntaxHighlighter.registerLanguage(lang.name, lang.module);
  if (lang.aliases) {
    lang.aliases.forEach(alias => SyntaxHighlighter.registerLanguage(alias, lang.module));
  }
});
// --- End Registration ---

const CodeBlock = memo(({ className, children, isStreaming = false }) => {
  const codeContent = String(children).replace(/\n$/, '');
  const { copyState, handleCopy, IconComponent, iconClassName, disabled } =
    useCopyToClipboard(codeContent);
  const { theme } = useUI();

  const languageMatch = /language-(\w+)/.exec(className || '');
  const language = languageMatch ? languageMatch[1].toLowerCase() : 'text';
  const displayLanguage = language.charAt(0).toUpperCase() + language.slice(1);
  const isDarkMode = theme === 'dark';
  const syntaxTheme = isDarkMode ? oneDark : oneLight;

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
    default:
      buttonStateClasses = idleClasses;
  }

  return (
    <div className='relative code-block-group my-4 rounded-lg border border-gray-200 dark:border-gray-700'>
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

      <div className='overflow-x-auto w-full rounded-b-lg bg-white dark:bg-gray-900'>
        <SyntaxHighlighter
          language={language}
          style={syntaxTheme}
          customStyle={{
            margin: 0,
            padding: '0.75rem 1rem',
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: 1.5,
            minHeight: '1.5rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
          wrapLongLines={true}
          codeTagProps={{
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

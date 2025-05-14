// src/components/CodeBlock.jsx
import React, { useState, memo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
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

import { useCopyToClipboard } from './hooks/useCopyToClipboard';

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
const CodeBlock = memo(
  ({ className, children, isStreaming = false }) => {
    const codeContent = String(children).replace(/\n$/, '');
    const { copyState, handleCopy, IconComponent, iconClassName, disabled } =
      useCopyToClipboard(codeContent);
    const [isDarkMode, setIsDarkMode] = useState(
      // Check for window availability for SSR/build environments
      typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
    );

    // Listen for theme changes
    useEffect(() => {
      // Ensure window and matchMedia are available
      if (typeof window === 'undefined' || !window.matchMedia) {
        return;
      }

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => setIsDarkMode(e.matches);

      // Use addEventListener if available, otherwise fallback to addListener
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.addListener) {
        // Fallback for older browsers
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }, []);

    // Extract language from className (format: language-python, language-javascript, etc.)
    const languageMatch = /language-(\w+)/.exec(className || '');
    const language = languageMatch ? languageMatch[1] : 'text'; // Default to 'text' if no language found

    // Format the raw language name - just capitalize first letter
    const displayLanguage =
      language.charAt(0).toUpperCase() + language.slice(1);

    // Define the syntax highlighter theme based on current app theme
    // Use 'vs' for light mode and 'oneDark' for dark mode
    const syntaxTheme = isDarkMode ? oneDark : vs;

    return (
      <div className='relative group rounded-lg overflow-visible border border-gray-200 dark:border-gray-700 my-4 shadow-sm'>
        {/* Minimal header with language display */}
        <div className='relative bg-gray-200 dark:bg-gray-800 px-3 py-1.5 flex justify-between items-center rounded-t-lg'>
          {/* Language name */}
          <span className='text-gray-600 dark:text-gray-400 font-mono text-xs'>
            {displayLanguage}
          </span>

          {/* Copy button - Only show when not streaming */}
          {!isStreaming && (
            <IconButton
              icon={IconComponent}
              iconClassName={`w-3 h-3 select-none ${iconClassName}`}
              onClick={handleCopy}
              disabled={disabled}
              aria-label='Copy code to clipboard'
              title='Copy code to clipboard'
              className={`absolute top-1/2 right-3 -translate-y-1/2 p-1 rounded-md transition-opacity duration-200 z-10 ${copyState === 'idle' ? 'opacity-0 group-hover:opacity-100 focus-within:opacity-100' : 'opacity-100'} ${copyState === 'copied' ? 'bg-green-100 dark:bg-green-900/20' : copyState === 'error' ? 'bg-red-100 dark:bg-red-900/20' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700'}`}
            />
          )}
        </div>

        {/* Code content area with syntax highlighting */}
        <div className='bg-white dark:bg-gray-900 overflow-x-auto w-full rounded-b-lg'>
          <SyntaxHighlighter
            language={language}
            style={syntaxTheme}
            customStyle={{
              margin: 0,
              padding: '0.75rem 1rem', // equivalent to py-3 px-4
              background: 'transparent', // Background is handled by the parent div
              fontSize: '0.875rem', // text-sm
              lineHeight: 1.5, // Increased slightly for better readability
              minHeight: '1.5rem', // Ensure a minimum height even for empty/short code
              whiteSpace: 'pre-wrap', // Ensures wrapping respects whitespace and newlines
              wordBreak: 'break-all', // Helps break long words if wrapLongLines isn't enough
            }}
            wrapLongLines={true}
            codeTagProps={{
              className: 'font-mono text-gray-900 dark:text-gray-200',
            }}
          >
            {codeContent || ' '}{' '}
            {/* Render a space if content is empty to maintain height */}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }
);

CodeBlock.displayName = 'CodeBlock';

CodeBlock.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  isStreaming: PropTypes.bool,
};

export default CodeBlock;

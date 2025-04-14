// src/components/EnhancedCodeBlock.jsx
import React, { useState, memo, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import CopyButtonIcon from './icons/CopyButtonIcon';
import { copyToClipboard } from './utils/clipboard';

/**
 * Enhanced CodeBlock with syntax highlighting and copy functionality.
 * This version allows the code block to grow vertically to fit its content.
 * @param {Object} props - Component props
 * @param {string} props.className - Class containing language information
 * @param {React.ReactNode} props.children - Content to be rendered inside the code block
 * @param {boolean} props.isStreaming - Whether the content is still streaming
 * @returns {JSX.Element} - A formatted code block with syntax highlighting
 */
const EnhancedCodeBlock = memo(({ className, children, isStreaming = false }) => {
  const [copyState, setCopyState] = useState('idle'); // idle, copied, error
  const codeContent = String(children).replace(/\n$/, '');
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
    } else if (mediaQuery.addListener) { // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Extract language from className (format: language-python, language-javascript, etc.)
  const languageMatch = /language-(\w+)/.exec(className || '');
  const language = languageMatch ? languageMatch[1] : 'text'; // Default to 'text' if no language found

  // Format the raw language name - just capitalize first letter
  const displayLanguage = language.charAt(0).toUpperCase() + language.slice(1);

  const copyCodeToClipboard = async () => {
    try {
      await copyToClipboard(codeContent);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (error) {
      console.error('Copy method failed: ', error);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  // Define the syntax highlighter theme based on current app theme
  const syntaxTheme = isDarkMode ? oneDark : oneLight;

  return (
    <div className="relative rounded-lg overflow-visible border border-gray-200 dark:border-gray-700 my-4 shadow-sm">
      {/* Minimal header with language display */}
      <div className="bg-gray-200 dark:bg-gray-800 px-3 py-1.5 flex justify-between items-center rounded-t-lg">
        {/* Language name */}
        <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">{displayLanguage}</span>

        {/* Copy button - Only show when not streaming */}
        {!isStreaming && (
          <button
            onClick={copyCodeToClipboard}
            className={`rounded transition-all duration-200 px-1.5 py-0.5 text-xs
                      ${copyState === 'copied' ? 'text-green-600 dark:text-green-400' :
                        copyState === 'error' ? 'text-red-500 dark:text-red-400' :
                        'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            aria-label="Copy code to clipboard"
            title="Copy code to clipboard"
            disabled={copyState !== 'idle'}
          >
            <CopyButtonIcon state={copyState} />
          </button>
        )}
      </div>

      {/* Code content area with syntax highlighting */}
      <div className="bg-gray-100 dark:bg-gray-900 overflow-x-auto w-full rounded-b-lg">
        <SyntaxHighlighter
          language={language}
          style={syntaxTheme}
          customStyle={{
            margin: 0,
            padding: '0.75rem 1rem', // equivalent to py-3 px-4
            background: 'transparent', // Handled by parent div
            fontSize: '0.875rem', // text-sm
            lineHeight: 1.5, // Increased slightly for better readability
            minHeight: '1.5rem', // Ensure a minimum height even for empty/short code
            whiteSpace: 'pre-wrap', // Ensures wrapping respects whitespace and newlines
            wordBreak: 'break-all', // Helps break long words if wrapLongLines isn't enough
          }}
          wrapLongLines={true} 
          codeTagProps={{ className: 'font-mono text-gray-800 dark:text-gray-200' }}
        >
          {codeContent || ' '} {/* Render a space if content is empty to maintain height */}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});

EnhancedCodeBlock.displayName = 'EnhancedCodeBlock'; // Add display name for easier debugging

export default EnhancedCodeBlock;
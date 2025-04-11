import React, { useState, memo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';  // For LaTeX-style math delimiters
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { InlineMath, BlockMath } from 'react-katex';  // For rendering math with KaTeX
import 'katex/dist/katex.min.css';  // Import KaTeX CSS for styling

/**
 * Reusable Copy Button Icon component
 * Provides consistent SVG icons for different copy states
 */
const CopyButtonIcon = memo(({ state = 'idle' }) => {
  switch (state) {
    case 'copied':
      // Checkmark icon for copied state
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      );
    case 'error':
      // X icon for error state
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      );
    default:
      // Default copy icon
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 352.804 352.804" fill="currentColor" className="w-3 h-3">
          <path d="M318.54,57.282h-47.652V15c0-8.284-6.716-15-15-15H34.264c-8.284,0-15,6.716-15,15v265.522c0,8.284,6.716,15,15,15h47.651v42.281c0,8.284,6.716,15,15,15H318.54c8.284,0,15-6.716,15-15V72.282C333.54,63.998,326.824,57.282,318.54,57.282z M49.264,265.522V30h191.623v27.282H96.916c-8.284,0-15,6.716-15,15v193.24H49.264z M303.54,322.804H111.916V87.282H303.54V322.804z"/>
        </svg>
      );
  }
});

/**
 * Utility function for clipboard operations
 * Implements the document.execCommand approach for maximum compatibility
 * @param {string} text - The text content to copy to clipboard
 * @returns {boolean} - Returns true if successful, throws error otherwise
 */
const copyToClipboardUtil = (text) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  
  try {
    textarea.select();
    const successful = document.execCommand('copy');
    
    if (!successful) {
      throw new Error('ExecCommand operation failed');
    }
    
    return true;
  } finally {
    // Ensure cleanup happens regardless of success/failure
    document.body.removeChild(textarea);
  }
};

/**
 * Detects LaTeX environments like \begin{cases}, \begin{align}, etc.
 * @param {string} content - The text content to check
 * @returns {boolean} - Returns true if content contains LaTeX environments
 */
const hasLatexEnvironments = (content) => {
  // Full list of common LaTeX environments to detect
  const environments = [
    'cases', 'equation', 'align', 'gather', 'matrix', 'pmatrix', 
    'bmatrix', 'vmatrix', 'Bmatrix', 'array', 'eqnarray', 
    'multline', 'split', 'subequations', 'aligned', 'gathered',
    'smallmatrix', 'flalign'
  ];
  
  // Create regex pattern to match any of these environments
  const pattern = new RegExp(`\\\\begin\\{(${environments.join('|')})\\}`, 'i');
  
  return pattern.test(content);
};

/**
 * Detects LaTeX commands like \cdot, \frac{}{}, etc. that indicate math content
 * @param {string} content - The text content to check
 * @returns {boolean} - Returns true if content contains LaTeX commands
 */
const hasLatexCommands = (content) => {
  // Common LaTeX commands that indicate math content
  const commands = [
    '\\\\cdot', '\\\\frac', '\\\\sqrt', '\\\\sum', '\\\\int', 
    '\\\\prod', '\\\\infty', '\\\\partial', '\\\\nabla', 
    '\\\\overrightarrow', '\\\\dot', '\\\\vec', '\\\\hat',
    '\\\\mathbb', '\\\\mathcal', '\\\\mathfrak', '\\\\mathscr',
    '\\\\mathrm', '\\\\alpha', '\\\\beta', '\\\\gamma', '\\\\delta',
    '\\\\epsilon', '\\\\varepsilon', '\\\\zeta', '\\\\eta', '\\\\theta',
    '\\\\iota', '\\\\kappa', '\\\\lambda', '\\\\mu', '\\\\nu', '\\\\xi',
    '\\\\pi', '\\\\rho', '\\\\sigma', '\\\\tau', '\\\\upsilon', '\\\\phi',
    '\\\\chi', '\\\\psi', '\\\\omega', '\\\\Gamma', '\\\\Delta', '\\\\Theta',
    '\\\\Lambda', '\\\\Xi', '\\\\Pi', '\\\\Sigma', '\\\\Phi', '\\\\Psi', '\\\\Omega'
  ];
  
  // Look for any LaTeX command indicators
  return commands.some(cmd => new RegExp(cmd).test(content));
};

/**
 * Helper function to detect LaTeX-style math delimiters
 * @param {string} content - The text content to check
 * @returns {boolean} - Returns true if content contains LaTeX-style math delimiters
 */
const hasLatexDelimiters = (content) => {
  // Check for inline math: $...$, \(...\)
  const hasInlineMath = /\$.+?\$/s.test(content) || /\\\(.+?\\\)/s.test(content);
  
  // Check for block math: $$...$$, \[...\]
  const hasBlockMath = /\$\$.+?\$\$/s.test(content) || /\\\[.+?\\\]/s.test(content);
  
  return hasInlineMath || hasBlockMath;
};

/**
 * Comprehensive utility function to determine if content is a mathematical formula
 * Covers notation from various mathematical domains
 */
const isMathFormula = (content) => {
  // First, check for LaTeX environments like \begin{cases} - highest priority
  if (hasLatexEnvironments(content)) {
    return true;
  }
  
  // Then check for LaTeX commands like \cdot, \frac, etc.
  if (hasLatexCommands(content)) {
    return true;
  }
  
  // Skip check for explicit code blocks or multiline content with programming features
  if ((content.includes('\n') && 
       (content.includes('if (') || content.includes('for (') || 
        content.includes('function(') || content.includes('import ') || 
        content.includes('class ') || content.includes('const ') ||
        content.includes('return ') || content.includes('console.log'))) ||
      content.includes('===') || content.includes('!==')) {
    return false;
  }
  
  // The rest of the existing isMathFormula logic
  // BASIC ARITHMETIC & ALGEBRA
  // ---------------------------
  // Variable assignments and equations
  return ((/^[a-zA-Z][a-zA-Z\d]*\s*=\s*[^;{}]*[\+\-\*\/\[\]\(\)∑∫^]/.test(content)) ||
    // Equations with multiple variables (ax + by = c)
    (/\b[a-z]\s*[a-z]\s*[\+\-]\s*[a-z]\s*[a-z]\s*=\s*[a-z]/.test(content)) ||
    // Inequalities
    (/[a-zA-Z\d\)]\s*[<>≤≥≠]\s*[a-zA-Z\d\(]/.test(content)) ||
    // Basic arithmetic with variables (a + b = c)
    (/^[a-z]\s*[\+\-\*\/÷]\s*[a-z]\s*=\s*[a-z]/.test(content)) ||
    // Absolute values |x|
    (/\|[a-zA-Z0-9\+\-\*\/\(\)]+\|/.test(content)) ||
    // Factorial notation
    (/[a-zA-Z0-9\)!]\s*!/.test(content)) ||
    // Floor and ceiling functions
    (/⌊.*⌋/.test(content) || /⌈.*⌉/.test(content)) ||
    
    // NUMBER THEORY
    // -------------
    // Modular arithmetic
    (/≡\s*\([mod|mod]\s*[a-zA-Z0-9]+\)/.test(content) || /\bmod\s+\d+/.test(content)) ||
    // GCD/LCM notation
    (/\bgcd\s*\(/.test(content) || /\blcm\s*\(/.test(content)) ||
    // Divisibility
    (/[a-zA-Z0-9]\s*\|\s*[a-zA-Z0-9]/.test(content)) ||
    
    // SEQUENCES & SERIES
    // -----------------
    // Summation notation
    (/\b∑\s*[\_\^]/.test(content) || /\bsum\s*[\_\^]/.test(content)) ||
    // Product notation
    (/\b∏\s*[\_\^]/.test(content) || /\bprod\s*[\_\^]/.test(content)) ||
    // Limits of sequences
    (/\blim\s*[\_\^]/.test(content) || /\blim\s*\_\{[^\}]*\}/.test(content)) ||
    // Indexed variables (a_n, x_i)
    (/\b[a-zA-Z]\_[a-zA-Z0-9]/.test(content)) ||
    // Recurrence relations
    (/[a-zA-Z]\_\{[^\}]*\}\s*=\s*[a-zA-Z]\_\{[^\}]*\}/.test(content)) ||
    // Big-O notation
    (/\bO\s*\(/.test(content) || /\bΘ\s*\(/.test(content) || /\bΩ\s*\(/.test(content)) ||
    // Common sequence notations
    (/^(Sn|an|xn|yn|fn|S_n|a_n|x_n|y_n|f_n)/.test(content)) ||
    
    // CALCULUS
    // --------
    // Derivatives
    (/\b(d\/dx|d\/dy|d\/dt|d[2-9]\/dx[2-9]|∂\/∂x|∂\/∂y|∂\/∂t|∂[2-9]\/∂x[2-9])/.test(content)) ||
    (/\bf\'|\bf\'\'|\bf\^[\(\{\[]n[\)\}\]]/.test(content)) ||
    // Integrals
    (/[∫∬∭]\s*[\(\{\[]/.test(content) || /\bint\s*[\(\{\[]/.test(content)) ||
    (/[∫∬∭]\_\{[^\}]*\}\^/.test(content)) ||
    // Contour integrals
    (/\b∮\s*[\_\^]/.test(content) || /\boint\s*[\_\^]/.test(content)) ||
    // Vector calculus operators
    (/\b∇\s*[\·\×\^]|\b∇\s*[^a-zA-Z]|\bdiv\s*\(|\bcurl\s*\(|\bgrad\s*\(/.test(content)) ||
    // Limits in calculus
    (/\blim\_\{[a-zA-Z]\s*→\s*[^\}]+\}/.test(content)) ||
    
    // LINEAR ALGEBRA
    // -------------
    // Matrix notation
    (/\b[A-Z]\s*\[\s*[a-zA-Z0-9],[a-zA-Z0-9]\s*\]/.test(content)) ||
    // Matrix operations
    (/\bdet\s*\(|\btr\s*\(/.test(content)) ||
    (/[A-Z]\s*^{-1}|[A-Z]\s*^{T}|[A-Z]\s*^{*}/.test(content)) ||
    // Vector notation
    (/\bvec\{[a-zA-Z]\}|\bhat\{[a-zA-Z]\}/.test(content)) ||
    // Eigenvalue equation
    (/[A-Z][a-zA-Z0-9]*\s*=\s*λ\s*[a-zA-Z]/.test(content)) ||
    // Inner products
    (/\langle[^\rangle]*\rangle|\⟨[^\⟩]*\⟩/.test(content)) ||
    (/[a-zA-Z]\s*\·\s*[a-zA-Z]/.test(content)) ||
    
    // SET THEORY & LOGIC
    // -----------------
    // Set operations
    (/[A-Z]\s*[∪∩\\\⊕]\s*[A-Z]/.test(content)) ||
    (/\b[A-Z]\s*^c\b/.test(content)) ||
    // Set membership
    (/[a-zA-Z0-9]\s*[∈∉]\s*[A-Z]/.test(content)) ||
    // Set relations
    (/[A-Z]\s*[⊂⊃⊆⊇=]\s*[A-Z]/.test(content)) ||
    // Logical operations
    (/[a-zA-Z]\s*[∧∨¬→↔]\s*[a-zA-Z]/.test(content)) ||
    // Quantifiers
    (/[∀∃]\s*[a-zA-Z]\s*[:\(\[]/.test(content)) ||
    
    // PROBABILITY & STATISTICS
    // -----------------------
    // Probability notation
    (/\bP\s*\(\s*[A-Z][^\)]*\)/.test(content)) ||
    (/\bP\s*\(\s*[A-Z]\s*\|\s*[A-Z]\s*\)/.test(content)) ||
    // Random variables
    (/\b[X-Z]\s*∼\s*[A-Z]\s*\(/.test(content)) ||
    (/\bE\s*\[|\bVar\s*\(|\bCov\s*\(/.test(content)) ||
    // Probability distributions
    (/\bf\_[A-Za-z]\s*\(|\bF\_[A-Za-z]\s*\(|\bΦ\s*\(/.test(content)) ||
    // Statistical measures
    (/\bar{[a-zA-Z]}|[a-zA-Z]\s*^2|r\_{[a-zA-Z][a-zA-Z]}|\bχ\s*^2/.test(content)) ||
    // Binomial coefficients
    (/\bC\s*\(\s*n\s*,\s*k\s*\)|\bP\s*\(\s*n\s*,\s*r\s*\)|\bC\_\{n\}\^\{k\}/.test(content)) ||
    
    // GEOMETRY & TRIGONOMETRY
    // ----------------------
    // Trigonometric functions
    (/\b(sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan)\s*\(/.test(content)) ||
    // Angles
    (/\b[∠]\s*[A-Z]{3}|\bθ\s*=\s*\d+[°]/.test(content)) ||
    // Triangles
    (/\b[△]\s*[A-Z]{3}/.test(content)) ||
    // Geometric vectors
    (/\|\|\s*\vec\{[a-zA-Z]\}\s*\|\|/.test(content)) ||
    // Trigonometric identities
    (/\bsin\s*^2\s*θ\s*\+\s*cos\s*^2\s*θ/.test(content)) ||
    
    // COMPLEX ANALYSIS
    // ---------------
    // Complex numbers
    (/\b[a-zA-Z]\s*=\s*[^;]*\s*\+\s*[^;]*i\b/.test(content)) ||
    (/\b\|z\||\barg\s*z/.test(content)) ||
    // Complex functions
    (/\bf\s*\(\s*z\s*\)\s*=\s*[^;]*\s*\+\s*[^;]*i\b/.test(content)) ||
    // Complex exponentials
    (/\be\s*\^\s*\{\s*i\s*θ\s*\}/.test(content)) ||
    (/\bz\s*\^\s*n/.test(content)) ||
    // Special case for specific formulas from the examples
    (/e\^(\(.*θ.*\)|.*θ.*)/.test(content)) ||
    
    // DIFFERENTIAL EQUATIONS
    // ---------------------
    // Differential equations
    (/\bdy\/dx\s*[\+\-=]/.test(content)) ||
    (/\b[a-zA-Z]\s*\'\s*[\+\-=]|\b[a-zA-Z]\s*\'\'\s*[\+\-=]/.test(content)) ||
    (/\b\dot\{[a-zA-Z]\}\s*=/.test(content)) ||
    // Boundary conditions
    (/\b[a-zA-Z]\s*\(\s*[0aL]\s*\)\s*=/.test(content)) ||
    
    // COMMON MATHEMATICAL FUNCTIONS
    // ----------------------------
    (/\b(log|ln|exp|sqrt|abs|max|min|lim|sup|inf)\s*\(/.test(content)) ||
    
    // NUMBER SYSTEMS & SPECIAL FUNCTIONS
    // ---------------------------------
    // Number sets
    (/\b[ℕℤℚℝℂ]/.test(content)) ||
    // Special constants
    (/\b[πγφ]\b/.test(content)) ||
    // Special functions
    (/\bΓ\s*\(|\bζ\s*\(|\bJ\_n\s*\(|\berf\s*\(/.test(content)) ||
    
    // MATHEMATICAL OPERATORS & SYMBOLS
    // ------------------------------
    // Greek letters
    (/[α-ωΑ-Ω]/.test(content)) ||
    (/\b(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)\b/.test(content)) ||
    // Mathematical operators
    (/[±√∫∑∏∞∂∇≈≠≤≥⊂⊃⊆⊇⊥∠∧∨∩∪]/.test(content)) ||
    // Subscripts and superscripts
    (/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ₀₁₂₃₄₅₆₇₈₉]/.test(content)) ||
    // Exponents with ^ notation
    (/\b[a-zA-Z0-9]\s*\^\s*[a-zA-Z0-9\(\)\-\+]/.test(content)) ||
    
    // FRACTIONS & EXPRESSIONS
    // ----------------------
    // Fractions and expressions with parentheses and brackets
    ((/\/\(/.test(content) && /\)/.test(content)) ||
    (/\[/.test(content) && /\]/.test(content) && /=/.test(content))) ||
    
    // INFORMATION THEORY
    // -----------------
    // Entropy & information theory notation
    (/\bH\s*\(\s*[A-Z]\s*\)|\bH\s*\(\s*[A-Z]\s*\|\s*[A-Z]\s*\)/.test(content)) ||
    (/\bI\s*\(\s*[A-Z]\s*;\s*[A-Z]\s*\)/.test(content)) ||
    (/\bD\_\{KL\}\s*\(/.test(content)) ||
    
    // GRAPH THEORY
    // -----------
    // Graph notation
    (/\bG\s*=\s*\(\s*V\s*,\s*E\s*\)|\bK\_n|\bC\_n/.test(content)) ||
    // Graph parameters
    (/\bdeg\s*\(|\bδ\s*\(|\bΔ\s*\(|\bχ\s*\(|\bω\s*\(|\bα\s*\(/.test(content)) ||
    
    // PHYSICS NOTATION
    // ---------------
    // Common physics equations
    (/\bF\s*=\s*m\s*a|\bE\s*=\s*m\s*c\s*\^2/.test(content)) ||
    (/\b[Δ]\s*G\s*=\s*[Δ]\s*H\s*\-\s*T\s*[Δ]\s*S/.test(content)) ||
    
    // SPECIAL CASES FOR COMMON FORMULAS
    // --------------------------------
    // Specific formula patterns from examples
    (content.includes("cos(A - B)") ||
    content.includes("d/dx [x^n]") ||
    content.includes("P(A|B)") ||
    content.includes("P(X = k)") ||
    content.includes("C[i,j]") ||
    content.includes("e^(iθ)") ||
    content.includes("dy/dx + P(x)y") ||
    content.includes("(a + bi) + (c + di)")));
};

/**
 * Pre-processes math content to ensure proper LaTeX formatting
 * @param {string} content - The math content to process
 * @param {boolean} inline - Whether this is inline math
 * @returns {string} - Processed content ready for KaTeX
 */
const preprocessMathContent = (content, inline = false) => {
  // Don't add delimiters if they already exist
  if (hasLatexDelimiters(content)) {
    // Strip existing delimiters to avoid duplicates
    if (content.startsWith('$') && content.endsWith('$')) {
      content = content.slice(1, -1);
    } else if (content.startsWith('$$') && content.endsWith('$$')) {
      content = content.slice(2, -2);
    } else if (content.startsWith('\\(') && content.endsWith('\\)')) {
      content = content.slice(2, -2);
    } else if (content.startsWith('\\[') && content.endsWith('\\]')) {
      content = content.slice(2, -2);
    }
  }

  // Ensure LaTeX environments don't have extra delimiters
  if (hasLatexEnvironments(content)) {
    // For multiline content, add proper spacing around backslashes
    content = content.replace(/\\\\(?!\]|\)|\})/g, '\\\\ ');
    
    // Remove any existing math delimiters
    if (content.startsWith('$') || content.startsWith('\\(')) {
      content = content.replace(/^\$|\\\(/g, '').replace(/\$|\\\)$/g, '');
    } else if (content.startsWith('$$') || content.startsWith('\\[')) {
      content = content.replace(/^\$\$|\\\[/g, '').replace(/\$\$|\\\]$/g, '');
    }
    
    return content; // Return without adding delimiters to let KaTeX handle the environment
  }
  
  // Process line breaks in math mode
  content = content.replace(/\\\\$/mg, '\\\\');
  
  // Replace common special character sequences
  content = content.replace(/\\cdot/g, '\\cdot ');
  content = content.replace(/\_\{([^}]+)\}/g, '_{$1}');
  
  return content;
};

/**
 * Enhanced CodeBlock with syntax highlighting
 */
const EnhancedCodeBlock = memo(({ className, children, isStreaming = false }) => {
  const [copyState, setCopyState] = useState('idle'); // idle, copied, error
  const codeContent = String(children).replace(/\n$/, '');
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  
  // Listen for theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setIsDarkMode(e.matches);
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);
  
  // Extract language from className (format: language-python, language-javascript, etc.)
  const languageMatch = /language-(\w+)/.exec(className || '');
  const language = languageMatch ? languageMatch[1] : 'text';
  
  // Check if this is just a filename (single line, no spaces, has extension)
  const isFilenameOrModule = codeContent.trim().indexOf('\n') === -1 && 
                          codeContent.trim().indexOf(' ') === -1 && 
                          (
                            // Traditional file extensions
                            /\.\w{1,4}$/.test(codeContent.trim()) ||
                            // Module.function patterns (like numpy.polyfit)
                            /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(codeContent.trim())
                          );
  
  // Format the raw language name - just capitalize first letter
  const displayLanguage = language.charAt(0).toUpperCase() + language.slice(1);
  
  const copyCodeToClipboard = () => {
    try {
      copyToClipboardUtil(codeContent);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (error) {
      console.error('Copy method failed: ', error);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };
  
  // For filenames or module references, render a simpler component
  if (isFilenameOrModule) {
    return (
      <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono inline-block">
        {codeContent}
      </code>
    );
  }
  
  // Define the syntax highlighter theme based on current app theme
  const syntaxTheme = isDarkMode ? oneDark : oneLight;
  
  return (
    <div className="relative rounded-lg overflow-visible border border-gray-200 dark:border-gray-700 mb-4 shadow-sm">
      {/* Minimal header with language display */}
      <div className="bg-gray-200 dark:bg-gray-800 px-3 py-1.5 flex justify-between items-center">
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
          >
            <CopyButtonIcon state={copyState} />
          </button>
        )}
      </div>
      
      {/* Code content area with syntax highlighting */}
      <div className="bg-gray-50 dark:bg-gray-900 overflow-x-auto overflow-y-auto max-h-[50vh] w-full">
        <SyntaxHighlighter
          language={language}
          style={syntaxTheme}
          customStyle={{
            margin: 0,
            padding: '0.5rem 1rem',
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: 1.25,
            minHeight: '1.5rem'
          }}
          wrapLongLines={true}
          codeTagProps={{
            className: 'font-mono text-gray-800 dark:text-gray-200'
          }}
        >
          {codeContent}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});

/**
 * Enhanced math formula block component
 * Safely renders math expressions with error handling
 */
const MathFormulaBlock = memo(({ content, inline = false }) => {
  // Use state to track if rendering fails
  const [renderError, setRenderError] = useState(false);
  
  // Enhanced processing for math content
  const processedContent = preprocessMathContent(content, inline);
  
  // Safely render math with error boundary
  const renderMathSafely = () => {
    try {
      return inline ? 
        <InlineMath math={processedContent} /> : 
        <BlockMath math={processedContent} />;
    } catch (error) {
      console.error('Math rendering error:', error);
      setRenderError(true);
      return (
        <code className="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 px-2 py-1 rounded font-mono text-xs">
          {content} (Error: Invalid math syntax)
        </code>
      );
    }
  };
  
  // If there was an error, show original content with error styling
  if (renderError) {
    return (
      <div className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded my-3 font-mono text-sm whitespace-pre-wrap">
        <div className="mb-2 text-xs text-red-500">Unable to render formula - showing LaTeX source:</div>
        {content}
      </div>
    );
  }
  
  // Normal rendering with appropriate KaTeX component
  return inline ? (
    <span className="inline-flex items-center">
      {renderMathSafely()}
    </span>
  ) : (
    <div className="flex justify-center my-4 overflow-x-auto max-w-full">
      {renderMathSafely()}
    </div>
  );
});

/**
 * A versatile message bubble component that supports different roles and states
 * with copy-to-clipboard functionality for assistant messages
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
      copyToClipboardUtil(content);
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
              
              // Check for LaTeX environments directly (highest priority)
              if (hasLatexEnvironments(content)) {
                return <MathFormulaBlock content={content} />;
              }
              
              // Check for LaTeX commands that indicate math content
              if (hasLatexCommands(content)) {
                return <MathFormulaBlock content={content} />;
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
              
              // First, determine if this is explicitly marked as a language code block
              const isExplicitCodeBlock = match && match[1] && match[1].toLowerCase() !== 'text';
              
              // Check if this is a standard math formula - Priority #2
              if (!inline && isMathFormula(content)) {
                // Use KaTeX to render the formula
                return <MathFormulaBlock content={content} />;
              }
              
              // For code blocks (with explicit language or multiline) - Priority #3
              if (!inline && (isExplicitCodeBlock || content.includes('\n') || content.includes(';'))) {
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
              
              // For inline math formulas - Priority #4
              if (inline && isMathFormula(content)) {
                // Use KaTeX to render the formula
                return <MathFormulaBlock content={content} inline={true} />;
              }
              
              // Default: Regular inline code - Priority #5
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

export const MessageBubble = memo(MessageBubbleComponent);
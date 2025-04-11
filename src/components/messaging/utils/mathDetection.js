/**
 * Detects LaTeX environments like \begin{cases}, \begin{align}, etc.
 */
export const hasLatexEnvironments = (content) => {
  const environments = [
    'cases', 'equation', 'align', 'gather', 'matrix', 'pmatrix', 
    'bmatrix', 'vmatrix', 'Bmatrix', 'array', 'eqnarray', 
    'multline', 'split', 'subequations', 'aligned', 'gathered',
    'smallmatrix', 'flalign'
  ];
  
  const pattern = new RegExp(`\\\\begin\\{(${environments.join('|')})\\}`, 'i');
  return pattern.test(content);
};

/**
 * Detects LaTeX commands that indicate math content
 */
export const hasLatexCommands = (content) => {
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
    '\\\\Lambda', '\\\\Xi', '\\\\Pi', '\\\\Sigma', '\\\\Phi', '\\\\Psi', '\\\\Omega',
    '\\\\binom', '\\\\choose' // Binomial notation commands
  ];
  
  return commands.some(cmd => new RegExp(cmd).test(content));
};

/**
 * Detects LaTeX-style math delimiters
 */
export const hasLatexDelimiters = (content) => {
  const hasInlineMath = /\$.+?\$/s.test(content) || /\\\(.+?\\\)/s.test(content);
  const hasBlockMath = /\$\$.+?\$\$/s.test(content) || /\\\[.+?\\\]/s.test(content);
  return hasInlineMath || hasBlockMath;
};

/**
 * Enhanced detection for binomial coefficients
 */
export const isBinomialCoefficient = (content) => {
  content = content.trim();
  
  const binomialPatterns = [
    // English notation
    /\(\s*[a-zA-Z0-9]+\s+choose\s+[a-zA-Z0-9]+\s*\)/,
    
    // Mathematical notation (C(n,k))
    /C\s*\(\s*[a-zA-Z0-9]+\s*,\s*[a-zA-Z0-9]+\s*\)/,
    
    // Binomial coefficient LaTeX-style
    /\\binom\s*\{\s*[a-zA-Z0-9]+\s*\}\s*\{\s*[a-zA-Z0-9]+\s*\}/,
    
    // Compact notation
    /\(\\binom\{[a-zA-Z0-9]+\}\{[a-zA-Z0-9]+\}\)/,
    
    // Parenthesized form with standard spacing
    /\(\s*n\s*choose\s*k\s*\)/,
    
    // Traditional nCk notation
    /\b[a-zA-Z0-9]+C[a-zA-Z0-9]+\b/,
    
    // Traditional notation with subscripts
    /\bC_\{[a-zA-Z0-9]+\}\^[a-zA-Z0-9]+/
  ];

  return binomialPatterns.some(pattern => pattern.test(content));
};

/**
 * Mathematical function detection, specialized for common notations
 * that are incorrectly classified as code
 */
export const isMathematicalFunction = (content) => {
  content = content.trim();
  
  // Common mathematical functions with arguments
  const mathFunctionPatterns = [
    // Standard function notation with single variable
    /^[a-zA-Z]\([a-zA-Z]\)$/,
    
    // Function with expression arguments
    /^[a-zA-Z]\([\w\s\+\-\*\/\,\.]+\)$/,
    
    // Multiple functions separated by commas
    /^[a-zA-Z]\([a-zA-Z]\)([\s\,]+[a-zA-Z]\([a-zA-Z]\))+$/,
    
    // Complex analysis notation
    /^Res\s*\([a-zA-Z]\s*,\s*[a-zA-Zα-ω₀₁₂₃₄₅₆₇₈₉]+\)$/,
    
    // Exponential expressions
    /^e\^[\(\-\{][a-zA-Z0-9\*\+\-\/\s]+[\)\}]$/,
    
    // Trigonometric and hyperbolic functions
    /^(sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|coth)\s*\([a-zA-Z0-9\+\-\*\/\s\,\.]+\)$/,
    
    // Function ratios or operations
    /^[a-zA-Z\(\)]+\s*[\+\-\*\/]\s*[a-zA-Z\(\)]+$/,
    
    // Modular arithmetic
    /^[a-zA-Z0-9]+\s*≡\s*[a-zA-Z0-9]+\s*\(\s*mod\s*[a-zA-Z0-9]+\s*\)$/
  ];

  return mathFunctionPatterns.some(pattern => pattern.test(content));
};

/**
 * Checks for unambiguous math signals suitable for overriding a "code/text" context suggestion.
 * @param {string} content - The text content to analyze.
 * @returns {boolean} - True if high-confidence math indicators are found.
 */
export const hasHighConfidenceMathIndicators = (content) => {
  // Specific LaTeX commands strongly indicative of math
  const strongLatexCommands = [
    '\\frac', '\\sqrt', '\\sum', '\\int', '\\lim', '\\binom',
    '\\mathbb', '\\mathcal', '\\mathbf', '\\mathrm'
    // Note: \vec, \hat, \dot are common but can sometimes appear in text/code comments
  ];
  if (strongLatexCommands.some(cmd => content.includes(cmd))) {
    return true;
  }

  // Presence of Greek letters (using common LaTeX commands)
  const greekLetters = [
    '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\zeta', '\\eta', '\\theta',
    '\\iota', '\\kappa', '\\lambda', '\\mu', '\\nu', '\\xi', '\\pi', '\\rho',
    '\\sigma', '\\tau', '\\upsilon', '\\phi', '\\chi', '\\psi', '\\omega'
    // Uppercase Greek letters are less common as standalone indicators
  ];
  if (greekLetters.some(letter => content.includes(letter))) {
    return true;
  }
  // Check for common Unicode Greek letters as well
  if (/[α-ωΑ-Ω]/.test(content)) {
      // Exclude common English words that contain Greek letters like 'omega'
      if (!/\b(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)\b/i.test(content)) {
          return true;
      }
  }


  // Explicit subscript/superscript syntax
  if (/(_|\^)\{[^}]+\}/.test(content)) {
    return true;
  }
  // Match _ or ^ followed by a single digit or specific math chars, but not a plain letter immediately after _
  if (/\^([0-9+\-*/\(\)]|[a-zA-Z]\{)/.test(content) || /_([0-9+\-*/\(\)]|[a-zA-Z]\{)/.test(content)) {
     // Avoid matching things like variable_name
     if (!/_[a-zA-Z]/.test(content) || /_\{\w+\}/.test(content)) {
        return true;
     }
  }


  // Unique mathematical symbols (Unicode)
  const uniqueMathSymbols = /[∑∫∈∀∃≠≤≥⊂⊃∩∪∂∇∞≡]/;
  if (uniqueMathSymbols.test(content)) {
    return true;
  }

  return false;
};

// src/components/messaging/utils/mathDetection.js
import { looksLikeCode } from './codeDetection';

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
 * Math variable detection with code protection.
 * @deprecated This function can be ambiguous. Prefer context-driven detection and `hasHighConfidenceMathIndicators`.
 */
export const isMathVariable = (content) => {
  // Note: This function's role is likely reduced due to the new context-driven approach.
  content = content.trim();

  if (looksLikeCode(content)) {
    return false;
  }
  
  return (
    (/^[a-zA-Z]$/.test(content) && 'ijkmnpqrstxyzαβγδθλμπσφω'.includes(content.toLowerCase())) ||
    /^[a-zA-Z]_[a-zA-Z0-9]$/.test(content) ||
    /^[a-zA-Z]_\{[a-zA-Z0-9]+\}$/.test(content) ||
    /^[a-zA-Z]\^[a-zA-Z0-9]$/.test(content) ||
    /^[a-zA-Z]\^\{[a-zA-Z0-9\+\-]+\}$/.test(content)
  );
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
 * Comprehensive mathematical formula detection.
 * @deprecated Much of this complexity might be unnecessary with the new context-driven approach and `hasHighConfidenceMathIndicators`.
 */
export const isMathFormula = (content) => {
  // Note: This function's role is significantly reduced. The primary logic now relies on
  // ContentContextManager and the more specific helper functions.
  content = content.trim();

  // Early exclusion of obvious code
  if (looksLikeCode(content)) {
    return false;
  }
  
  // Check binomial coefficients and mathematical functions first
  if (isBinomialCoefficient(content) || isMathematicalFunction(content)) {
    return true;
  }
  
  // For multiline content, it's likely code rather than math
  if (content.includes('\n') && content.length > 50 && 
      !hasLatexEnvironments(content) && !hasLatexCommands(content)) {
    return false;
  }
  
  // Quick check for common mathematical variables
  if (/^[a-zA-Z]$/.test(content) && 'ijkmnpqrstxyzαβγδθλμπσφω'.includes(content.toLowerCase())) {
    return true;
  }
  
  // Check for LaTeX subscript and superscript notation
  if (/\_\{[^}]+\}/.test(content) || /\_[0-9a-zA-Z]/.test(content) || 
      /\^[0-9a-zA-Z]/.test(content) || /\^\{[^}]+\}/.test(content)) {
    return true;
  }
  
  // Skip explicit code blocks or multiline programming features
  if ((content.includes('\n') && 
       (content.includes('if (') || content.includes('for (') || 
        content.includes('function(') || content.includes('import ') || 
        content.includes('class ') || content.includes('const ') ||
        content.includes('return ') || content.includes('console.log'))) ||
      content.includes('===') || content.includes('!==') ||
      content.startsWith('function ') || content.startsWith('const ') || 
      content.startsWith('let ') || content.startsWith('var ')) {
    return false;
  }
  
  // MATHEMATICAL DOMAIN PATTERNS
  return (
    // ARITHMETIC & ALGEBRA
    /^[a-zA-Z][a-zA-Z\d]*\s*=\s*[^;{}]*[\+\-\*\/\[\]\(\)∑∫^]/.test(content) ||
    /\b[a-z]\s*[a-z]\s*[\+\-]\s*[a-z]\s*[a-z]\s*=\s*[a-z]/.test(content) ||
    /[a-zA-Z\d\)]\s*[<>≤≥≠]\s*[a-zA-Z\d\(]/.test(content) ||
    /^[a-z]\s*[\+\-\*\/÷]\s*[a-z]\s*=\s*[a-z]/.test(content) ||
    /\|[a-zA-Z0-9\+\-\*\/\(\)]+\|/.test(content) ||
    /[a-zA-Z0-9\)!]\s*!/.test(content) ||
    
    // NUMBER THEORY
    /≡\s*\([mod|mod]\s*[a-zA-Z0-9]+\)/.test(content) ||
    /\bgcd\s*\(/.test(content) ||
    
    // SEQUENCES & SERIES
    /\b∑\s*[\_\^]/.test(content) ||
    /\b∏\s*[\_\^]/.test(content) ||
    /\blim\s*[\_\^]/.test(content) ||
    
    // CALCULUS
    /\b(d\/dx|d\/dy|d\/dt|∂\/∂x|∂\/∂y|∂\/∂t)/.test(content) ||
    /\bf\'|\bf\'\'/.test(content) ||
    /[∫∬∭]\s*[\(\{\[]/.test(content) ||
    
    // SYMBOLS & OPERATORS
    /[α-ωΑ-Ω]/.test(content) ||
    /[±√∫∑∏∞∂∇≈≠≤≥⊂⊃⊆⊇⊥∠∧∨∩∪]/.test(content) ||
    /\b[a-zA-Z0-9]\s*\^\s*[a-zA-Z0-9\(\)\-\+]/.test(content)
  );
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


  // Explicit subscript/superscript syntax (avoiding markdown emphasis)
  // Need to be careful with _ followed by word characters (markdown italic)
  // Match _{...} or ^^{...}
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
  const uniqueMathSymbols = /[∑∫∈∀∃≠≤≥⊂⊃∩∪∂∇∞≡]/; // Added ≡
  if (uniqueMathSymbols.test(content)) {
    return true;
  }

  return false;
};

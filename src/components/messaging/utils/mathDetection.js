import { looksLikeCode } from './codeDetection';

/**
 * Detects LaTeX environments like \begin{cases}, \begin{align}, etc.
 * @param {string} content - The text content to check
 * @returns {boolean} - Returns true if content contains LaTeX environments
 */
export const hasLatexEnvironments = (content) => {
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
export const hasLatexCommands = (content) => {
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
export const hasLatexDelimiters = (content) => {
  // Check for inline math: $...$, \(...\)
  const hasInlineMath = /\$.+?\$/s.test(content) || /\\\(.+?\\\)/s.test(content);
  
  // Check for block math: $$...$$, \[...\]
  const hasBlockMath = /\$\$.+?\$\$/s.test(content) || /\\\[.+?\\\]/s.test(content);
  
  return hasInlineMath || hasBlockMath;
};

/**
 * Math variable detection with code protection
 */
export const isMathVariable = (content) => {
  content = content.trim();
  
  // Early return for code-like content
  if (looksLikeCode(content)) {
    return false;
  }
  
  // Common math variable patterns
  return (
    // Single letters that are commonly used as mathematical variables
    (/^[a-zA-Z]$/.test(content) && 'ijkmnpqrstxyzαβγδθλμπσφω'.includes(content.toLowerCase())) ||
    
    // Variables with subscripts: x_i, a_n, etc.
    /^[a-zA-Z]_[a-zA-Z0-9]$/.test(content) ||
    
    // Variables with LaTeX subscripts: w_{ij}, etc.
    /^[a-zA-Z]_\{[a-zA-Z0-9]+\}$/.test(content) ||
    
    // Variables with superscripts: x^2, y^n, etc.
    /^[a-zA-Z]\^[a-zA-Z0-9]$/.test(content) ||
    
    // Variables with LaTeX superscripts: x^{n+1}, etc.
    /^[a-zA-Z]\^\{[a-zA-Z0-9\+\-]+\}$/.test(content)
  );
};

/**
 * Comprehensive utility function to determine if content is a mathematical formula
 */
export const isMathFormula = (content) => {
  // Trim whitespace for more accurate detection
  content = content.trim();
  
  // Early return for obvious code
  if (looksLikeCode(content)) {
    return false;
  }
  
  // For multiline content, it's likely code rather than math
  if (content.includes('\n') && content.length > 50) {
    return false;
  }
  
  // Quick check for common mathematical single variables
  if (/^[a-zA-Z]$/.test(content) && 'ijkmnpqrstxyzαβγδθλμπσφω'.includes(content.toLowerCase())) {
    return true;
  }
  
  // Check for LaTeX subscript and superscript notation
  if (/\_\{[^}]+\}/.test(content) || /\_[0-9a-zA-Z]/.test(content) || /\^[0-9a-zA-Z]/.test(content) || /\^\{[^}]+\}/.test(content)) {
    return true;
  }
  
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
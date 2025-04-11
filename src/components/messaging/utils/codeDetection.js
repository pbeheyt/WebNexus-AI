/**
 * Helper function to detect if content looks like programming code
 * @param {string} content - The text content to analyze
 * @returns {boolean} - Returns true if content appears to be code
 * @deprecated This function uses broad heuristics. Prefer context-driven detection with `hasHighConfidenceCodeIndicators` and `looksLikeSimpleCodeBlock`.
 */
export const looksLikeCode = (content) => {
  // Note: This function's role is reduced. The primary logic now relies on
  // ContentContextManager and the more specific helper functions below.
  return (
    // Imports
    /^\s*import\s+/.test(content) ||
    /^\s*from\s+.+\s+import\s+/.test(content) ||
    
    // Function definitions
    /^\s*def\s+\w+\s*\(/.test(content) ||
    /^\s*function\s+\w+\s*\(/.test(content) ||
    
    // Class definitions
    /^\s*class\s+\w+/.test(content) ||
    
    // Variable declarations with programming keywords
    /^\s*(var|let|const|int|float|double|string|boolean)\s+\w+/.test(content) ||
    
    // Control flow statements
    /^\s*(if|for|while|switch|try|catch)\s*\(/.test(content) ||
    
    // Multiple lines with indentation patterns
    (content.includes('\n') && /\n\s{2,}/.test(content)) ||
    
    // Contains multiple programming statements
    (content.includes(';') && content.includes('\n')) ||
    
    // Contains code comments
    /\/\/\s*\w+/.test(content) || /\/\*[\s\S]*?\*\//.test(content) || /\s*#\s*\w+/.test(content) ||
    
    // Object property access or method calls
    /\.\w+\(/.test(content) ||
    
    // Array indexing
    /\w+\[\d+\]/.test(content)
  );
};

/**
 * Checks for unambiguous code signals suitable for overriding a "math" context suggestion.
 * Focuses on patterns less likely to appear in math formulas.
 * @param {string} content - The text content to analyze.
 * @returns {boolean} - True if high-confidence code indicators are found.
 */
export const hasHighConfidenceCodeIndicators = (content) => {
  // Keywords at the beginning of a line (case-sensitive, allow leading whitespace)
  if (/^\s*(import|export|function|class|const|let|var|def|return|yield|async|await|public|private|static|void|int|float|string|bool)\b/.test(content)) {
    return true;
  }

  // Strict equality/inequality operators
  if (/===|!==/.test(content)) {
    return true;
  }

  // Code comments (ensure # isn't just a markdown header)
  if (/\/\/|#(?!\s+\d)|(\/\*[\s\S]*?\*\/)/.test(content)) {
    // Added check for # followed by space and number
    return true;
  }

  // Object/property access followed by assignment or method call
  if (/\.\w+\s*=| \.\w+\(/.test(content)) {
     return true;
  }

  // Explicit variable declaration patterns
  if (/(const|let|var)\s+\w+\s*=/.test(content)) {
    return true;
  }

  // Arrow functions
  if (/=>/.test(content)) {
    return true;
  }

  return false;
};

/**
 * Checks if the content has basic structural characteristics of a code block.
 * Used when the context suggests "code/text".
 * @param {string} content - The text content to analyze.
 * @returns {boolean} - True if the content looks like a simple code block.
 */
export const looksLikeSimpleCodeBlock = (content) => {
  // Presence of multiple lines
  const hasMultipleLines = content.includes('\n');
  if (!hasMultipleLines) return false; // Basic requirement for a block

  // Lines starting with significant indentation (e.g., 2 or more spaces)
  if (/^\s{2,}/m.test(content)) { // Use 'm' flag for multiline matching
    return true;
  }

  // Presence of curly braces {} or parentheses () spanning multiple lines
  // This is a bit harder to check reliably with simple regex without complex parsing.
  // Let's check for common patterns like braces/parens on their own lines or enclosing indented blocks.
  if (/^\s*{\s*$|^\s*}\s*$/m.test(content) || /^\s*\(\s*$|^\s*\)\s*$/m.test(content)) {
     return true;
  }
  // Check for braces/parens enclosing content with more indentation
  if (/{\s*\n\s{2,}[\s\S]*?\n\s*}/.test(content) || /\(\s*\n\s{2,}[\s\S]*?\n\s*\)/.test(content)) {
      return true;
  }


  // Presence of semicolons ; at the end of multiple lines
  const lines = content.split('\n');
  let semicolonLineCount = 0;
  for (const line of lines) {
    if (/\s*;\s*$/.test(line)) {
      semicolonLineCount++;
    }
  }
  if (semicolonLineCount >= 2) { // Require at least two lines ending with semicolons
    return true;
  }

  return false;
};

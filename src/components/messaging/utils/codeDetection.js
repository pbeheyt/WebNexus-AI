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

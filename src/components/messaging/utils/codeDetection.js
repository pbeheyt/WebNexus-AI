/**
 * Helper function to detect if content looks like programming code
 * @param {string} content - The text content to analyze
 * @returns {boolean} - Returns true if content appears to be code
 */
export const looksLikeCode = (content) => {
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
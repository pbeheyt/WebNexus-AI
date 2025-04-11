import { hasLatexEnvironments, hasLatexDelimiters } from './mathDetection';

/**
 * Pre-processes math content to ensure proper LaTeX formatting
 * @param {string} content - The math content to process
 * @param {boolean} inline - Whether this is inline math
 * @returns {string} - Processed content ready for KaTeX
 */
export const preprocessMathContent = (content, inline = false) => {
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
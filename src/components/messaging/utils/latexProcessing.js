import { hasLatexEnvironments /* keep this */ } from './mathDetection';

/**
 * Pre-processes math content (Simplified for debugging)
 * @param {string} content - The math content passed by remark-math
 * @param {boolean} inline - Whether this is inline math
 * @returns {string} - Processed content ready for KaTeX
 */
export const preprocessMathContent = (content, inline = false) => {
  // --- SIMPLIFIED ---
  // Directly return the content received from remark-math.
  // react-katex should be able to handle raw LaTeX content passed this way.
  // We might re-introduce specific cleaning steps later if needed.

  // console.log(`Preprocessing Math (${inline ? 'Inline' : 'Block'}): Original Content:`, content); // Optional: Add for debugging

  // Exception: Still handle LaTeX environments specifically if needed,
  // although react-katex might handle them fine on its own.
  // Let's comment this out initially for maximum simplicity.
  /*
  if (hasLatexEnvironments(content)) {
    // Minimal processing for environments if absolutely necessary
    content = content.replace(/\\\\(?!\]|\)|\})/g, '\\\\ '); // Spacing for multiline
    return content;
  }
  */

  return content;
};
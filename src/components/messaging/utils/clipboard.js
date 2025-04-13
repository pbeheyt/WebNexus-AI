/**
 * Utility function for clipboard operations
 * Implements the modern clipboard API with fallback to document.execCommand
 * @param {string} text - The text content to copy to clipboard
 * @returns {Promise<void>} - Resolves if successful, rejects with error otherwise
 */
export const copyToClipboard = async (text) => {
  // First try the modern clipboard API if available
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      console.warn('navigator.clipboard.writeText failed, falling back:', error);
      // Continue to fallback method
    }
  }

  // Fallback to document.execCommand
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
      throw new Error('Fallback copy method (execCommand) failed');
    }
  } catch (error) {
    console.error('Fallback copy method failed:', error);
    throw error;
  } finally {
    document.body.removeChild(textarea);
  }
};

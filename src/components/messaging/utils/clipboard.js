/**
 * Utility function for clipboard operations
 * Implements the document.execCommand approach for maximum compatibility
 * @param {string} text - The text content to copy to clipboard
 * @returns {boolean} - Returns true if successful, throws error otherwise
 */
export const copyToClipboard = (text) => {
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